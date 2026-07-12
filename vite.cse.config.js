import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Legacy compatibility entry point. Prefer: npm run build:cse
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: "cse.html",
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
