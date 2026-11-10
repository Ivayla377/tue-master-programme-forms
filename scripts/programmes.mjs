// Every registered programme has an independently editable definition per year.
export const programmes = {
  dsai: { input: "dsai.html" },
  cse: { input: "cse.html" },
  es: { input: "es.html" },
  iam: { input: "iam.html" },
  cybr: { input: "cybr.html" },
};

export const formYears = ["2025-2026", "2026-2027"];
// Keep the package.json #forms/* fallback aligned with this default.
export const DEFAULT_FORM_YEAR = "2025-2026";

export function getProgramme(slug) {
  if (!Object.hasOwn(programmes, slug)) {
    throw new Error(`Unknown programme \"${slug}\". Available programmes: ${Object.keys(programmes).join(", ")}.`);
  }
  return programmes[slug];
}

export function validateFormYear(year) {
  if (!formYears.includes(year)) {
    throw new Error(`Unknown academic year "${year}". Available years: ${formYears.join(", ")}.`);
  }
  return year;
}

export function getFormTarget(slug, year = DEFAULT_FORM_YEAR) {
  const programme = getProgramme(slug);
  validateFormYear(year);
  return {
    slug,
    year,
    input: programme.input,
    definition: `forms/${slug}/${year}/form.json`,
    output: `dist/${slug}-${year}.html`,
  };
}
