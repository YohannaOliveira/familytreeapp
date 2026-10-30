# 0006. Hospedagem gratuita e headers de seguranca do front

**Contexto.** Projeto familiar, sem orcamento: front estatico, API Java e Postgres precisam caber em planos gratuitos.

**Decisao.** Front no Cloudflare Pages, API no Render, banco no Neon (Postgres 16) e fotos no Cloudflare R2. As credenciais ficam so em variaveis de ambiente (ver `.env.example`).

O front define seus proprios headers em `frontend/public/_headers` (o Pages os aplica): CSP restritiva (`script-src 'self'`, sem `eval`, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS e cache imutavel em `/assets`. A API tem os seus (HSTS, nosniff, frame deny, CSP `default-src 'none'`, `no-store`). O `zod` roda em modo `jitless` para nao tentar `new Function` sob a CSP.

**Pendente (M14).** `connect-src 'self' https:` e `img-src ... https:` estao amplos porque os dominios da API e do R2 ainda nao existem; ao fazer o deploy, troque `https:` pelos dominios reais e ajuste `CORS_ALLOWED_ORIGINS` na API.

**Consequencias.** O plano gratuito do Render hiberna a API: a primeira requisicao apos inatividade e lenta (o front mostra "Carregando…"). `FORWARD_HEADERS_STRATEGY=native` e necessario atras do proxy do Render para o rate limit enxergar o IP real.
