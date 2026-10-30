# Performance (Milestone 12)

Medido em 2026-10-29: Windows 11, backend `java -Xmx512m` (pool Hikari = 5) e Postgres 16 em Docker na mesma maquina; cliente Node via `localhost`. Dados sinteticos de `tools/seed` (semente 42): meio-irmaos (segundas unioes), adocoes e casamentos cruzados. Foco = pessoa com mais pais+filhos.

## Como reproduzir

```bash
docker run -d --name ft-bench -e POSTGRES_DB=familytree -e POSTGRES_USER=familytree -e POSTGRES_PASSWORD=bench -p 5433:5432 postgres:16-alpine -c log_statement=all
# suba o backend contra esse banco (DB_URL=jdbc:postgresql://localhost:5433/familytree, PORT=8081, ADMIN_*/JWT_SECRET, API_MAX_REQUESTS alto)
node tools/seed/seed.mjs 10000 42 | docker exec -i ft-bench psql -U familytree -d familytree   # so semeia
node tools/seed/bench.mjs                                    # API: todos os cenarios (tabela abaixo)
docker exec -i ft-bench psql -U familytree -d familytree -f - < tools/seed/explain.sql   # EXPLAIN ANALYZE
node frontend/scripts/layout-bench.ts --focus <uuid-de-um-fundador>  # layout ELK
```

`seed.mjs` **apaga todas as pessoas** do banco alvo: use so um banco descartavel.

## API (p50 / p95 de 30 requisicoes apos aquecimento)

O piso de ~15 ms em quase tudo e overhead do cliente/loopback no Windows (resolucao de timer), nao do servidor: o `EXPLAIN` mostra 2 ms de execucao no banco.

| pessoas | relac. | consulta | p50 (ms) | p95 (ms) | payload (KB) | queries/req |
|---:|---:|---|---:|---:|---:|---:|
| 100 | 161 | graph (2/2) | 15.7 | 31.6 | 13.4 | 4 |
| 100 | 161 | graph (10/10) | 29.8 | 37.1 | 25.5 | 4 |
| 100 | 161 | graph/expand down | 15.4 | 19.5 | 2.3 | 4 |
| 100 | 161 | people/search | 15.2 | 21.6 | 0.3 | 2 |
| 100 | 161 | people/{id}/relatives | 15.9 | 16.7 | 1.5 | 1 |
| 500 | 856 | graph (2/2) | 30.3 | 33.3 | 20.5 | 4 |
| 500 | 856 | graph (10/10) | 30.6 | 36.9 | 24.2 | 4 |
| 500 | 856 | graph/expand down | 15.3 | 23.2 | 3.6 | 4 |
| 500 | 856 | people/search | 15.3 | 18.7 | 1.4 | 2 |
| 500 | 856 | people/{id}/relatives | 15.9 | 16.9 | 2.9 | 1 |
| 1000 | 1663 | graph (2/2) | 15.3 | 20.7 | 21.8 | 4 |
| 1000 | 1663 | graph (10/10) | 15.1 | 22.7 | 25.8 | 4 |
| 1000 | 1663 | graph/expand down | 15.5 | 19.9 | 4.0 | 4 |
| 1000 | 1663 | people/search | 15.5 | 23.4 | 1.5 | 2 |
| 1000 | 1663 | people/{id}/relatives | 16.0 | 17.2 | 3.4 | 1 |
| 5000 | 8877 | graph (2/2) | 15.4 | 21.8 | 19.1 | 4 |
| 5000 | 8877 | graph (10/10) | 16.3 | 30.7 | 25.5 | 4 |
| 5000 | 8877 | graph/expand down | 14.2 | 19.2 | 3.6 | 4 |
| 5000 | 8877 | people/search | 15.2 | 17.2 | 1.4 | 2 |
| 5000 | 8877 | people/{id}/relatives | 15.2 | 16.9 | 3.4 | 1 |
| 10000 | 17382 | graph (2/2) | 15.8 | 31.5 | 25.8 | 4 |
| 10000 | 17382 | graph (10/10, trunca em 500 nos) | 45.9 | 49.2 | 53.6 | 4 |
| 10000 | 17382 | graph/expand down | 15.4 | 18.7 | 3.6 | 4 |
| 10000 | 17382 | people/search | 15.3 | 19.0 | 1.4 | 2 |
| 10000 | 17382 | people/{id}/relatives | 15.4 | 16.4 | 3.4 | 1 |

Banco: 10,5 MB (vazio, so schema/indices) -> 23 MB com 10k pessoas e 17k relacionamentos (~1,3 KB/pessoa). Conexoes JDBC: 5 (teto do pool) em todos os cenarios; nenhuma requisicao usa mais de uma conexao.

## EXPLAIN ANALYZE (10k pessoas, `tools/seed/explain.sql`)

- `collectIds` (ancestrais/descendentes/parceiros, 10/10): 2,1 ms, so scans por indice (`idx_relationship_to`, `uq_relationship`).
- Busca por substring/trigram ("silva", ~570 resultados): 2,3 ms via `idx_person_search_name_trgm`.
- Busca de 2 palavras ("joao silva"): o planner escolhe Seq Scan (18,5 ms em 10k) porque `%` (similaridade) e permissivo e devolve ~3% da tabela. Dentro da meta (< 50 ms); cresce linearmente, entao reavaliar acima de ~30k pessoas. Nenhum indice novo foi necessario.

## Layout no front (ELK, 500 nos visiveis)

Medido fora do navegador (`frontend/scripts/layout-bench.ts`, ELK na thread principal do Node; no app ele roda num Web Worker, entao a tela nao trava, mas o tempo ate o desenho final e o mesmo):

| nos | familias | antes | depois |
|---:|---:|---:|---:|
| 8 | 2 | 31 ms | 19 ms |
| 42 | 9 | 62 ms | 55 ms |
| 500 | 155 | **11,5 s** | **1,6 s** |

Causa: a camada ja vem das particoes (geracoes), mas o ELK ainda rodava network simplex para criar camadas. `elk.layered.layering.strategy = LONGEST_PATH` corta 7x sem mudar o resultado. Reduzir `thoroughness`/cruzamentos ganhava mais, porem degrada a qualidade do desenho; nao aplicado.

## Navegador (Chrome, 500 pessoas)

Medido em 2026-10-29 com Claude in Chrome: foco = primeiro fundador (`ORDER BY ctid`), grafo 10/10 (500 pessoas, truncado; minimapa com 655 itens contando nos de uniao). A tela nao tem controle de profundidade, entao o `up`/`down` foi injetado por uma edicao local temporaria em `GraphPage.tsx` (revertida). Ferramenta de automacao: pan e zoom reais duram ~200 ms, por isso os eventos foram disparados a cada frame por ~5 s.

| fase | frames | FPS medio | FPS min | frames > 16,7 ms |
|---|---:|---:|---:|---:|
| parado (referencia) | 119 | 60,0 | 58,1 | 36,1% |
| pan | 330 | 60,0 | 57,8 | 38,5% |
| zoom | 298 | 59,8 | 29,9 | 37,9% |

- Os ~37% acima de 16,7 ms sao jitter de vsync (a referencia parada da o mesmo). Pior frame no pan: 17,3 ms. No zoom, um unico frame de 33,4 ms (0,3% acima de 25 ms).
- Heap JS: 43,0 MB usado / 73,0 MB total antes de mexer; 18,8 / 24,5 MB apos o pan; 29,7 / 75,9 MB apos o zoom (GC entre as medicoes, entao nao e monotonico). Segunda carga: 38,7 / 64,3 MB.
- DOM: ~820 elementos apos o layout, 995 apos pan/zoom. `onlyRenderVisibleElements` ja esta ativo em `GraphView.tsx`, entao so 7 a 20 nos ficam montados por vez.
- Sem erros no console.
- **Nao medido**: tempo ate o fim do layout no navegador (fica entre 1 s, fim do fetch, e 7 s; o bench de Node deu 1,6 s). O FPS foi medido com poucos nos montados, nao com 500 no DOM.

## Metas

| meta | resultado |
|---|---|
| `/graph` < 200 ms e < 100 KB em 10k | OK: 16 ms (p50), 25,8 KB padrao; 53,6 KB no pior caso (500 nos) |
| busca < 50 ms no servidor | OK: 2 a 19 ms no banco; 15 ms ponta a ponta |
| interacao fluida com ~500 nos | **OK**: pan/zoom a ~60 FPS, heap 19 a 43 MB, layout 1,6 s no Node. Tempo de layout no navegador nao cronometrado (1 a 7 s) |

## Pendencias / plano

- Cronometrar o layout ate o desenho final no navegador (ex.: `performance.mark` ao iniciar o worker e ao aplicar posicoes). Pan/zoom nao precisaram de ajuste.
- Limites atuais mantidos: `familytree.graph.max-nodes = 500`, profundidade <= 10.
