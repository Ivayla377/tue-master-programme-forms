import surveySource from "../../../forms/cse/form.json";
import logoUrl from "../../../tue_logo.jpg";
import { calculateCse, createCseChoiceLookup } from "./calculator.js";
import {
  handleCseElectiveRowRemoving,
  synchronizeCseElectiveRows,
} from "./elective-survey.js";
import { renderCseEctsPanel, renderCseSummary } from "./summary.js";

export const cseFormConfig = {
  surveySource,
  logoUrl,
  logoType: "image/jpeg",
  labels: {
    pageTitle: "CSE Program of Examinations",
    kicker: "TU/e MSc Computer Science and Engineering",
    heading: "Program of Examinations",
    year: "2025-2026",
    ariaLabel: "CSE program form",
    summaryEyebrow: "CSE Program of Examinations",
    summaryTitle: "Form 1: CSE Program of Examinations",
    reportingPageTitle: "Review and print",
  },
  createChoiceLookup: createCseChoiceLookup,
  calculateReport: calculateCse,
  afterCalculate: synchronizeCseElectiveRows,
  onMatrixRowRemoving: handleCseElectiveRowRemoving,
  renderEctsPanel: renderCseEctsPanel,
  renderSummary: renderCseSummary,
  // validateQuestion(_survey, options) {
  //   if (options.name !== "enrollment") return;

  //   const value = String(options.value ?? "");
  //   if (!/^(?:201[0-9]|202[0-9]|203[0-5])-(?:0[1-9]|1[0-2])$/.test(value)) {
  //     options.error = "Enter a valid enrollment month from 2010 to 2035 in YYYY-MM format.";
  //   }
  // },
};
