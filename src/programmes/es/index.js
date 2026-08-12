// Defines the ES form configuration used by the shared application shell.
import logoUrl from "../../../tue_logo.jpg";
import { programmeFormLabels } from "../../shared/form-metadata.js";
import {
  calculateEs,
  createEsChoiceLookup,
} from "./calculator.js";
import {
  ES_SURVEY_SOURCE,
} from "./form-config.js";
import { renderEsEctsPanel, renderEsSummary } from "./summary.js";

export const esFormConfig = {
  surveySource: ES_SURVEY_SOURCE,
  logoUrl,
  logoType: "image/jpeg",
  labels: programmeFormLabels(ES_SURVEY_SOURCE),
  createChoiceLookup: createEsChoiceLookup,
  calculateReport: calculateEs,
  renderEctsPanel: renderEsEctsPanel,
  renderSummary: renderEsSummary,
};
