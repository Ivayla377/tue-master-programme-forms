import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { DEFAULT_FORM_YEAR, getFormTarget, programmes } from "./scripts/programmes.mjs";
import { readProgrammeFormMetadata } from "./src/shared/form-metadata.js";

export function createProgrammeViteConfig(slug, year = DEFAULT_FORM_YEAR) {
  const target = getFormTarget(slug, year);
  const definition = JSON.parse(readFileSync(new URL(target.definition, import.meta.url), "utf8"));
  if (readProgrammeFormMetadata(definition).academicYear !== year) {
    throw new Error(`${target.definition}: programme_academic_year must match ${year}.`);
  }

  return {
    base: "./",
    plugins: [viteSingleFile({ removeViteModuleLoader: true })],
    resolve: {
      // Resolve before programme modules load, including their derived defaults.
      alias: Object.fromEntries(Object.keys(programmes).map((programme) => [
        `#forms/${programme}`,
        fileURLToPath(new URL(getFormTarget(programme, year).definition, import.meta.url)),
      ])),
    },
    build: {
      target: "es2020",
      outDir: "dist",
      emptyOutDir: false,
      cssCodeSplit: false,
      assetsInlineLimit: 100000000,
      rollupOptions: {
        input: target.input,
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  };
}

export default defineConfig(() => createProgrammeViteConfig(
  process.env.PROGRAM_FORM ?? "dsai",
  process.env.PROGRAM_YEAR ?? DEFAULT_FORM_YEAR,
));
