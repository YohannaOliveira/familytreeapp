# 0005. Fotos: upload direto ao R2 por URL pre-assinada

**Contexto.** A hospedagem gratuita da API tem pouca memoria e banda; receber imagens por ela e caro e arriscado.

**Decisao.** A API so assina: `POST /photos/upload-url` valida tipo (`webp`, `jpeg`, `png`) e tamanho (padrao 200 KB) e devolve uma URL pre-assinada de curta duracao e uma `photoKey`. O navegador envia o arquivo direto ao Cloudflare R2 e depois associa a chave com `PUT /people/{id}/photo`. O front redimensiona a imagem (lado maximo de 400 px) antes de enviar. A foto e opcional: sem as variaveis `R2_*` a API responde 503 `PHOTOS_NOT_CONFIGURED` nas rotas de foto e o resto funciona.

**Consequencias.** O bucket precisa de CORS para a origem do front e de leitura publica (`R2_PUBLIC_BASE_URL`), entao o `img-src` da CSP precisa permitir esse dominio. Fotos orfas (upload sem associar) podem sobrar no bucket; uma regra de expiracao no R2 resolve.

**Alternativas descartadas.** Guardar a imagem no Postgres (infla o banco gratuito); proxy pela API (consome memoria e banda).
