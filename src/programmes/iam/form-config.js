// Builds IAM course metadata and programme rules from the SurveyJS form JSON.
import surveySource from "#forms/iam" with { type: "json" };

import {
  createChoiceLookup as createSharedChoiceLookup,
  defaultCourseCodes,
} from "../../shared/course-catalog.js";
import {
  readNumericRulesFromSurvey,
  resolveNumericRules,
} from "../../shared/survey-rules.js";

export const IAM_SURVEY_SOURCE = surveySource;

export const IAM_QUESTION_NAMES = Object.freeze({
  mandatory: "mandatory_components_display",
  core: "core_electives",
  specialization: "specialization_electives",
  listedFree: "listed_free_electives",
  internship: "internship_course_display",
  qstMandatory: "qst_mandatory_components_display",
  qstSpecialization: "qst_specialization_electives",
});

export const IAM_RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  coreMinimum: "rule_core_min_credits",
  coreMinimumCount: "rule_core_min_count",
  coreSpecializationMinimum: "rule_core_specialization_min_credits",
  homologationMaximum: "rule_homologation_max_credits",
  internshipInSpecialization: "rule_internship_in_specialization",
  qstMinimum: "rule_qst_min_credits",
  qstSpecializationMinimum: "rule_qst_specialization_min_credits",
});

const COURSE_QUESTION_NAMES = Object.freeze(Object.values(IAM_QUESTION_NAMES));

export function createIamChoiceLookup(surveyJson = surveySource) {
  const lookup = createSharedChoiceLookup(surveyJson);
  lookup.iamConfig = buildIamFormConfig(surveyJson, lookup);
  return lookup;
}

export function buildIamFormConfig(surveyJson, lookup) {
  const ruleFields = { ...IAM_RULE_FIELD_NAMES };
  // Earlier definitions do not have QST or the new internship allocation.
  for (const key of ["internshipInSpecialization", "qstMinimum", "qstSpecializationMinimum"]) {
    if (!surveyJson.calculatedValues?.some(({ name }) => name === ruleFields[key])) {
      delete ruleFields[key];
    }
  }
  Object.freeze(ruleFields);
  const mandatoryCodes = Object.freeze(defaultCourseCodes(
    lookup,
    IAM_QUESTION_NAMES.mandatory,
  ));

  return Object.freeze({
    ruleFields,
    rules: Object.freeze(readNumericRulesFromSurvey(
      surveyJson,
      ruleFields,
      "IAM form",
    )),
    courseCatalog: Object.freeze(buildCourseCatalog(lookup)),
    mandatoryCodes,
    trackChoices: Object.freeze(lookup.getChoices("program_track")),
    qstMandatoryCodes: Object.freeze(defaultCourseCodes(lookup, IAM_QUESTION_NAMES.qstMandatory)),
    qstElectiveCodes: Object.freeze(lookup.getCodes(IAM_QUESTION_NAMES.qstSpecialization)),
    // The form lists the portfolio first and the final project last.
    professionalPortfolioCode: mandatoryCodes[0] ?? "",
    finalProjectCode: mandatoryCodes.at(-1) ?? "",
    coreElectiveCodes: Object.freeze(lookup.getCodes(IAM_QUESTION_NAMES.core)),
    specializationElectiveCodes: Object.freeze(
      // Choices with a visibility condition are available only in the QST track.
      lookup.getChoices(IAM_QUESTION_NAMES.specialization)
        .filter(choice => !choice.visibleIf).map(choice => choice.displayCode),
    ),
    qstSpecializationElectiveCodes: Object.freeze(lookup.getCodes(IAM_QUESTION_NAMES.specialization)),
    listedFreeElectiveCodes: Object.freeze(
      lookup.getCodes(IAM_QUESTION_NAMES.listedFree),
    ),
    internshipCodes: Object.freeze(defaultCourseCodes(
      lookup,
      IAM_QUESTION_NAMES.internship,
    )),
  });
}

export function resolveIamRules(data, config = DEFAULT_IAM_CONFIG) {
  const rules = resolveNumericRules(data, config.rules, config.ruleFields);
  if (isIamQstTrack(data, config)) {
    rules.coreMinimum = 0;
    rules.coreMinimumCount = 0;
    rules.coreSpecializationMinimum = rules.qstSpecializationMinimum;
  }
  return rules;
}

export function isIamQstTrack(data, config) {
  return data.program_track === "qst" && config.qstMandatoryCodes.length > 0;
}

function buildCourseCatalog(lookup) {
  const catalog = {};
  for (const questionName of COURSE_QUESTION_NAMES) {
    for (const course of lookup.getChoices(questionName)) {
      if (!Number.isFinite(course.credits)) {
        throw new Error(
          `IAM choice ${course.displayCode || course.text || "(empty)"} must define numeric credits.`,
        );
      }
      const existing = catalog[course.code];
      if (existing && existing.credits !== course.credits) {
        throw new Error(
          `IAM course ${course.displayCode} has conflicting credit values.`,
        );
      }
      catalog[course.code] = course;
    }
  }
  return catalog;
}

const DEFAULT_IAM_LOOKUP = createIamChoiceLookup(surveySource);
export const DEFAULT_IAM_CONFIG = DEFAULT_IAM_LOOKUP.iamConfig;
export const IAM_COURSE_CATALOG = DEFAULT_IAM_CONFIG.courseCatalog;
export const MANDATORY_CODES = DEFAULT_IAM_CONFIG.mandatoryCodes;
export const CORE_ELECTIVE_CODES = DEFAULT_IAM_CONFIG.coreElectiveCodes;
export const SPECIALIZATION_ELECTIVE_CODES =
  DEFAULT_IAM_CONFIG.specializationElectiveCodes;
export const LISTED_FREE_ELECTIVE_CODES =
  DEFAULT_IAM_CONFIG.listedFreeElectiveCodes;
