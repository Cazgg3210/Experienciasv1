import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Playwright: el parámetro `use` de los fixtures no es un hook de React.
    files: ["tests/e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-*/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      ".logs/**",
      ".tsbuild/**",
      ".uploads/**",
      "dist/**",
      "backups/**",
      ".claude/worktrees/**",
      "test-results/**",
      "test-results/**",
      "next-env.d.ts",
      "src/components/ui/**",
    ],
  },
];

export default eslintConfig;
