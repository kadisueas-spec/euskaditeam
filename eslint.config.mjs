import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker plano (contexto global self/clients, no pasa por
    // el bundler de Next ni sus reglas de módulos).
    "worker/**",
    // Supabase Edge Functions: runtime Deno, no TypeScript/ESLint de Next.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
