import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env" });

/**
 * E2E de Ivonne & Rosa — usado por la skill e2e-quality-gate (.claude/skills/e2e-quality-gate).
 *
 * Servidor: build de PRODUCCIÓN en :3200 contra la base E2E (ivonne_rosa_e2e), re-sembrada en cada corrida
 * por tests/e2e/global-setup.ts. Nunca usa la base de desarrollo ni producción.
 *
 * Etiquetas (filtrar con --grep):
 *   prioridad  @P0 @P1 @P2 @P3      tipo   @smoke @critical @auth @permissions @negative @regression
 *   módulo     @module:<nombre>     ui     @mobile @responsive @a11y        infraestructura  @infra
 *
 * Variables:
 *   E2E_BASE_URL       usar un servidor ya levantado (sólo local; ver preflight de la skill)
 *   E2E_CROSS_BROWSER=1  agrega Firefox y WebKit (sólo pruebas @P0)
 *   E2E_WORKERS        paralelismo (default 2; las pruebas crean datos propios)
 *   E2E_RETRIES        reintentos (default 1: detecta pruebas inestables, reportadas como "flaky")
 *   E2E_LANE=N         carril aislado (1-9) para correr varias suites en paralelo sin pisarse:
 *                      puerto 3200+N, base <E2E_DATABASE_URL>_l<N>, sesiones .auth/l<N>/, resultados test-results/l<N>/.
 *                      Todos los carriles comparten el mismo build .next-e2e (sin código de app cambiando entre corridas).
 *   E2E_FIREFOX_EXECUTABLE  ruta a un Firefox de Playwright alterno (p. ej. si no arranca desde %LOCALAPPDATA%)
 *   E2E_SUITE          suites especiales que NO corren junto con el resto (se ejecutan en una invocación aparte, 1 worker):
 *                        global    → *.global.spec.ts (cambian ajustes/flags/reglas globales; restauran al terminar)
 *                        ratelimit → *.ratelimit.spec.ts (servidor CON rate limit; carril 9 por defecto)
 */
const SUITE = process.env.E2E_SUITE ?? "";
if (!["", "global", "ratelimit"].includes(SUITE)) throw new Error(`E2E_SUITE inválido: ${SUITE}`);
const LANE = Number(process.env.E2E_LANE ?? (SUITE === "ratelimit" ? 9 : 0));
if (!Number.isInteger(LANE) || LANE < 0 || LANE > 9) throw new Error(`E2E_LANE inválido: ${process.env.E2E_LANE}`);
// Idempotente: los workers vuelven a evaluar este archivo con el entorno ya ajustado.
process.env.E2E_DATABASE_URL_BASE ??= process.env.E2E_DATABASE_URL;
if (LANE > 0 && process.env.E2E_DATABASE_URL_BASE) {
  const u = new URL(process.env.E2E_DATABASE_URL_BASE);
  u.pathname = `${u.pathname}_l${LANE}`;
  process.env.E2E_DATABASE_URL = u.toString();
  process.env.E2E_PORT = String(3200 + LANE);
}
process.env.E2E_LANE = String(LANE); // fixtures (sesiones por carril) leen el mismo valor
const PORT = Number(process.env.E2E_PORT ?? 3200);
const OUT = [LANE > 0 ? `test-results/l${LANE}` : "test-results", SUITE].filter(Boolean).join("/");
const REPORT = [LANE > 0 ? `playwright-report/l${LANE}` : "playwright-report", SUITE].filter(Boolean).join("/");
const SPECIAL = /\.(global|ratelimit)\.spec\.ts$/;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const crossBrowser = process.env.E2E_CROSS_BROWSER === "1";

const common = {
  baseURL,
  locale: "es-MX",
  timezoneId: "America/Mexico_City",
  trace: "retain-on-failure" as const,
  screenshot: "only-on-failure" as const,
  video: "retain-on-failure" as const,
  actionTimeout: 15_000,
  navigationTimeout: 45_000,
};
const desktop = (device: string) => ({ ...devices[device], ...common, viewport: { width: 1440, height: 900 } });

function regularProjects() {
  const testIgnore = [/setup\//, SPECIAL];
  return [
    { name: "chromium", dependencies: ["setup"], testIgnore, use: desktop("Desktop Chrome") },
    {
      name: "mobile-chrome",
      dependencies: ["setup"],
      testIgnore,
      grep: /@mobile/,
      use: { ...devices["Pixel 7"], ...common, viewport: { width: 390, height: 844 } },
    },
    ...(crossBrowser
      ? [
          {
            name: "firefox",
            dependencies: ["setup"],
            testIgnore,
            grep: /@P0/,
            use: {
              ...desktop("Desktop Firefox"),
              ...(process.env.E2E_FIREFOX_EXECUTABLE ? { launchOptions: { executablePath: process.env.E2E_FIREFOX_EXECUTABLE } } : {}),
            },
          },
          { name: "webkit", dependencies: ["setup"], testIgnore, grep: /@P0/, use: desktop("Desktop Safari") },
        ]
      : []),
  ];
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `./${OUT}/artifacts`,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: SUITE ? 1 : Number(process.env.E2E_WORKERS ?? 2),
  retries: Number(process.env.E2E_RETRIES ?? 1),
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: REPORT }],
    ["json", { outputFile: `${OUT}/results.json` }],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: common,
  projects: [
    { name: "setup", testMatch: /setup\/.*\.setup\.ts/, use: { ...devices["Desktop Chrome"], ...common } },
    ...(SUITE
      ? [
          {
            name: `chromium-${SUITE}`,
            dependencies: ["setup"],
            testMatch: SUITE === "global" ? /\.global\.spec\.ts$/ : /\.ratelimit\.spec\.ts$/,
            use: desktop("Desktop Chrome"),
          },
        ]
      : regularProjects()),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/e2e-server.mjs",
        url: `${baseURL}/api/health`,
        timeout: 15 * 60_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
      },
});
