import { defineConfig, devices } from "@playwright/test";
import { resolveTestDatabaseUrl } from "./e2e/test-db";

// Quando rodamos contra um servidor já de pé (E2E_BASE_URL setado, ex.:
// scripts/pre-deploy.sh), o próprio script já resolveu/validou o banco de
// teste e exportou DATABASE_URL apontando para ele — então não gerenciamos
// `webServer` aqui. Quando rodamos standalone (`pnpm run test:e2e`), nós
// subimos o dev server e PRECISAMOS garantir que ele aponte para o banco de
// teste isolado, nunca para a produção. `resolveTestDatabaseUrl()` valida a
// configuração e lança um erro claro (host de produção, banco igual ao de
// produção, ou configuração ausente) antes de qualquer teste rodar.
const useExternalServer = !!process.env.E2E_BASE_URL;
const testDatabaseUrl = resolveTestDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "pnpm run dev",
        url: "http://localhost:5000",
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
        // Força o dev server da suíte a usar o banco de teste isolado em vez
        // da DATABASE_URL herdada do ambiente (que em produção/build seria o
        // banco de produção). DEV_FIXTURES=1 registra os endpoints /api/dev-*.
        env: {
          ...process.env,
          DATABASE_URL: testDatabaseUrl,
          DATABASE_URL_TEST: testDatabaseUrl,
          DEV_FIXTURES: "1",
          // Stub determinístico da geocodificação (server/_core/geocode.ts):
          // o backfill de coordenadas devolve estas coords fixas sem bater na
          // Google Geocoding API. Honrado SOMENTE com DEV_FIXTURES=1.
          GEOCODE_STUB_LATLNG: "-23.55052,-46.633308",
        },
      },
  projects: [
    // Roda uma única vez antes da suite: aquece o servidor + grava o
    // storageState do anunciante em `.auth/anunciante.json`. Specs que
    // precisam navegar autenticados consomem o arquivo via
    // `test.use({ storageState: ANUNCIANTE_AUTH_FILE })`.
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
      timeout: 180_000,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
