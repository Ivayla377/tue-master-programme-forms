import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { getProgramme } from "./programmes.mjs";

const slug = process.argv[2];
if (!slug) {
  throw new Error("Usage: node scripts/build-program.mjs <programme-slug>");
}

const programme = getProgramme(slug);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distDirectory = resolve(projectRoot, "dist");

for (const relativePath of programme.removeBeforeBuild ?? []) {
  const staleOutput = resolve(projectRoot, relativePath);
  if (!staleOutput.startsWith(`${distDirectory}${sep}`)) {
    throw new Error(`Refusing to remove a file outside dist: ${relativePath}`);
  }
  rmSync(staleOutput, { force: true });
}

const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const child = spawn(process.execPath, [viteBin, "build"], {
  env: { ...process.env, PROGRAM_FORM: slug },
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
