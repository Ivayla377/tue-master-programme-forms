import surveySource from "../../../forms/ist/form.json" with { type: "json" };
import logoUrl from "../../../tue_logo.jpg";
import { calculateIst, createIstChoiceLookup } from "./calculator.js";
import { renderIstEctsPanel, renderIstSummary } from "./summary.js";

export const istFormConfig = {
  surveySource,
  logoUrl,
  logoType: "image/jpeg",
  labels: {
    pageTitle: "IST Program of Examinations",
    kicker: "TU/e MSc Computer Science and Engineering",
    heading: "Program of Examinations",
    year: "2025-2026",
    ariaLabel: "IST program form",
    summaryEyebrow: "IST Program of Examinations 2025-2026",
    summaryTitle: "Form 1: IST Program of Examinations",
    reportingPageTitle: "Review and print",
  },
  createChoiceLookup: createIstChoiceLookup,
  calculateReport: calculateIst,
  renderEctsPanel: renderIstEctsPanel,
  renderSummary: renderIstSummary,
};
