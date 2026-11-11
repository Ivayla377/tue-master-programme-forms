# TU/e Program of Examinations Forms

Fillable TU/e master's-program forms with live ECTS calculations, program-rule checks and a printable (PDF) summary for the examination committee.

## Use a form

No installation is needed to fill in a form. Download the program form, then open the downloaded HTML file in a browser such as Microsoft Edge, Google Chrome or Firefox.

**Download 2026-2027 AY forms**
- [Download the DS&AI form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/dsai-2026-2027.html)
- [Download the CSE form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/cse-2026-2027.html)
- [Download the ES form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/es-2026-2027.html)
- [Download the IAM form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/iam-2026-2027.html)
- [Download the CYBR form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/cybr-2026-2027.html)

**Download 2025-2026 AY forms**
- [Download the DS&AI form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/dsai-2025-2026.html)
- [Download the CSE form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/cse-2025-2026.html)
- [Download the ES form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/es-2025-2026.html)
- [Download the IAM form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/iam-2025-2026.html)
- [Download the CYBR form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/cybr-2025-2026.html)

The forms work offline after download.

1. Complete the form section by section. The ECTS panel checks credits and program requirements as you work.
2. Continue to the final **Review and print** page.
3. Review the selected courses, ECTS subtotals and validation results.
4. Select **Print / Save as PDF**. In the browser print dialog, choose **Save as PDF** and turn off **Headers and footers** before saving.
5. Choose where to save the PDF. This is the summary document to upload or share with the university when requested.

## Developer guide

The forms use [SurveyJS](https://surveyjs.io/) and Vite. Each program is bundled into one standalone HTML file that works offline.

### Requirements

- Node.js 20.19 or newer
- npm

### Install dependencies

```bash
npm install
```

### Maintain a program

Each program and academic year has one complete
`forms/<programme>/<year>/form.json`. This JSON is the primary source for the form
layout, questions, course choices, fixed course metadata, calculated credits and
editable program thresholds. Each file can be imported into (and exported from)
the free hosted SurveyJS Creator visual editor.

Supported years: **2025-2026** (default) and **2026-2027**. All five 2026-2027
forms use the new PER.

When updating a program:

1. Edit the intended year's `form.json`, preferably through SurveyJS Creator, while preserving stable question names and course-code values.
2. Keep course labels in the form `CODE Title (N ECTS)` so the shared code can read their credits.
3. Use `src/programmes/<programme>/` only for academic logic or report rendering that SurveyJS expressions cannot express clearly.
4. Put mechanics shared by several programs in `src/shared/` rather than copying them.
5. Rebuild the affected standalone form and check its final review and printable report.

Run a form locally while editing with:

```bash
npm run dev -- es 2026-2027
```

Replace `es` with `dsai`, `cse`, `iam` or `cybr` as needed. Open `/<programme>.html`
at the printed server URL. Restart to change years. Without arguments, `npm run dev`
uses DS&AI 2025-2026.

### Build standalone forms

```bash
npm run build:program -- es 2026-2027   # One form
npm run build:all -- 2026-2027          # All five forms for one year
npm run build:all                      # All forms for both years
```

Output: `dist/<programme>-<year>.html`, ready to open offline. Run build commands
one at a time; other programme/year outputs are preserved.

## Project structure

```text
dist/                         # <programme>-<year>.html standalone forms
forms/
  dsai/                       # Also cse/, es/, iam/, cybr/
    2025-2026/form.json        # Current academic rules
    2026-2027/form.json        # New PER for all five programmes
src/
  shared/                     # Shared across all programmes and years
  programmes/
    dsai/, cse/, es/, iam/, cybr/ # Programme logic shared across years
  entries/                    # Browser entry modules for each form
scripts/
  programmes.mjs              # Registered programmes, years and target paths
  build-program.mjs           # Builds one programme/year
  build-all.mjs               # Builds one or all years sequentially
  dev-program.mjs             # Starts Vite for a selected programme/year
dsai.html, cse.html, es.html, iam.html, cybr.html # Vite HTML entry pages
```
