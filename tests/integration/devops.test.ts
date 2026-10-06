/**
 * DevOps — pruebas de integración de lo que hace posible desplegar y operar la plataforma:
 * health/readiness, migraciones aplicadas, seed BASE empaquetable para el contenedor,
 * scripts de preparación (db-setup / storage-init), retención de respaldos y contratos
 * del Dockerfile / entrypoint / .dockerignore.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/db";
import { GET as healthGET } from "@/app/api/health/route";
import { GET as healthDbGET } from "@/app/api/health/db/route";
import {
  isLocalHost,
  maskUrl,
  parseArgs,
  parseDatabaseUrl,
  probePostgres,
  servicesToStart,
} from "../../scripts/db-setup.mjs";
import { bundleSeed } from "../../scripts/seed-base/build.mjs";
import { describeError, planStorageInit } from "../../scripts/storage-init";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const tmpDirs: string[] = [];
const makeTmp = (prefix: string) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
};
const hasBash = (() => {
  const r = spawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" });
  return !r.error && r.stdout.trim() === "ok";
})();
/** Ruta apta para bash (en Windows/Git Bash "C:/x/y" funciona; "C:\x\y" no siempre). */
const bashPath = (p: string) => p.replace(/\\/g, "/");

afterAll(async () => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------------------------
describe("health endpoints", () => {
  it("GET /api/health responde {status:'ok'} sin caché (liveness para Docker/Dokploy)", async () => {
    const res = healthGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("GET /api/health/db confirma que PostgreSQL responde (readiness)", async () => {
    const res = await healthDbGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", database: "up" });
    expect(typeof body.latencyMs).toBe("number");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

// ---------------------------------------------------------------------------------------------
describe("migraciones (prisma migrate deploy)", () => {
  type MigrationRow = {
    migration_name: string;
    checksum: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  };

  it("todas las migraciones del repo están aplicadas, sin fallas ni rollbacks, y no fueron editadas", async () => {
    const dirs = readdirSync(path.join(ROOT, "prisma", "migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs.length).toBeGreaterThan(0);

    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    const failed = rows.filter((r) => r.finished_at === null && r.rolled_back_at === null);
    expect(failed.map((r) => r.migration_name)).toEqual([]);

    for (const dir of dirs) {
      const applied = rows.find((r) => r.migration_name === dir && r.finished_at && !r.rolled_back_at);
      expect(applied, `migración ${dir} no aplicada (corre pnpm test:integration:prepare)`).toBeTruthy();
      // Una migración editada después de aplicarse rompe `migrate deploy` en producción.
      const sql = readFileSync(path.join(ROOT, "prisma", "migrations", dir, "migration.sql"));
      const sums = [sql, Buffer.from(sql.toString("utf8").replace(/\r\n/g, "\n"))].map((b) =>
        createHash("sha256").update(b).digest("hex"),
      );
      expect(sums, `la migración ${dir} cambió después de aplicarse`).toContain(applied!.checksum);
    }
  });

  it("migration_lock.toml fija el proveedor postgresql", () => {
    expect(read("prisma/migrations/migration_lock.toml")).toMatch(/provider\s*=\s*"postgresql"/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("seed BASE empaquetado para el contenedor (dist/seed.cjs)", () => {
  it("prisma/seed.ts se empaqueta en un solo CJS con @prisma/client externo y sin alias @/", async () => {
    const outfile = path.join(makeTmp("ir-seed-"), "seed.cjs");
    const result = await bundleSeed({ outfile, quiet: true });
    expect(existsSync(outfile)).toBe(true);
    expect(result.bytes).toBeGreaterThan(20_000);
    const code = readFileSync(outfile, "utf8");
    expect(code).toContain('require("@prisma/client")');
    expect(code).not.toMatch(/require\("@\//);
    expect(code).not.toMatch(/require\("(tsx|typescript|zod|bcryptjs|date-fns)"\)/); // incluidas en el bundle
    expect(code).toContain("--base");
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
describe("scripts/db-setup.mjs (helpers)", () => {
  it("parseArgs interpreta banderas y valida combinaciones", () => {
    expect(parseArgs([])).toMatchObject({ skipSeed: false, skipDocker: false, waitSeconds: 60 });
    expect(parseArgs(["--skip-seed", "--skip-docker", "--wait", "15"])).toMatchObject({
      skipSeed: true,
      skipDocker: true,
      waitSeconds: 15,
    });
    expect(parseArgs(["--wait=30", "--seed-base", "--skip-storage", "--skip-test-db"])).toMatchObject({
      waitSeconds: 30,
      seedBase: true,
      skipStorage: true,
      skipTestDb: true,
    });
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(() => parseArgs(["--nope"])).toThrow(/desconocida/);
    expect(() => parseArgs(["--wait", "abc"])).toThrow(/segundos/);
    expect(() => parseArgs(["--wait", "0"])).toThrow(/segundos/);
    expect(() => parseArgs(["--skip-seed", "--seed-base"])).toThrow(/juntas/);
  });

  it("parseDatabaseUrl / isLocalHost / maskUrl", () => {
    expect(parseDatabaseUrl("postgresql://ivonne:pw@localhost:5432/ivonne_rosa?schema=public")).toEqual({
      host: "localhost",
      port: 5432,
      database: "ivonne_rosa",
      user: "ivonne",
    });
    expect(parseDatabaseUrl("postgres://u:p@db.internal/prod")).toMatchObject({
      host: "db.internal",
      port: 5432,
    });
    expect(parseDatabaseUrl("postgresql://u:p@[::1]:6543/x")).toMatchObject({ host: "::1", port: 6543 });
    expect(parseDatabaseUrl("mysql://u:p@localhost/x")).toBeNull();
    expect(parseDatabaseUrl("no es url")).toBeNull();
    expect(parseDatabaseUrl(undefined)).toBeNull();

    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("127.0.0.1")).toBe(true);
    expect(isLocalHost("::1")).toBe(true);
    expect(isLocalHost("db.ivonne-rosa.internal")).toBe(false);

    const masked = maskUrl("postgresql://ivonne:supersecreto@localhost:5432/db");
    expect(masked).not.toContain("supersecreto");
    expect(masked).toContain("****");
    expect(maskUrl("::::")).toBe("(URL inválida)");
  });

  it("servicesToStart sólo levanta contenedores para servicios locales", () => {
    const local = {
      DATABASE_URL: "postgresql://a:b@localhost:5432/x",
      STORAGE_DRIVER: "s3",
      STORAGE_ENDPOINT: "http://localhost:9000",
    };
    expect(servicesToStart(local)).toEqual(["db", "storage"]);
    expect(servicesToStart({ ...local, STORAGE_DRIVER: "local" })).toEqual(["db"]);
    expect(servicesToStart({ ...local, STORAGE_ENDPOINT: "https://nyc3.digitaloceanspaces.com" })).toEqual([
      "db",
    ]);
    expect(servicesToStart({ ...local, DATABASE_URL: "postgresql://a:b@db.example.com/x" })).toEqual([
      "storage",
    ]);
    expect(servicesToStart({})).toEqual([]);
  });

  it("probePostgres distingue PostgreSQL real de un puerto abierto que no es Postgres", async () => {
    const db = parseDatabaseUrl(process.env.TEST_DATABASE_URL);
    expect(db).not.toBeNull();
    expect(await probePostgres(db!.host, db!.port)).toBe(true);

    // Servidor TCP que acepta y cierra (como docker-proxy antes de que el contenedor escuche)
    const fake = net.createServer((socket) => socket.destroy());
    await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
    const port = (fake.address() as net.AddressInfo).port;
    try {
      expect(await probePostgres("127.0.0.1", port, 1500)).toBe(false);
    } finally {
      await new Promise((resolve) => fake.close(resolve));
    }
    // Puerto cerrado
    expect(await probePostgres("127.0.0.1", port, 1500)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe("scripts/storage-init.ts (plan)", () => {
  it("omite el bucket con STORAGE_DRIVER=local o sin credenciales", () => {
    expect(planStorageInit({ STORAGE_DRIVER: "local" })).toMatchObject({ kind: "skip" });
    expect(planStorageInit({ STORAGE_DRIVER: "s3" })).toMatchObject({ kind: "skip" });
    expect(
      planStorageInit({ STORAGE_DRIVER: "ftp", STORAGE_ACCESS_KEY: "a", STORAGE_SECRET_KEY: "b" }),
    ).toMatchObject({ kind: "skip" });
  });

  it("arma la configuración S3 con defaults y path-style", () => {
    const plan = planStorageInit({
      STORAGE_ACCESS_KEY: "key",
      STORAGE_SECRET_KEY: "secret",
      STORAGE_ENDPOINT: "http://localhost:9000",
      STORAGE_FORCE_PATH_STYLE: "true",
      STORAGE_BUCKET: " ivonne-rosa ",
    });
    expect(plan).toMatchObject({
      kind: "s3",
      config: {
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "ivonne-rosa",
        accessKeyId: "key",
        secretAccessKey: "secret",
        forcePathStyle: true,
      },
    });
    const aws = planStorageInit({
      STORAGE_ACCESS_KEY: "k",
      STORAGE_SECRET_KEY: "s",
      STORAGE_REGION: "us-west-2",
    });
    expect(aws).toMatchObject({ kind: "s3", config: { endpoint: undefined, forcePathStyle: false } });
  });

  it("describeError da un mensaje útil incluso para AggregateError de red", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED ::1:9555"), { code: "ECONNREFUSED" });
    const agg = Object.assign(new AggregateError([refused], ""), { code: "ECONNREFUSED" });
    expect(describeError(agg)).toBe("ECONNREFUSED · connect ECONNREFUSED ::1:9555");
    expect(describeError("texto")).toBe("texto");
    expect(describeError({})).toBe("error desconocido");
  });
});

// ---------------------------------------------------------------------------------------------
describe.skipIf(!hasBash)("scripts/backup/pg-backup.sh (retención GFS)", () => {
  const script = "scripts/backup/pg-backup.sh";

  /** Crea un respaldo diario 09:15Z desde 2026-01-01 por `days` días (+ .sha256). */
  function fixtures(days: number) {
    const dir = makeTmp("ir-backups-");
    for (let i = 0; i < days; i++) {
      const key = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10).replace(/-/g, "");
      writeFileSync(path.join(dir, `ivonne-rosa_${key}T091500Z.dump`), "x");
      writeFileSync(path.join(dir, `ivonne-rosa_${key}T091500Z.dump.sha256`), "x");
    }
    writeFileSync(path.join(dir, "ivonne-rosa_20261001T210000Z.dump"), "x"); // 2º respaldo del mismo día
    writeFileSync(path.join(dir, "ivonne-rosa_bad.dump"), "x"); // fuera de formato: se ignora
    writeFileSync(path.join(dir, "otra-app_20260101T000000Z.dump"), "x"); // otro prefijo: no se toca
    return dir;
  }
  const runPrune = (dir: string, extra: string[] = [], env: Record<string, string> = {}) =>
    spawnSync("bash", [script, "--prune-only", ...extra], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, BACKUP_DIR: bashPath(dir), ...env },
    });
  const dumps = (dir: string) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".dump"))
      .sort();

  it("conserva 7 diarios + 4 semanales + 6 mensuales (el más reciente de cada periodo)", () => {
    const dir = fixtures(274); // 2026-01-01 … 2026-10-01
    const r = runPrune(dir);
    expect(r.status, r.stderr).toBe(0);
    expect(dumps(dir)).toEqual(
      [
        // mensuales (el último respaldo de cada mes)
        "ivonne-rosa_20260531T091500Z.dump",
        "ivonne-rosa_20260630T091500Z.dump",
        "ivonne-rosa_20260731T091500Z.dump",
        "ivonne-rosa_20260831T091500Z.dump",
        // semanales (domingos de las semanas ISO 37 y 38; 39 y 40 ya están entre los diarios)
        "ivonne-rosa_20260913T091500Z.dump",
        "ivonne-rosa_20260920T091500Z.dump",
        // diarios (últimos 7 días; del 1 de octubre se conserva sólo el más reciente)
        "ivonne-rosa_20260925T091500Z.dump",
        "ivonne-rosa_20260926T091500Z.dump",
        "ivonne-rosa_20260927T091500Z.dump",
        "ivonne-rosa_20260928T091500Z.dump",
        "ivonne-rosa_20260929T091500Z.dump",
        "ivonne-rosa_20260930T091500Z.dump",
        "ivonne-rosa_20261001T210000Z.dump",
        "ivonne-rosa_bad.dump",
        "otra-app_20260101T000000Z.dump",
      ].sort(),
    );
    // Los .sha256 de los eliminados también se borran
    const sums = readdirSync(dir).filter((f) => f.endsWith(".sha256"));
    expect(sums).toHaveLength(12);
    expect(r.stdout).toMatch(/conservados 13, eliminados 262/);
  });

  it("--dry-run no borra nada", () => {
    const dir = fixtures(40);
    const before = readdirSync(dir).length;
    const r = runPrune(dir, ["--dry-run"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/DELETE /);
    expect(r.stdout).toMatch(/dry-run/);
    expect(readdirSync(dir)).toHaveLength(before);
  });

  it("rechaza una retención 0/0/0 y opciones desconocidas", () => {
    const dir = fixtures(3);
    const zero = runPrune(dir, [], {
      BACKUP_KEEP_DAILY: "0",
      BACKUP_KEEP_WEEKLY: "0",
      BACKUP_KEEP_MONTHLY: "0",
    });
    expect(zero.status).not.toBe(0);
    expect(dumps(dir).length).toBe(6);
    const bad = runPrune(dir, ["--borrar-todo"]);
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toMatch(/opción desconocida/);
  });

  it("iso_week (bash puro) coincide con la semana ISO-8601 calculada en JS", () => {
    const src = read(script);
    const fns = ["_weeks_in_year", "iso_week"].map((name) => {
      const m = src.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}$`, "m"));
      expect(m, `no se encontró ${name} en ${script}`).toBeTruthy();
      return m![0];
    });
    const isoWeek = (d: Date) => {
      const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = t.getUTCDay() || 7;
      t.setUTCDate(t.getUTCDate() + 4 - day);
      const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
      const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
      return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    };
    const dates: Date[] = [];
    for (let y = 1999; y <= 2040; y++) {
      for (const [m, d] of [
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [1, 28],
        [1, 29],
        [2, 1],
        [5, 30],
        [11, 28],
        [11, 29],
        [11, 30],
        [11, 31],
      ]) {
        const dt = new Date(Date.UTC(y, m!, d!));
        if (dt.getUTCMonth() === m) dates.push(dt);
      }
    }
    const input = dates.map((d) => d.toISOString().slice(0, 10).replace(/-/g, " ")).join("\n");
    const program = `${fns.join("\n")}\nwhile read -r y m d; do iso_week "$y" "$m" "$d"; echo "$ISO_WEEK"; done`;
    const r = spawnSync("bash", ["-c", program], { input: `${input}\n`, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim().split(/\r?\n/)).toEqual(dates.map(isoWeek));
  });
});

// ---------------------------------------------------------------------------------------------
describe("contratos de la imagen Docker", () => {
  const shellScripts = [
    "scripts/docker-entrypoint.sh",
    "scripts/backup/pg-backup.sh",
    "scripts/backup/pg-restore.sh",
  ];

  it("los scripts .sh usan LF, tienen shebang y sintaxis válida", () => {
    for (const rel of shellScripts) {
      const content = read(rel);
      expect(content.includes("\r"), `${rel} tiene CRLF`).toBe(false);
      expect(content.startsWith("#!/"), `${rel} sin shebang`).toBe(true);
      if (hasBash) {
        const r = spawnSync("bash", ["-n", rel], { cwd: ROOT, encoding: "utf8" });
        expect(r.status, `${rel}: ${r.stderr}`).toBe(0);
      }
    }
  });

  it("el entrypoint aplica migraciones salvo RUN_MIGRATIONS=false y termina con exec node server.js", () => {
    const sh = read("scripts/docker-entrypoint.sh");
    expect(sh).toMatch(/^set -eu$/m);
    expect(sh).toContain('"${RUN_MIGRATIONS:-true}" != "false"');
    expect(sh).toContain("prisma migrate deploy");
    expect(sh).toMatch(/exec node server\.js/);
    expect(sh).toContain("dist/seed.cjs");
  });

  it("Dockerfile: multi-stage, no-root, healthcheck con node, puerto 3000 y entrypoint", () => {
    const df = read("Dockerfile");
    expect(df).toMatch(/FROM node:\$\{NODE_VERSION\}-bookworm-slim AS base/);
    for (const stage of ["deps", "builder", "prisma-cli", "runner"])
      expect(df).toMatch(new RegExp(` AS ${stage}\\b`));
    expect(df).toMatch(/ARG PNPM_VERSION=9\.15\.9/);
    expect(df).toMatch(/ARG PRISMA_VERSION=6\.19\.3/);
    expect(df).toContain("pnpm install --frozen-lockfile");
    expect(df).toMatch(/useradd [^\n]*--uid 1001/);
    expect(df).toMatch(/^USER nextjs$/m);
    expect(df).toMatch(/^EXPOSE 3000$/m);
    expect(df).toMatch(/HOSTNAME=0\.0\.0\.0/);
    expect(df).toMatch(/HEALTHCHECK[\s\S]*node[\s\S]*\/api\/health/);
    expect(df).not.toMatch(/HEALTHCHECK[^\n]*curl/);
    expect(df).toContain("docker-entrypoint.sh");
    expect(df).toContain(".next/standalone");
    expect(df).toContain("prisma/migrations");
    // Nunca secretos reales ni .env dentro de la imagen
    expect(df).not.toMatch(/COPY[^\n]*\.env/);
    // La versión de pnpm del Dockerfile coincide con package.json
    const pkg = JSON.parse(read("package.json")) as {
      packageManager: string;
      devDependencies: Record<string, string>;
    };
    expect(pkg.packageManager).toBe("pnpm@9.15.9");
    expect(pkg.devDependencies.prisma).toBe("6.19.3");
  });

  it(".dockerignore excluye secretos, dependencias, builds locales y datos", () => {
    const lines = read(".dockerignore")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    for (const entry of [
      ".env",
      ".env.*",
      "node_modules",
      ".next",
      ".next-*",
      ".git",
      ".logs",
      ".uploads",
      "tests",
    ]) {
      expect(lines, `falta ${entry}`).toContain(entry);
    }
  });

  it("la salida standalone está habilitada en next.config.ts", () => {
    // Por defecto "standalone" (Docker/Dokploy); sólo NEXT_STANDALONE=false la desactiva (servidor E2E local en Windows).
    expect(read("next.config.ts")).toMatch(/output:\s*process\.env\.NEXT_STANDALONE === "false" \? undefined : "standalone"/);
    expect(read("Dockerfile")).not.toMatch(/NEXT_STANDALONE\s*=\s*"?false/);
  });

  it(".nvmrc fija Node 22 (igual que la imagen)", () => {
    expect(read(".nvmrc").trim()).toBe("22");
    expect(statSync(path.join(ROOT, "docker-compose.prod.yml")).isFile()).toBe(true);
  });
});
