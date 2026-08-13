// Defines the IAM form configuration used by the shared application shell.
import logoUrl from "../../../tue_logo.jpg";
import { programmeFormLabels } from "../../shared/form-metadata.js";
import { calculateIam, createIamChoiceLookup } from "./calculator.js";
import { IAM_SURVEY_SOURCE } from "./form-config.js";
import { renderIamEctsPanel, renderIamSummary } from "./summary.js";

export const iamFormConfig = {
  surveySource: IAM_SURVEY_SOURCE,
  logoUrl,
  logoType: "image/jpeg",
  labels: programmeFormLabels(IAM_SURVEY_SOURCE),
  createChoiceLookup: createIamChoiceLookup,
  calculateReport: calculateIam,
  renderEctsPanel: renderIamEctsPanel,
  renderSummary: renderIamSummary,
};
