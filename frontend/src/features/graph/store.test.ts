import { beforeEach, describe, expect, it } from 'vitest'
import type { GraphPerson, GraphRelationship, GraphResponse, HiddenCount } from '../../api/types'
import { collapseKey, deriveFamilies, generations, lineage, visibleIds } from './derive'
import { hiddenOf, useGraph } from './store'

const person = (id: string): GraphPerson => ({ id, fullName: id.toUpperCase(), gender: null, photoKey: null })
const parent = (from: string, to: string, kind: GraphRelationship['kind'] = 'BIOLOGICAL'): GraphRelationship => ({
  id: `${from}>${to}`,
  type: 'PARENT_OF',
  fromId: from,
  toId: to,
  subtype: 'PARENT',
  kind,
})
const partner = (a: string, b: string): GraphRelationship => ({
  id: `${a}~${b}`,
  type: 'PARTNER',
  fromId: a,
  toId: b,
  subtype: 'PARTNERS',
  kind: null,
})
const none: HiddenCount = { parents: 0, children: 0, partners: 0 }

function resp(
  focusId: string,
  ids: string[],
  relationships: GraphRelationship[],
  hiddenCounts: Record<string, Partial<HiddenCount>> = {},
  truncated = false,
): GraphResponse {
  return {
    focusId,
    persons: ids.map(person),
    relationships,
    families: [],
    hiddenCounts: Object.fromEntries(Object.entries(hiddenCounts).map(([k, v]) => [k, { ...none, ...v }])),
    truncated,
  }
}

beforeEach(() => useGraph.getState().reset())

describe('store: carregar e mesclar', () => {
  it('load substitui tudo e define o foco', () => {
    useGraph.getState().load(resp('a', ['a', 'b'], [parent('b', 'a')]))
    useGraph.getState().load(resp('x', ['x'], []))
    const s = useGraph.getState()
    expect(s.focusId).toBe('x')
    expect(Object.keys(s.persons)).toEqual(['x'])
    expect(s.relationships).toEqual({})
  })

  it('merge nao duplica pessoas nem arestas repetidas', () => {
    const { load, merge } = useGraph.getState()
    load(resp('a', ['a', 'b'], [parent('b', 'a')]))
    // expansao de b traz a de novo (ancestral repetido) e um novo pai c
    merge(resp('b', ['a', 'c'], [parent('b', 'a'), parent('c', 'b')]))
    const s = useGraph.getState()
    expect(Object.keys(s.persons).sort()).toEqual(['a', 'b', 'c'])
    expect(Object.keys(s.relationships).sort()).toEqual(['b>a', 'c>b'])
    expect(s.focusId).toBe('a') // o foco da tela nao muda
  })

  it('merge mantem truncated uma vez ligado', () => {
    const { load, merge } = useGraph.getState()
    load(resp('a', ['a'], [], {}, true))
    merge(resp('a', ['a'], []))
    expect(useGraph.getState().truncated).toBe(true)
  })
})

describe('store: vizinhos ocultos', () => {
  it('conta o que o servidor tem e o cliente ainda nao baixou', () => {
    useGraph.getState().load(resp('a', ['a', 'b'], [parent('b', 'a')], { b: { parents: 2 } }))
    const hidden = hiddenOf(useGraph.getState())
    expect(hidden('b')).toEqual({ parents: 2, children: 0, partners: 0 })
    expect(hidden('a')).toEqual(none)
  })

  it('expandir reduz o oculto para zero (e deduplica ancestral comum)', () => {
    const { load, merge } = useGraph.getState()
    load(resp('a', ['a', 'b'], [parent('b', 'a')], { b: { parents: 2 } }))
    // pais de b: c e d. d tambem e pai de a? nao; so garante nao duplicar b.
    merge(resp('b', ['c', 'd'], [parent('b', 'a'), parent('c', 'b'), parent('d', 'b')]))
    const hidden = hiddenOf(useGraph.getState())
    expect(hidden('b')).toEqual(none)
    expect(Object.keys(useGraph.getState().persons)).toHaveLength(4)
  })

  it('expansao parcial mantem o restante como oculto', () => {
    const { load, merge } = useGraph.getState()
    load(resp('a', ['a'], [], { a: { children: 3 } }))
    // so um filho veio (ex.: corte por limite); os outros 2 continuam ocultos
    merge(resp('a', ['k1'], [parent('a', 'k1')], { a: { children: 2 } }))
    expect(hiddenOf(useGraph.getState())('a').children).toBe(2)
  })

  it('vizinho que ja estava no cliente por outro caminho nao conta como oculto', () => {
    const { load, merge } = useGraph.getState()
    // a e b sao parceiros e ambos pais de k; b tem 1 pai oculto
    load(
      resp('a', ['a', 'b', 'k'], [partner('a', 'b'), parent('a', 'k'), parent('b', 'k')], { b: { parents: 1 } }),
    )
    // expandir b/up: traz p; k ja existia
    merge(resp('b', ['p'], [parent('p', 'b')]))
    expect(hiddenOf(useGraph.getState())('b').parents).toBe(0)
  })
})

describe('visibilidade e ramos recolhidos', () => {
  const base = () => {
    // avo g -> pai p -> foco f -> filho k; mae m (parceira de p) tambem mae de f
    useGraph.getState().load(
      resp('f', ['f', 'p', 'm', 'g', 'k'], [parent('p', 'f'), parent('m', 'f'), parent('g', 'p'), parent('f', 'k'), partner('p', 'm')]),
    )
    return useGraph.getState()
  }

  it('tudo conectado ao foco e visivel', () => {
    expect([...visibleIds(base())].sort()).toEqual(['f', 'g', 'k', 'm', 'p'])
  })

  it('recolher os pais do pai esconde o avo, mas mantem o resto', () => {
    base()
    useGraph.getState().toggleCollapsed('p', 'up')
    expect([...visibleIds(useGraph.getState())].sort()).toEqual(['f', 'k', 'm', 'p'])
    useGraph.getState().toggleCollapsed('p', 'up')
    expect(visibleIds(useGraph.getState()).has('g')).toBe(true)
  })

  it('recolher filhos do foco esconde o neto', () => {
    base()
    useGraph.getState().toggleCollapsed('f', 'down')
    expect(visibleIds(useGraph.getState()).has('k')).toBe(false)
  })

  it('pessoa alcancavel por outro caminho continua visivel ao recolher um ramo', () => {
    const s = {
      focusId: 'f',
      persons: { f: person('f'), a: person('a'), b: person('b'), c: person('c') },
      // c e filho de a e de b; f e pai de a e de b (endogamia fabricada)
      relationships: Object.fromEntries(
        [parent('f', 'a'), parent('f', 'b'), parent('a', 'c'), parent('b', 'c')].map((r) => [r.id, r]),
      ),
      collapsed: { [collapseKey('a', 'down')]: true as const },
    }
    expect(visibleIds(s).has('c')).toBe(true)
  })
})

describe('geracoes, familias e linhagem', () => {
  it('geracao relativa ao foco', () => {
    const rels = [parent('g', 'p'), parent('p', 'f'), parent('f', 'k'), partner('f', 's')]
    const ids = new Set(['g', 'p', 'f', 'k', 's'])
    const gens = generations('f', rels, ids)
    expect([gens.get('g'), gens.get('p'), gens.get('f'), gens.get('k'), gens.get('s')]).toEqual([-2, -1, 0, 1, 0])
  })

  it('meio-irmaos ficam em familias diferentes; irmaos na mesma', () => {
    const rels = [parent('a', 'x'), parent('b', 'x'), parent('a', 'y'), parent('b', 'y'), parent('a', 'z'), parent('c', 'z')]
    const families = deriveFamilies(rels, new Set(['a', 'b', 'c', 'x', 'y', 'z']))
    expect(families.map((f) => [f.parentIds, f.childIds])).toEqual([
      [['a', 'b'], ['x', 'y']],
      [['a', 'c'], ['z']],
    ])
  })

  it('familia de um so pai/mae quando o outro nao esta no subgrafo', () => {
    const families = deriveFamilies([parent('a', 'x'), parent('b', 'x')], new Set(['a', 'x']))
    expect(families).toHaveLength(1)
    expect(families[0].parentIds).toEqual(['a'])
  })

  it('linhagem inclui antepassados e descendentes, nao irmaos nem tios', () => {
    const rels = [parent('g', 'p'), parent('g', 'tio'), parent('p', 'f'), parent('p', 'irmao'), parent('f', 'k')]
    expect([...lineage(rels, 'f')].sort()).toEqual(['f', 'g', 'k', 'p'])
  })

  it('linhagem em casamento entre primos conta o ancestral comum uma vez', () => {
    const rels = [parent('g', 'a'), parent('g', 'b'), parent('a', 'x'), parent('b', 'y'), parent('x', 'k'), parent('y', 'k')]
    const l = lineage(rels, 'k')
    expect([...l].sort()).toEqual(['a', 'b', 'g', 'k', 'x', 'y'])
  })
})
