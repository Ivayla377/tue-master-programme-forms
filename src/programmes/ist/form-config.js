// Builds IST course metadata and programme rules from the SurveyJS form JSON.
import surveySource from "../../../forms/ist/form.json" with { type: "json" };

import {
  createChoiceLookup as createSharedChoiceLookup,
  defaultCourseCodes,
} from "../../shared/course-catalog.js";
import {
  readNumericRulesFromSurvey,
  resolveNumericRules,
} from "../../shared/survey-rules.js";

export const IST_SURVEY_SOURCE = surveySource;

export const IST_QUESTION_NAMES = Object.freeze({
  mandatory: "mandatory_components_display",
  graduationPath: "graduation_course_set",
  istElectives: "ist_electives",
  mcsElectives: "mcs_course_electives",
  internship: "internship_course_display",
});

export const IST_RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  mandatoryCredits: "rule_mandatory_credits",
  istElectiveMinimum: "rule_ist_elective_min_credits",
  istElectiveMinimumCount: "rule_ist_elective_min_count",
  mcsMinimum: "rule_mcs_min_credits",
  freeElectiveSpaceMinimum: "rule_free_elective_space_min_credits",
  homologationMaximum: "rule_homologation_max_credits",
});

export function createIstChoiceLookup(surveyJson = surveySource) {
  const lookup = createSharedChoiceLookup(surveyJson);
  lookup.istConfig = buildIstFormConfig(surveyJson, lookup);
  return lookup;
}

export function buildIstFormConfig(surveyJson, lookup) {
  const graduationPaths = Object.freeze(
    lookup.getChoices(IST_QUESTION_NAMES.graduationPath).map((choice) => {
      const value = String(choice.value);
      return Object.freeze({
        value,
        label: choice.text,
        questionName: value,
        codes: Object.freeze(defaultCourseCodes(lookup, value)),
      });
    }),
  );
  const courseQuestionNames = [
    IST_QUESTION_NAMES.mandatory,
    ...graduationPaths.map(({ questionName }) => questionName),
    IST_QUESTION_NAMES.istElectives,
    IST_QUESTION_NAMES.mcsElectives,
    IST_QUESTION_NAMES.internship,
  ];

  return Object.freeze({
    rules: Object.freeze(readNumericRulesFromSurvey(
      surveyJson,
      IST_RULE_FIELD_NAMES,
      "IST form",
    )),
    courseCatalog: Object.freeze(buildCourseCatalog(
      lookup,
      courseQuestionNames,
    )),
    mandatoryCodes: Object.freeze(defaultCourseCodes(
      lookup,
      IST_QUESTION_NAMES.mandatory,
    )),
    graduationPaths,
    graduationPathValues: Object.freeze(
      graduationPaths.map(({ value }) => value),
    ),
    istElectiveCodes: Object.freeze(
      lookup.getCodes(IST_QUESTION_NAMES.istElectives),
    ),
    mcsElectiveCodes: Object.freeze(
      lookup.getCodes(IST_QUESTION_NAMES.mcsElectives),
    ),
    internshipCodes: Object.freeze(defaultCourseCodes(
      lookup,
      IST_QUESTION_NAMES.internship,
    )),
  });
}

export function resolveIstRules(data, config = DEFAULT_IST_CONFIG) {
  return resolveNumericRules(data, config.rules, IST_RULE_FIELD_NAMES);
}

function buildCourseCatalog(lookup, questionNames) {
  const catalog = {};
  for (const questionName of questionNames) {
    for (const course of lookup.getChoices(questionName)) {
      if (!Number.isFinite(course.credits)) {
        throw new Error(
          `IST choice ${course.displayCode || course.text || "(empty)"} must define numeric credits.`,
        );
      }
      const existing = catalog[course.code];
      if (existing && existing.credits !== course.credits) {
        throw new Error(
          `IST course ${course.displayCode} has conflicting credit values.`,
        );
      }
      catalog[course.code] = course;
    }
  }
  return catalog;
}

const DEFAULT_IST_LOOKUP = createIstChoiceLookup(surveySource);
export const DEFAULT_IST_CONFIG = DEFAULT_IST_LOOKUP.istConfig;
export const IST_COURSE_CATALOG = DEFAULT_IST_CONFIG.courseCatalog;
export const MANDATORY_CODES = DEFAULT_IST_CONFIG.mandatoryCodes;
export const GRADUATION_PATHS = DEFAULT_IST_CONFIG.graduationPathValues;
export const IST_ELECTIVE_CODES = DEFAULT_IST_CONFIG.istElectiveCodes;
export const MCS_ELECTIVE_CODES = DEFAULT_IST_CONFIG.mcsElectiveCodes;
