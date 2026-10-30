# 0002. JWT curto no header `Authorization`, sem cookie

**Contexto.** O front (Cloudflare Pages) e a API (Render) ficam em dominios diferentes. Ha um unico administrador; tudo exige login.

**Decisao.** `POST /auth/login` devolve um JWT HS256 de curta duracao (padrao 30 min). O front o guarda em `sessionStorage` (some ao fechar a aba) e o envia em `Authorization: Bearer`. API stateless, sem CSRF (nao ha cookie de sessao). Usuario e hash BCrypt vem de variaveis de ambiente; a aplicacao nao sobe sem `ADMIN_USER`, `ADMIN_PASSWORD_HASH` e `JWT_SECRET` (>= 32 caracteres). Rate limit por IP: 5 logins/min e 300 requisicoes/min. 401 em qualquer requisicao derruba a sessao no front.

**Consequencias.** Um script injetado na pagina (XSS) conseguiria ler o token; a mitigacao e a CSP restritiva do front (ADR 0006), sem `eval` e sem scripts de terceiros, e o token curto. `logout` e so do lado do cliente: o token vale ate expirar. Trocar o `UserDetailsService` em memoria por um repositorio habilita varios usuarios e papeis sem mudar o resto.

**Alternativas descartadas.** Cookie `HttpOnly` + `SameSite` (exigiria mesmo dominio ou configuracao de CORS com credenciais e protecao CSRF).
