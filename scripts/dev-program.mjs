import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getFormTarget } from "./programmes.mjs";

const [slug = "dsai", year, ...extra] = process.argv.slice(2);
if (extra.length > 0) {
  throw new Error("Usage: node scripts/dev-program.mjs [programme] [academic-year]");
}
const target = getFormTarget(slug, year);
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
console.log(`Editing ${slug} ${target.year}. Open /${target.input} at the local server URL.`);
const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env: { ...process.env, PROGRAM_FORM: slug, PROGRAM_YEAR: target.year },
  stdio: "inherit",
});
server.on("error", (error) => { throw error; });
server.on("exit", (code) => { process.exitCode = code ?? 1; });
