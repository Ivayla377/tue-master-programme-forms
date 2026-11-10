import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { getFormTarget } from "./programmes.mjs";

const [slug, year, ...extra] = process.argv.slice(2);
if (!slug || extra.length > 0) {
  throw new Error("Usage: node scripts/build-program.mjs <programme> [academic-year]");
}

const target = getFormTarget(slug, year);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distDirectory = resolve(projectRoot, "dist");

const intermediateOutput = resolve(distDirectory, target.input);
const finalOutput = resolve(projectRoot, target.output);
for (const path of [intermediateOutput, finalOutput]) {
  if (!path.startsWith(`${distDirectory}${sep}`)) {
    throw new Error(`Refusing to write outside dist: ${path}`);
  }
}

// Vite uses the shared entry filename. Only a successful build is renamed.
rmSync(intermediateOutput, { force: true });
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const build = spawnSync(process.execPath, [viteBin, "build"], {
  cwd: projectRoot,
  env: { ...process.env, PROGRAM_FORM: slug, PROGRAM_YEAR: target.year },
  stdio: "inherit",
});

if (build.error) throw build.error;
if (build.status !== 0) {
  process.exitCode = build.status ?? 1;
} else {
  if (!existsSync(intermediateOutput)) {
    throw new Error(`Vite did not produce ${intermediateOutput}.`);
  }
  renameSync(intermediateOutput, finalOutput);
  console.log(`Built ${slug} ${target.year}: ${target.output}`);
}
