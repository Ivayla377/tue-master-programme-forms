// Defines the CSE form configuration used by the shared application shell.
import logoUrl from "../../../tue_logo.jpg";
import { programmeFormLabels } from "../../shared/form-metadata.js";
import { calculateCse, createCseChoiceLookup } from "./calculator.js";
import { CSE_SURVEY_SOURCE } from "./form-config.js";
import { renderCseEctsPanel, renderCseSummary } from "./summary.js";

export const cseFormConfig = {
  surveySource: CSE_SURVEY_SOURCE,
  logoUrl,
  logoType: "image/jpeg",
  labels: programmeFormLabels(CSE_SURVEY_SOURCE),
  createChoiceLookup: createCseChoiceLookup,
  calculateReport: calculateCse,
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
