import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { getProgramme } from "./scripts/programmes.mjs";

export default defineConfig(() => {
  const programme = getProgramme(process.env.PROGRAM_FORM ?? "dsai");

  return {
    base: "./",
    plugins: [viteSingleFile({ removeViteModuleLoader: true })],
    build: {
      target: "es2020",
      outDir: "dist",
      emptyOutDir: programme.emptyOutDir,
      cssCodeSplit: false,
      assetsInlineLimit: 100000000,
      rollupOptions: {
        input: programme.input,
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  };
});
