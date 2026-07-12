# TU/e Program of Examinations Forms

Fillable TU/e master's-program forms with live ECTS calculations, programme-rule checks and a printable (PDF) summary for the examination committee.

## Use a form

No installation is needed to fill in a form. Download the programme form, then open the downloaded HTML file in a browser such as Microsoft Edge, Google Chrome or Firefox.

- <a href="./dist/dsai.html" download>Download the DS&AI form</a>
- <a href="./dist/cse.html" download>Download the CSE form</a>

*Side note: If the link opens the form instead of downloading it, use the browser's **Save page** option to save the HTML file, then open that saved file.*

The forms work offline after download.

1. Complete the form section by section. The ECTS panel checks credits and programme requirements as you work.
2. Continue to the final **Review and print** page.
3. Review the selected courses, ECTS subtotals and validation results.
4. Select **Print / Save as PDF**. In the browser print dialog, choose **Save as PDF** and turn off **Headers and footers** before saving.
5. Choose where to save the PDF. This is the summary document to upload or share with the university when requested.

## Developer guide

The instructions below are for people who need to change, test or build the forms. The forms are based on <a href="https://surveyjs.io/">SurveyJS</a> library. Additionally, Vite is used to bundles each programme into one standalone HTML file.

### Requirements

- Node.js 20.19 or newer
- npm

### Install npm

```bash
npm install
```

### Build standalone forms

```bash
npm run build:dsai
npm run build:cse
npm run build:all
```

The generated downloadable forms are located in the `dist/` directory. For example, `dist/dsai.html` and `dist/cse.html`. Building one programme preserves the other generated form.

## Project structure

```text
dist/                       # Generated standalone forms for users
forms/
  dsai/, cse/               # SurveyJS form definitions and source PDFs
  iam/, es/, ist/           # Placeholders for upcoming programmes
src/
  shared/                   # Shared SurveyJS, ECTS, print, and summary helpers
  programmes/
    dsai/, cse/             # Programme-specific config, calculator, and summary
    iam/, es/, ist/         # Placeholders for upcoming programmes
  entries/                  # Browser entry modules for each form
scripts/
  programmes.mjs            # Registered build targets
  build-program.mjs         # Builds one standalone form
tests/                      # Calculator regression tests
dsai.html, cse.html         # Vite HTML entry pages
```
