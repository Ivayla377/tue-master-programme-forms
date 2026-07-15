import surveySource from "../../../forms/dsai/form.json";
import logoUrl from "../../../tue_logo.jpg";
import {
  calculateEcts,
  createChoiceLookup,
  removeBlockedSpecializationSelections,
} from "./calculator.js";
import { renderEctsPanel, renderSummary } from "./summary.js";

export const dsaiFormConfig = {
  surveySource,
  logoUrl,
  logoType: "image/jpeg",
  labels: {
    pageTitle: "DS&AI Program of Examinations",
    kicker: "TU/e MSc Data Science & Artificial Intelligence",
    heading: "Program of Examinations",
    year: "2025-2026",
    ariaLabel: "DS&AI program form",
    summaryEyebrow: "DS&AI Program of Examinations 2025-2026",
    summaryTitle: "Form 1: DS&AI Program of Examinations",
    reportingPageTitle: "Review and print",
  },
  createChoiceLookup,
  calculateReport: calculateEcts,
  beforeCalculate: removeBlockedSpecializationSelections,
  renderEctsPanel,
  renderSummary,
};
