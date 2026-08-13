// Defines the CYBR form configuration used by the shared application shell.
import logoUrl from "../../../tue_logo.jpg";
import { programmeFormLabels } from "../../shared/form-metadata.js";
import { calculateCybr, createCybrChoiceLookup } from "./calculator.js";
import { CYBR_SURVEY_SOURCE } from "./form-config.js";
import { renderCybrEctsPanel, renderCybrSummary } from "./summary.js";

export const cybrFormConfig = {
  surveySource: CYBR_SURVEY_SOURCE,
  logoUrl,
  logoType: "image/jpeg",
  labels: programmeFormLabels(CYBR_SURVEY_SOURCE),
  createChoiceLookup: createCybrChoiceLookup,
  calculateReport: calculateCybr,
  renderEctsPanel: renderCybrEctsPanel,
  renderSummary: renderCybrSummary,
};
