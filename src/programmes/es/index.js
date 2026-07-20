import surveySource from "../../../forms/es/form.json";
import logoUrl from "../../../tue_logo.jpg";
import {
  calculateEs,
  createEsChoiceLookup,
  synchronizeEsSurvey,
} from "./calculator.js";
import {
  handleEsElectiveRowRemoving,
  synchronizeEsElectiveRows,
} from "./elective-survey.js";
import { renderEsEctsPanel, renderEsSummary } from "./summary.js";

export const esFormConfig = {
  surveySource,
  logoUrl,
  logoType: "image/jpeg",
  labels: {
    pageTitle: "ES Program of Examinations",
    kicker: "TU/e Msc Embedded Systems",
    heading: "Program of Examinations",
    year: "2025-2026",
    ariaLabel: "ES program form",
    summaryEyebrow: "ES Program of Examinations 2025-2026",
    summaryTitle: "Form 1: ES Program of Examinations",
    reportingPageTitle: "Review and print",
  },
  createChoiceLookup: createEsChoiceLookup,
  calculateReport: calculateEs,
  beforeCalculate: synchronizeEsSurvey,
  afterCalculate: synchronizeEsElectiveRows,
  onMatrixRowRemoving: handleEsElectiveRowRemoving,
  renderEctsPanel: renderEsEctsPanel,
  renderSummary: renderEsSummary,
};
