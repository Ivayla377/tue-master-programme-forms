import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { formYears, programmes, validateFormYear } from "./programmes.mjs";

const requestedYears = process.argv.slice(2);
const years = requestedYears.length > 0 ? requestedYears.map(validateFormYear) : formYears;
const buildScript = fileURLToPath(new URL("./build-program.mjs", import.meta.url));

// Sequential builds share Vite's intermediate filenames.
for (const year of years) {
  for (const slug of Object.keys(programmes)) {
    const build = spawnSync(process.execPath, [buildScript, slug, year], { stdio: "inherit" });
    if (build.error) throw build.error;
    if (build.status !== 0) process.exit(build.status ?? 1);
  }
}
