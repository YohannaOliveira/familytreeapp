#!/usr/bin/env node
// Gerador reprodutivel de familia sintetica. Imprime SQL em stdout (apaga as pessoas existentes!).
// Uso: node seed.mjs <pessoas> [semente=42] | docker exec -i ft-bench psql -U familytree -d familytree
// Requer o schema ja migrado (suba o backend uma vez) e a arvore padrao criada pela V1.
// Inclui: meio-irmaos (segundas unioes), adocoes (ADOPTIVE) e casamentos cruzados (entre ramos/primos).

const total = Number(process.argv[2] ?? 1000)
const seed = Number(process.argv[3] ?? 42)
if (!Number.isInteger(total) || total < 10) {
  console.error('uso: seed.mjs <pessoas >= 10> [semente]')
  process.exit(1)
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(seed)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const chance = (p) => rnd() < p
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))

const hex = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('')
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[int(0, 3)]}${hex(3)}-${hex(12)}`

const MALE = ['João', 'José', 'Antônio', 'Francisco', 'Carlos', 'Paulo', 'Pedro', 'Lucas', 'Luiz', 'Marcos', 'Gabriel', 'Rafael', 'Daniel', 'Marcelo', 'Bruno', 'Eduardo', 'Felipe', 'Rodrigo', 'Gustavo', 'André']
const FEMALE = ['Maria', 'Ana', 'Francisca', 'Antônia', 'Adriana', 'Juliana', 'Márcia', 'Fernanda', 'Patrícia', 'Aline', 'Sandra', 'Camila', 'Amanda', 'Bruna', 'Jéssica', 'Letícia', 'Luciana', 'Vanessa', 'Beatriz', 'Helena']
const SURNAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira']

const people = [] // { id, name, gender, gen }
const rels = [] // { type, from, to, subtype, kind }
const partnerKeys = new Set()

function newPerson(gen, gender, surname) {
  const g = gender ?? (chance(0.5) ? 'MALE' : 'FEMALE')
  const p = { id: uuid(), gender: g, gen, surname: surname ?? pick(SURNAMES) }
  p.name = `${pick(g === 'MALE' ? MALE : FEMALE)} ${chance(0.4) ? pick(SURNAMES) + ' ' : ''}${p.surname}`
  people.push(p)
  return p
}
const full = () => people.length >= total

function partner(a, b, subtype) {
  if (a.id === b.id) return false
  const [from, to] = a.id < b.id ? [a, b] : [b, a]
  const key = from.id + to.id
  if (partnerKeys.has(key)) return false
  partnerKeys.add(key)
  rels.push({ type: 'PARTNER', from: from.id, to: to.id, subtype })
  return true
}
function parentOf(parent, child, kind) {
  const subtype = parent.gender === 'MALE' ? 'FATHER' : parent.gender === 'FEMALE' ? 'MOTHER' : 'PARENT'
  rels.push({ type: 'PARENT_OF', from: parent.id, to: child.id, subtype, kind })
}

// Fundadores: varios ramos independentes que depois se cruzam por casamentos.
const roots = Math.max(2, Math.min(6, Math.floor(total / 40)))
let current = [] // casais (ou pais solteiros) da geracao corrente: { a, b, ... }
for (let i = 0; i < roots && !full(); i++) {
  const a = newPerson(0, 'MALE')
  const b = full() ? null : newPerson(0, 'FEMALE', a.surname)
  if (b) partner(a, b, 'MARRIED')
  current.push({ parents: b ? [a, b] : [a] })
}

let gen = 0
const unpaired = [] // adultos da geracao ainda sem parceiro, candidatos a casamento cruzado
while (!full() && current.length > 0) {
  gen++
  const kids = [] // filhos desta geracao, com sua familia de origem
  for (const fam of current) {
    if (full()) break
    const n = chance(0.12) ? 0 : int(1, 4)
    for (let i = 0; i < n && !full(); i++) {
      const child = newPerson(gen)
      child.family = fam
      for (const p of fam.parents) parentOf(p, child, 'BIOLOGICAL')
      kids.push(child)
    }
  }
  // Adocoes: ~4% dos filhos ganham um pai/mae adotivo de outra familia (e deixam de ser biologicos desta).
  for (const child of kids) {
    if (chance(0.04) && current.length > 1) {
      const other = pick(current.filter((f) => f !== child.family))
      parentOf(pick(other.parents), child, 'ADOPTIVE')
    }
  }
  // Casamentos: cruzado (outro ramo/prima) ou com um de fora; segundas unioes geram meio-irmaos.
  const next = []
  const adults = kids.slice()
  const used = new Set()
  for (const child of adults) {
    if (full() || used.has(child.id)) continue
    if (chance(0.15)) continue // fica solteiro(a)
    let spouse = null
    if (chance(0.15)) {
      // cruzado: outro filho da mesma geracao ainda livre, de outra familia (pode ser primo)
      const pool = adults.filter((o) => !used.has(o.id) && o.id !== child.id && o.family !== child.family)
      if (pool.length > 0) spouse = pick(pool)
    }
    if (!spouse) {
      if (full()) continue
      spouse = newPerson(gen, child.gender === 'MALE' ? 'FEMALE' : 'MALE')
    }
    used.add(child.id); used.add(spouse.id)
    partner(child, spouse, chance(0.8) ? 'MARRIED' : 'PARTNERS')
    next.push({ parents: [child, spouse] })
    // segunda uniao (~12%): novo parceiro de fora; os filhos dela sao meio-irmaos dos primeiros.
    if (chance(0.12) && !full()) {
      const second = newPerson(gen, spouse.gender === 'MALE' ? 'FEMALE' : 'MALE')
      partner(child, second, 'PARTNERS')
      next.push({ parents: [child, second] })
    }
  }
  current = next
  if (gen > 60) break
}
// Se a populacao ainda nao fechou (linhagens extintas), sobram os que ja existem: completa com agregados soltos.
while (!full()) {
  const p = newPerson(gen)
  const mate = people[int(0, people.length - 2)]
  if (mate.id !== p.id) partner(p, mate, 'PARTNERS')
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const CHUNK = 1000

const out = []
out.push('BEGIN;')
out.push('DELETE FROM person;')
for (let i = 0; i < people.length; i += CHUNK) {
  const rows = people.slice(i, i + CHUNK).map((p) => `('${p.id}', (SELECT id FROM tree ORDER BY created_at, id LIMIT 1), ${q(p.name)}, ${q(norm(p.name))}, '${p.gender}')`)
  out.push(`INSERT INTO person (id, tree_id, full_name, search_name, gender) VALUES\n${rows.join(',\n')};`)
}
for (let i = 0; i < rels.length; i += CHUNK) {
  const rows = rels.slice(i, i + CHUNK).map((r) => {
    const kind = r.type === 'PARENT_OF' ? q(r.kind) : 'NULL'
    return `(${q(r.type)}, (SELECT id FROM tree ORDER BY created_at, id LIMIT 1), '${r.from}', '${r.to}', ${q(r.subtype)}, ${kind})`
  })
  out.push(`INSERT INTO relationship (type, tree_id, from_person_id, to_person_id, subtype, kind) VALUES\n${rows.join(',\n')};`)
}
out.push('COMMIT;')
out.push('ANALYZE person; ANALYZE relationship;')
console.log(out.join('\n'))
console.error(`seed: ${people.length} pessoas, ${rels.length} relacionamentos, ${gen} geracoes (semente ${seed})`)
