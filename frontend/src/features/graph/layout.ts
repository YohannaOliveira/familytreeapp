import ELK from 'elkjs/lib/elk-api'
import { buildElkGraph, type LayoutInput } from './elkGraph'

export { FAMILY_SIZE, PERSON_H, PERSON_W } from './elkGraph'
export type { LayoutInput } from './elkGraph'
export type Positions = Record<string, { x: number; y: number }>

let elk: InstanceType<typeof ELK> | null = null

/** ELK roda num Web Worker: o layout de centenas de nos nao trava a tela. */
function getElk() {
  elk ??= new ELK({
    workerFactory: () => new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url), { type: 'classic' }),
  })
  return elk
}

export async function computeLayout(input: LayoutInput): Promise<Positions> {
  const result = await getElk().layout(buildElkGraph(input))
  const out: Positions = {}
  for (const n of result.children ?? []) out[n.id] = { x: n.x ?? 0, y: n.y ?? 0 }
  return out
}
