# TU/e Program of Examinations Forms

Fillable TU/e master's-program forms with live ECTS calculations, programme-rule checks and a printable (PDF) summary for the examination committee.

## Use a form

No installation is needed to fill in a form. Download the programme form, then open the downloaded HTML file in a browser such as Microsoft Edge, Google Chrome or Firefox.

- [Download the DS&AI form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/dsai.html)
- [Download the CSE form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/cse.html)
- [Download the ES form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/es.html)
- [Download the IAM form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/iam.html)
- [Download the CYBR form](https://github.com/Ivayla377/tue-master-programme-forms/releases/latest/download/cybr.html)

The forms work offline after download.

1. Complete the form section by section. The ECTS panel checks credits and programme requirements as you work.
2. Continue to the final **Review and print** page.
3. Review the selected courses, ECTS subtotals and validation results.
4. Select **Print / Save as PDF**. In the browser print dialog, choose **Save as PDF** and turn off **Headers and footers** before saving.
5. Choose where to save the PDF. This is the summary document to upload or share with the university when requested.

## Developer guide

The forms use [SurveyJS](https://surveyjs.io/) and Vite. Each programme is bundled into one standalone HTML file that works offline.

### Requirements

- Node.js 20.19 or newer
- npm

### Install dependencies

```bash
npm install
```

### Maintain a programme

Each programme has one complete `forms/<programme>/form.json`. This JSON is the primary source for the form layout, questions, course choices, fixed course metadata, calculated ECTS values and editable programme thresholds. It can be imported into (and exported from) the free hosted SurveyJS Creator visual editor.

When updating a programme:

1. Edit its `form.json`, preferably through SurveyJS Creator, while preserving stable question names and course-code values.
2. Keep course labels in the form `CODE Title (N ECTS)` so the shared code can read their credits.
3. Use `src/programmes/<programme>/` only for academic logic or report rendering that SurveyJS expressions cannot express clearly.
4. Put mechanics shared by several programmes in `src/shared/` rather than copying them.
5. Rebuild the affected standalone form and check its final review and printable report.

Run a form locally while editing with:

```bash
npm run dev
```

### Build standalone forms

```bash
npm run build:dsai
npm run build:cse
npm run build:es
npm run build:iam
npm run build:cybr
npm run build:all
```

The generated downloadable forms are located in the `dist/` directory: `dist/dsai.html`, `dist/cse.html`, `dist/es.html`, `dist/iam.html` and `dist/cybr.html`. Building one programme preserves the other generated forms.

## Project structure

```text
dist/                         # Generated standalone forms for users
forms/
  dsai/, cse/, es/, iam/, cybr/ # Authoritative SurveyJS JSON and source documents
src/
  shared/                     # Shared course, validation, SurveyJS and report helpers
  programmes/
    dsai/, cse/, es/, iam/, cybr/ # Programme-specific configuration, rules and reports
  entries/                    # Browser entry modules for each form
scripts/
  programmes.mjs              # Registered build targets
  build-program.mjs           # Builds one standalone form
dsai.html, cse.html, es.html, iam.html, cybr.html # Vite HTML entry pages
```
