import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Este arquivo roda no Node; evita puxar @types/node para o tsconfig do app inteiro.
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': process.env.BACKEND_URL ?? 'http://localhost:8080',
      '/auth': process.env.BACKEND_URL ?? 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
