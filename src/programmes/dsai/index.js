// Defines the DS&AI form configuration used by the shared application shell.
import logoUrl from "../../../tue_logo.jpg";
import { programmeFormLabels } from "../../shared/form-metadata.js";

import {
  calculateEcts,
  removeBlockedSpecializationSelections,
} from "./calculator.js";
import {
  DSAI_SURVEY_SOURCE,
  createChoiceLookup,
} from "./form-config.js";
import {
  renderEctsPanel,
  renderSummary,
  renderTrajectoryClassification,
} from "./summary.js";

export const dsaiFormConfig = {
  surveySource: DSAI_SURVEY_SOURCE,
  logoUrl,
  logoType: "image/jpeg",
  labels: programmeFormLabels(DSAI_SURVEY_SOURCE),
  createChoiceLookup,
  calculateReport: calculateEcts,
  beforeCalculate: removeBlockedSpecializationSelections,
  htmlQuestionRenderers: {
    trajectory_classification_html: renderTrajectoryClassification,
  },
  renderEctsPanel,
  renderSummary,
};
