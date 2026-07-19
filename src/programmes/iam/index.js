import surveySource from "../../../forms/iam/form.json" with { type: "json" };
import logoUrl from "../../../tue_logo.jpg";
import { calculateIam, createIamChoiceLookup } from "./calculator.js";
import { renderIamEctsPanel, renderIamSummary } from "./summary.js";

export const iamFormConfig = {
  surveySource,
  logoUrl,
  logoType: "image/jpeg",
  labels: {
    pageTitle: "IAM Program of Examinations",
    kicker: "TU/e MSc Industrial and Applied Mathematics",
    heading: "Program of Examinations",
    year: "2025-2026",
    ariaLabel: "IAM program form",
    summaryEyebrow: "IAM Program of Examinations 2025-2026",
    summaryTitle: "Form 1: IAM Program of Examinations",
    reportingPageTitle: "Review and print",
  },
  createChoiceLookup: createIamChoiceLookup,
  calculateReport: calculateIam,
  renderEctsPanel: renderIamEctsPanel,
  renderSummary: renderIamSummary,
};