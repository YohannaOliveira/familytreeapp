import { defineConfig, devices } from '@playwright/test'

// O e2e fala com um backend real (proxy do Vite: BACKEND_URL, padrao :8080) e um banco descartavel.
// Credenciais do admin de teste: E2E_USER / E2E_PASSWORD.
// O backend precisa ter CORS_ALLOWED_ORIGINS=http://localhost:<E2E_FRONT_PORT> (o proxy repassa o Origin).
const PORT = Number(process.env.E2E_FRONT_PORT ?? 5174)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
