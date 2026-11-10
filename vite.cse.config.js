import { defineConfig } from "vite";
import { createProgrammeViteConfig } from "./vite.config.js";

// Legacy Vite entry point. Use npm run build:cse for a year-qualified filename.
export default defineConfig(() => createProgrammeViteConfig("cse", process.env.PROGRAM_YEAR));
