# API

Base: `/api/v1` (dados) e `/auth` (login). Tudo exige `Authorization: Bearer <jwt>`, exceto `POST /auth/login` e `GET /actuator/health`. Corpo e resposta em JSON. IDs sao UUID.

## Autenticacao

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/auth/login` | `{username, password}` -> `{accessToken, tokenType: "Bearer", expiresIn}` (segundos). Limite: 5 tentativas/min por IP |
| POST | `/auth/logout` | 204, sem efeito no servidor (o cliente descarta o token; o JWT expira sozinho) |
| GET | `/auth/me` | `{username, roles}` do token atual |

## Pessoas

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/people` | Cria. Corpo: `{fullName (obrigatorio, <= 200), gender?, notes? (<= 10000)}`. 201 + `Location` |
| GET | `/people?page=0&size=20&q=` | Lista paginada (`size` 1..100). Resposta: `{items, page, size, total}` |
| GET | `/people/search?q=&limit=10` | Autocomplete por nome (sem acento, tolera erros de digitacao). `limit` 1..50. Cada item traz `parents` (nomes) para desambiguar homonimos |
| GET | `/people/{id}` | Uma pessoa |
| PUT | `/people/{id}` | Substitui os campos editaveis |
| DELETE | `/people/{id}` | 204. Remove tambem os vinculos da pessoa; as outras pessoas continuam |

`gender`: `MALE`, `FEMALE`, `OTHER` ou `null`.

## Relacionamentos

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/relationships` | Cria um vinculo (corpo abaixo). 201 |
| DELETE | `/relationships/{id}` | 204 |
| GET | `/people/{id}/relationships` | Vinculos da pessoa. `role` = papel da OUTRA pessoa: `PARENT`, `CHILD` ou `PARTNER` |

Corpo de `POST /relationships`: `{type, fromId, toId, subtype, kind}`.

- `type = PARENT_OF`: `fromId` e pai/mae de `toId`. `subtype`: `FATHER`, `MOTHER` ou `PARENT`. `kind`: `BIOLOGICAL`, `ADOPTIVE`, `STEP`, `FOSTER`, `UNKNOWN`.
- `type = PARTNER`: sem direcao (A-B = B-A). `subtype`: `MARRIED`, `PARTNERS`, `EX`. `kind` nao se aplica.

Regras (ver [ADR 0003](adr/0003-regras-do-grafo.md)): sem auto-relacao, sem ciclo em `PARENT_OF`, no maximo 2 pais **biologicos** (e 1 pai/1 mae biologicos por papel); pais adotivos/padrastos nao tem limite; primos podem se casar.

## Grafo (para a tela de arvore)

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/graph?focus={id}&up=2&down=2&partners=true` | Subgrafo ao redor do foco. `up`/`down` 0..10 geracoes |
| GET | `/graph/expand/{id}?direction=up\|down\|partners` | So os vizinhos novos, para expandir um no sem recarregar tudo |
| GET | `/people/{id}/relatives` | Irmaos e meio-irmaos (derivados dos pais em comum) |

Resposta de `/graph`: `{focusId, persons, relationships, families, hiddenCounts, truncated}`. Cada pessoa aparece **uma vez** (mesmo com ancestrais repetidos). `families` agrupa pais com filhos em comum; `hiddenCounts` so lista quem tem vizinhos fora do subgrafo (para os botoes "+N filhos"). Passa de 500 pessoas (`familytree.graph.max-nodes`) -> `truncated: true`.

## Fotos

Upload direto ao armazenamento (Cloudflare R2): a API nunca recebe o arquivo.

1. `POST /photos/upload-url` `{contentType, size}` -> URL pre-assinada e `photoKey`. Tipos: `image/webp`, `image/jpeg`, `image/png`. Tamanho maximo padrao: 200 KB (`PHOTO_MAX_BYTES`).
2. O cliente envia o arquivo com `PUT` para a URL.
3. `PUT /people/{id}/photo` `{photoKey}` associa a foto. `DELETE /people/{id}/photo` remove (204).

Sem as variaveis `R2_*` o resto funciona e as rotas de foto respondem 503 `PHOTOS_NOT_CONFIGURED`.

## Erros

Formato unico; nunca ha stacktrace:

```json
{ "code": "CYCLE_DETECTED", "message": "...", "fieldErrors": [{"field": "fullName", "message": "..."}], "traceId": "uuid" }
```

`traceId` tambem aparece no log do servidor (use-o para achar o erro de um usuario).

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | campo invalido (`fieldErrors` diz qual) |
| 400 | `SELF_RELATION`, `INVALID_RELATIONSHIP`, `INVALID_DIRECTION`, `INVALID_PHOTO_KEY`, `INVALID_PHOTO_TYPE`, `PHOTO_TOO_LARGE` | pedido mal formado ou foto fora do limite |
| 401 | `UNAUTHORIZED` / `INVALID_CREDENTIALS` | sem token, token expirado, senha errada |
| 403 | `FORBIDDEN` | sem permissao |
| 404 | `NOT_FOUND` | pessoa/vinculo inexistente |
| 409 | `CYCLE_DETECTED`, `TOO_MANY_BIOLOGICAL_PARENTS`, `DUPLICATE_PARENT_ROLE`, `DUPLICATE_RELATIONSHIP`, `DIFFERENT_TREE` | regra do grafo violada |
| 429 | `RATE_LIMITED` | muitas requisicoes; veja `Retry-After`. Padrao: 300/min por IP |
| 503 | `PHOTOS_NOT_CONFIGURED` | R2 nao configurado |
| 500 | `INTERNAL_ERROR` | erro inesperado (so `traceId`, sem detalhes) |
