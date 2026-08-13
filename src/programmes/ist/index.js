// Defines the IST form configuration used by the shared application shell.
import logoUrl from "../../../tue_logo.jpg";
import { programmeFormLabels } from "../../shared/form-metadata.js";
import { calculateIst, createIstChoiceLookup } from "./calculator.js";
import { IST_SURVEY_SOURCE } from "./form-config.js";
import { renderIstEctsPanel, renderIstSummary } from "./summary.js";

export const istFormConfig = {
  surveySource: IST_SURVEY_SOURCE,
  logoUrl,
  logoType: "image/jpeg",
  labels: programmeFormLabels(IST_SURVEY_SOURCE),
  createChoiceLookup: createIstChoiceLookup,
  calculateReport: calculateIst,
  renderEctsPanel: renderIstEctsPanel,
  renderSummary: renderIstSummary,
};
