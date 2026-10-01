import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env" });

const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * E2E contra un build de producción servido con la base E2E (re-sembrada en globalSetup).
 *   pnpm test:e2e            -> construye (si hace falta), levanta en :3200 y corre los flujos
 *   E2E_BASE_URL=... pnpm test:e2e -> corre contra un servidor ya levantado
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/e2e-server.mjs",
        url: `${baseURL}/api/health`,
        timeout: 15 * 60_000,
        reuseExistingServer: true,
        stdout: "pipe",
        stderr: "pipe",
      },
});
