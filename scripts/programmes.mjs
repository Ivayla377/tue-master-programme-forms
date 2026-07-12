export const programmes = {
  dsai: {
    input: "dsai.html",
    output: "dist/dsai.html",
    emptyOutDir: false,
    removeBeforeBuild: ["dist/index.html"],
  },
  cse: {
    input: "cse.html",
    output: "dist/cse.html",
    emptyOutDir: false,
  },
};

export function getProgramme(slug) {
  const programme = programmes[slug];
  if (!programme) {
    throw new Error(`Unknown programme \"${slug}\". Available programmes: ${Object.keys(programmes).join(", ")}.`);
  }
  return programme;
}
