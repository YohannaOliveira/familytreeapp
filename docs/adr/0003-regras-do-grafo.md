# 0003. Regras de integridade do grafo

**Contexto.** Sem regras, o cadastro manual gera dados impossiveis (alguem ancestral de si mesmo) ou bloqueia casos reais (adocao, padrasto).

**Decisao.** Validadas em `RelationshipService.create`, dentro de um lock por arvore (`lockTree`) para que criacoes simultaneas nao furem os limites:

- Nenhuma pessoa se relaciona consigo mesma (`SELF_RELATION`).
- `PARENT_OF` e um **DAG**: recusa a aresta se o pai ja e descendente do filho (`CYCLE_DETECTED`). `PARTNER` pode formar ciclos.
- No maximo **2 pais biologicos** por pessoa (`TOO_MANY_BIOLOGICAL_PARENTS`) e, entre os biologicos, 1 `FATHER` e 1 `MOTHER` (`DUPLICATE_PARENT_ROLE`). Um `PARENT` generico conta no limite de 2 mas nao no de papel. Pais adotivos, padrastos e de criacao (`ADOPTIVE`, `STEP`, `FOSTER`) nao tem limite.
- Par duplicado e recusado (`DUPLICATE_RELATIONSHIP`); `PARTNER` A-B e B-A sao o mesmo vinculo.
- Primos podem se casar (nao ha regra de consanguinidade).

O banco repete o que da: restricoes `CHECK` de subtipo/tipo, indice unico por par e ordem canonica de `PARTNER`.

**Consequencias.** O limite de 2 e "suave" so no sentido de nao cobrir biologia incomum (doacao, etc.): para esses casos use `UNKNOWN`/`ADOPTIVE`. O teste `concurrentBiologicalParentsNeverExceedTwo` exercita o lock com 8 requisicoes simultaneas.
