import type { ElkNode } from 'elkjs/lib/elk-api'

export const PERSON_W = 176
export const PERSON_H = 72
export const FAMILY_SIZE = 12

export interface LayoutInput {
  /** Pessoas com geracao relativa ao foco. */
  persons: { id: string; generation: number }[]
  families: { id: string; parentIds: string[]; childIds: string[]; generation: number }[]
  /** Parceiros que nao tem filhos em comum (os demais ficam juntos pela familia). */
  partnerPairs: [string, string][]
}

/** Monta o grafo ELK (puro, sem Worker): usado pela UI e pelo benchmark de layout em scripts/. */
export function buildElkGraph(input: LayoutInput): ElkNode {
  // Geracao = camada: cada pessoa na particao 2*g e cada familia na 2*g+1 (entre pais e filhos).
  const children: ElkNode[] = [
    ...input.persons.map((p) => ({
      id: p.id,
      width: PERSON_W,
      height: PERSON_H,
      layoutOptions: { 'elk.partitioning.partition': String(2 * p.generation + 100) },
    })),
    ...input.families.map((f) => ({
      id: f.id,
      width: FAMILY_SIZE,
      height: FAMILY_SIZE,
      layoutOptions: { 'elk.partitioning.partition': String(2 * f.generation + 101) },
    })),
  ]
  const edges = [
    ...input.families.flatMap((f) => [
      ...f.parentIds.map((p) => ({ id: `${p}>${f.id}`, sources: [p], targets: [f.id] })),
      ...f.childIds.map((c) => ({ id: `${f.id}>${c}`, sources: [f.id], targets: [c] })),
    ]),
    ...input.partnerPairs.map(([a, b]) => ({ id: `${a}~${b}`, sources: [a], targets: [b] })),
  ]
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.partitioning.activate': 'true',
      // As camadas ja vem das particoes (geracoes); network simplex so custa tempo (500 nos: 11,5 s -> 1,7 s).
      'elk.layered.layering.strategy': 'LONGEST_PATH',
      'elk.spacing.nodeNode': '32',
      'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.semiInteractive': 'false',
    },
    children,
    edges,
  }
  return graph
}
