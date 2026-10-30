#!/usr/bin/env node
// Benchmark da API por cenario: semeia N pessoas e mede tempo, payload e queries por requisicao.
// Uso: node bench.mjs [--api http://localhost:8081] [--container ft-bench] [--pass bench-pass]
//                     [--sizes 100,500,1000,5000,10000] [--runs 30] [--seed 42]
// Requer: backend rodando contra o banco do container (log_statement=all para contar queries).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []))
const API = args.api ?? 'http://localhost:8081'
const CONTAINER = args.container ?? 'ft-bench'
const PASS = args.pass ?? 'bench-pass'
const SIZES = (args.sizes ?? '100,500,1000,5000,10000').split(',').map(Number)
const RUNS = Number(args.runs ?? 30)
const SEED = args.seed ?? '42'
const here = dirname(fileURLToPath(import.meta.url))

const sh = (cmd, a, input) => {
  const r = spawnSync(cmd, a, { input, encoding: 'utf8', maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}: ${r.stderr}`)
  return r.stdout
}
const psql = (sql) => sh('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'familytree', '-d', 'familytree', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]).trim()

async function login() {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PASS }) })
  if (!res.ok) throw new Error(`login ${res.status}`)
  return (await res.json()).accessToken
}

const pct = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]

async function measure(token, path) {
  const get = async () => {
    const t0 = performance.now()
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    const buf = await res.arrayBuffer()
    return { ms: performance.now() - t0, bytes: buf.byteLength, status: res.status }
  }
  for (let i = 0; i < 3; i++) await get() // aquecimento (JIT, cache)
  // queries de UMA requisicao: diferenca da contagem no log do postgres (sem depender de relogio)
  const logQueries = () => {
    const lr = spawnSync('docker', ['logs', CONTAINER, '--tail', '400'], { encoding: 'utf8', maxBuffer: 1 << 28 })
    return lr.stdout + lr.stderr // o postgres loga em stderr
  }
  const marker = `bench-marker-${Math.random().toString(36).slice(2)}`
  psql(`SELECT '${marker}'`)
  const one = await get()
  await new Promise((r) => setTimeout(r, 300))
  const log = logQueries()
  const after = log.slice(log.lastIndexOf(marker))
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(await get())
  const ms = runs.map((r) => r.ms)
  return { status: one.status, bytes: one.bytes, p50: pct(ms, 0.5), p95: pct(ms, 0.95), max: Math.max(...ms), logSince: after }
}

function countQueries(logText) {
  // o texto do SQL pode vir na linha seguinte; ignora controle de transacao
  const all = (logText.match(/LOG:\s+execute [^:]*:/g) ?? []).length
  const ctl = (logText.match(/LOG:\s+execute [^:]*:\s*(BEGIN|COMMIT|ROLLBACK|SET |SHOW )/g) ?? []).length
  return all - ctl
}

const results = []
const token = await login() // login tem rate limit (5/min): um so token
for (const n of SIZES) {
  const sql = sh('node', [join(here, 'seed.mjs'), String(n), SEED])
  sh('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'familytree', '-d', 'familytree', '-q', '-v', 'ON_ERROR_STOP=1'], sql)
  // foco: pessoa com pais e filhos e muitos vizinhos (caso pesado realista)
  const focus = psql(`SELECT p.id FROM person p
      JOIN relationship a ON a.to_person_id = p.id AND a.type = 'PARENT_OF'
      JOIN relationship b ON b.from_person_id = p.id AND b.type = 'PARENT_OF'
      GROUP BY p.id ORDER BY count(*) DESC, p.id LIMIT 1`)
  const name = psql(`SELECT split_part(search_name, ' ', 1) FROM person WHERE id = '${focus}'`)
  const cases = {
    'graph (padrao 2/2)': `/api/v1/graph?focus=${focus}`,
    'graph (10/10)': `/api/v1/graph?focus=${focus}&up=10&down=10`,
    'graph/expand down': `/api/v1/graph/expand/${focus}?direction=down`,
    'people/search': `/api/v1/people/search?q=${encodeURIComponent(name)}`,
    'people/{id}/relatives': `/api/v1/people/${focus}/relatives`,
  }
  const row = { people: n, rels: Number(psql('SELECT count(*) FROM relationship')), cases: {} }
  for (const [label, path] of Object.entries(cases)) {
    const m = await measure(token, path)
    row.cases[label] = { status: m.status, bytes: m.bytes, p50: m.p50, p95: m.p95, queries: countQueries(m.logSince) }
  }
  row.dbBytes = Number(psql("SELECT pg_database_size('familytree')"))
  row.connections = Number(psql("SELECT count(*) FROM pg_stat_activity WHERE datname = 'familytree' AND application_name LIKE 'PostgreSQL JDBC%'"))
  results.push(row)
  console.error(`ok ${n}`)
}

const kb = (b) => (b / 1024).toFixed(1)
console.log('| pessoas | relac. | consulta | status | p50 (ms) | p95 (ms) | payload (KB) | queries/req |')
console.log('|---:|---:|---|---:|---:|---:|---:|---:|')
for (const r of results)
  for (const [label, c] of Object.entries(r.cases))
    console.log(`| ${r.people} | ${r.rels} | ${label} | ${c.status} | ${c.p50.toFixed(1)} | ${c.p95.toFixed(1)} | ${kb(c.bytes)} | ${c.queries} |`)
console.log('\n| pessoas | banco (MB) | conexoes JDBC abertas |')
console.log('|---:|---:|---:|')
for (const r of results) console.log(`| ${r.people} | ${(r.dbBytes / 1048576).toFixed(1)} | ${r.connections} |`)
