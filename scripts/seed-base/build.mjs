#!/usr/bin/env node
/**
 * Empaqueta prisma/seed.ts en un único archivo CommonJS (dist/seed.cjs) para poder
 * correr el seed BASE dentro del contenedor de producción, donde no existen tsx ni
 * TypeScript (la imagen sólo trae `node`).
 *
 *   node scripts/seed-base/build.mjs                 → dist/seed.cjs
 *   node scripts/seed-base/build.mjs --outfile x.cjs → ruta personalizada
 *
 * En el contenedor:  node dist/seed.cjs --base   (o: docker-entrypoint.sh seed-base)
 *
 * Usa el esbuild que ya instala tsx (no agrega dependencias). @prisma/client queda
 * como dependencia externa: se resuelve desde /app/node_modules (salida standalone).
 */
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(path.join(root, "package.json"));

/** Paquetes que NO se incluyen en el bundle (dependen de binarios / cliente generado). */
export const SEED_EXTERNALS = ["@prisma/client", ".prisma/client"];

function loadEsbuild() {
  try {
    return require("esbuild");
  } catch {
    // pnpm no expone esbuild en la raíz: se toma el que trae tsx como dependencia.
    const tsxPkg = realpathSync(require.resolve("tsx/package.json"));
    return createRequire(tsxPkg)("esbuild");
  }
}

/** Plugin: "server-only" es un guard de Next.js; fuera de Next se reemplaza por un módulo vacío. */
const serverOnlyStub = {
  name: "server-only-stub",
  setup(build) {
    build.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "", loader: "js" }));
  },
};

export async function bundleSeed({ outfile = path.join(root, "dist", "seed.cjs"), quiet = false } = {}) {
  const esbuild = loadEsbuild();
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "prisma", "seed.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: SEED_EXTERNALS,
    tsconfig: path.join(root, "tsconfig.json"),
    plugins: [serverOnlyStub],
    legalComments: "none",
    sourcemap: false,
    minify: false,
    logLevel: quiet ? "silent" : "warning",
    metafile: true,
    banner: {
      js: "/* Generado por scripts/seed-base/build.mjs desde prisma/seed.ts — no editar. */",
    },
  });
  const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
  return { outfile, bytes, warnings: result.warnings.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--outfile");
  const outfile = idx >= 0 && args[idx + 1] ? path.resolve(args[idx + 1]) : undefined;
  bundleSeed({ outfile })
    .then(({ outfile: out, bytes }) => {
      console.log(
        `[seed-base] Seed empaquetado en ${path.relative(root, out)} (${(bytes / 1024).toFixed(0)} KB).`,
      );
    })
    .catch((error) => {
      console.error("[seed-base] No se pudo empaquetar prisma/seed.ts:", error?.message ?? error);
      process.exit(1);
    });
}
