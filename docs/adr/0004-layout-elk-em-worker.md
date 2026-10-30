# 0004. Layout da arvore com ELK em Web Worker

**Contexto.** A tela precisa posicionar ate 500 pessoas, com geracoes em linhas, casais lado a lado e arestas sem cruzamento desnecessario.

**Decisao.** Layout em camadas com `elkjs`, executado num **Web Worker** (a interface nao trava durante o calculo). As geracoes ja vem do servidor; por isso `elk.layered.layering.strategy = LONGEST_PATH` evita o network simplex: com 500 nos o layout caiu de 11,5 s para 1,6 s sem mudar o desenho. O React Flow renderiza so o que esta visivel (`onlyRenderVisibleElements`). O limite de 500 pessoas na tela (`familytree.graph.max-nodes`) mantem a interacao fluida.

**Medido (Chrome, 500 pessoas):** pan e zoom a ~60 FPS; heap JS 19 a 43 MB. Detalhes em `docs/performance.md`.

**Consequencias.** O Worker pede `worker-src 'self' blob:` na CSP. O minimapa fica oculto abaixo de 640 px. Acima de ~500 nos o usuario recolhe ramos ou muda o foco; ha aviso na tela.

**Alternativas descartadas.** Reduzir `thoroughness`/cruzamentos (mais rapido, mas desenho pior).
