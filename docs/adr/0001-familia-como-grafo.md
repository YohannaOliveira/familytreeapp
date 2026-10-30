# 0001. A familia e um grafo; a arvore e so uma visao

**Contexto.** Familias reais nao sao arvores: meio-irmaos (segundas unioes), adocoes, casamentos entre primos e ancestrais repetidos (pedigree collapse) quebram qualquer modelo "cada pessoa tem um pai e uma mae".

**Decisao.** Pessoas sao nos; `relationship` sao arestas de dois tipos: `PARENT_OF` (dirigida) e `PARTNER` (nao dirigida, gravada com os ids em ordem canonica). A "arvore" da tela e um subgrafo ao redor de um foco (`GET /graph`), em que cada pessoa aparece uma vez. Familias (pais com filhos em comum) e irmaos sao **derivados**, nao gravados.

**Consequencias.** Consultas de ancestrais/descendentes usam CTE recursiva com indices nas arestas (2 ms em 10 mil pessoas, ver `docs/performance.md`). A UI precisa de um no "familia" para ligar o casal aos filhos. Nao ha tabela de irmaos: mudar os pais muda os irmaos.

**Alternativas descartadas.** Colunas `pai_id`/`mae_id` na pessoa (nao representa adocao, meio-irmaos com varios pais nem uniao multipla).
