// Builds CYBR course metadata and programme rules from the SurveyJS form JSON.
import surveySource from "../../../forms/cybr/form.json" with { type: "json" };

import {
  createChoiceLookup as createSharedChoiceLookup,
  defaultCourseCodes,
} from "../../shared/course-catalog.js";
import {
  readNumericRulesFromSurvey,
  resolveNumericRules,
} from "../../shared/survey-rules.js";

export const CYBR_SURVEY_SOURCE = surveySource;

export const CYBR_QUESTION_NAMES = Object.freeze({
  mandatory: "mandatory_components_display",
  graduation: "graduation_courses",
  cybrElectives: "cybr_electives",
  mcsElectives: "mcs_course_electives",
  internship: "internship_course_display",
});

export const CYBR_RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  mandatoryCredits: "rule_mandatory_credits",
  cybrElectiveMinimum: "rule_cybr_elective_min_credits",
  mcsMinimum: "rule_mcs_min_credits",
  freeElectiveSpaceMinimum: "rule_free_elective_space_min_credits",
  homologationMaximum: "rule_homologation_max_credits",
});

export function createCybrChoiceLookup(surveyJson = surveySource) {
  const lookup = createSharedChoiceLookup(surveyJson);
  lookup.cybrConfig = buildCybrFormConfig(surveyJson, lookup);
  return lookup;
}

export function buildCybrFormConfig(surveyJson, lookup) {
  const courseQuestionNames = [
    CYBR_QUESTION_NAMES.mandatory,
    CYBR_QUESTION_NAMES.graduation,
    CYBR_QUESTION_NAMES.cybrElectives,
    CYBR_QUESTION_NAMES.mcsElectives,
    CYBR_QUESTION_NAMES.internship,
  ];

  return Object.freeze({
    rules: Object.freeze(readNumericRulesFromSurvey(
      surveyJson,
      CYBR_RULE_FIELD_NAMES,
      "CYBR form",
    )),
    courseCatalog: Object.freeze(buildCourseCatalog(
      lookup,
      courseQuestionNames,
    )),
    mandatoryCodes: Object.freeze(defaultCourseCodes(
      lookup,
      CYBR_QUESTION_NAMES.mandatory,
    )),
    graduationCodes: Object.freeze(defaultCourseCodes(
      lookup,
      CYBR_QUESTION_NAMES.graduation,
    )),
    cybrElectiveCodes: Object.freeze(
      lookup.getCodes(CYBR_QUESTION_NAMES.cybrElectives),
    ),
    mcsElectiveCodes: Object.freeze(
      lookup.getCodes(CYBR_QUESTION_NAMES.mcsElectives),
    ),
    internshipCodes: Object.freeze(defaultCourseCodes(
      lookup,
      CYBR_QUESTION_NAMES.internship,
    )),
  });
}

export function resolveCybrRules(data, config = DEFAULT_CYBR_CONFIG) {
  return resolveNumericRules(data, config.rules, CYBR_RULE_FIELD_NAMES);
}

function buildCourseCatalog(lookup, questionNames) {
  const catalog = {};
  for (const questionName of questionNames) {
    for (const course of lookup.getChoices(questionName)) {
      if (!Number.isFinite(course.credits)) {
        throw new Error(
          `CYBR choice ${course.displayCode || course.text || "(empty)"} must define numeric credits.`,
        );
      }
      const existing = catalog[course.code];
      if (existing && existing.credits !== course.credits) {
        throw new Error(
          `CYBR course ${course.displayCode} has conflicting credit values.`,
        );
      }
      catalog[course.code] = course;
    }
  }
  return catalog;
}

const DEFAULT_CYBR_LOOKUP = createCybrChoiceLookup(surveySource);
export const DEFAULT_CYBR_CONFIG = DEFAULT_CYBR_LOOKUP.cybrConfig;
export const CYBR_COURSE_CATALOG = DEFAULT_CYBR_CONFIG.courseCatalog;
export const MANDATORY_CODES = DEFAULT_CYBR_CONFIG.mandatoryCodes;
export const GRADUATION_CODES = DEFAULT_CYBR_CONFIG.graduationCodes;
export const CYBR_ELECTIVE_CODES = DEFAULT_CYBR_CONFIG.cybrElectiveCodes;
export const MCS_ELECTIVE_CODES = DEFAULT_CYBR_CONFIG.mcsElectiveCodes;
