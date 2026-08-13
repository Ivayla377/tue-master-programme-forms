// Builds IAM course metadata and programme rules from the SurveyJS form JSON.
import surveySource from "../../../forms/iam/form.json" with { type: "json" };

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
  officialFree: "official_free_electives",
  internship: "internship_course_display",
});

export const IAM_RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  coreMinimum: "rule_core_min_credits",
  coreMinimumCount: "rule_core_min_count",
  coreSpecializationMinimum: "rule_core_specialization_min_credits",
  homologationMaximum: "rule_homologation_max_credits",
});

const COURSE_QUESTION_NAMES = Object.freeze(Object.values(IAM_QUESTION_NAMES));

export function createIamChoiceLookup(surveyJson = surveySource) {
  const lookup = createSharedChoiceLookup(surveyJson);
  lookup.iamConfig = buildIamFormConfig(surveyJson, lookup);
  return lookup;
}

export function buildIamFormConfig(surveyJson, lookup) {
  const mandatoryCodes = Object.freeze(defaultCourseCodes(
    lookup,
    IAM_QUESTION_NAMES.mandatory,
  ));

  return Object.freeze({
    rules: Object.freeze(readNumericRulesFromSurvey(
      surveyJson,
      IAM_RULE_FIELD_NAMES,
      "IAM form",
    )),
    courseCatalog: Object.freeze(buildCourseCatalog(lookup)),
    mandatoryCodes,
    professionalPortfolioCode: mandatoryCodes[0] ?? "",
    finalProjectCode: mandatoryCodes[1] ?? "",
    coreElectiveCodes: Object.freeze(lookup.getCodes(IAM_QUESTION_NAMES.core)),
    specializationElectiveCodes: Object.freeze(
      lookup.getCodes(IAM_QUESTION_NAMES.specialization),
    ),
    officialFreeElectiveCodes: Object.freeze(
      lookup.getCodes(IAM_QUESTION_NAMES.officialFree),
    ),
    internshipCodes: Object.freeze(defaultCourseCodes(
      lookup,
      IAM_QUESTION_NAMES.internship,
    )),
  });
}

export function resolveIamRules(data, config = DEFAULT_IAM_CONFIG) {
  return resolveNumericRules(data, config.rules, IAM_RULE_FIELD_NAMES);
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
export const OFFICIAL_FREE_ELECTIVE_CODES =
  DEFAULT_IAM_CONFIG.officialFreeElectiveCodes;
