import { z } from 'zod'

// A CSP (frontend/public/_headers) nao permite eval; sem isto o zod tenta `new Function` e gera uma violacao de CSP
// a cada carga. Importar este modulo ANTES dos que criam schemas (ver main.tsx).
z.config({ jitless: true })
