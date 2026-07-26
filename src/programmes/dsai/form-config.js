// Configuration of question names and form-derived metadata

import surveySource from "../../../forms/dsai/form.json" with { type: "json" };

import {
  createChoiceLookup as createSharedChoiceLookup,
  defaultCourseCodes,
  normalizeCourseCode,
} from "../../shared/course-utils.js";
import {
  readNumericRulesFromSurvey,
  resolveNumericRules,
} from "../../shared/survey-rules.js";

export const DSAI_SURVEY_SOURCE = surveySource;

export const RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  standardCourseCredits: "rule_standard_course_credits",
  coreCredits: "rule_core_credits",
  specializationMinimumCredits: "rule_specialization_min_credits",
  specializationMinimumCount: "rule_specialization_min_count",
  majorMinimumCredits: "rule_major_min_credits",
  majorMinimumCount: "rule_major_min_count",
  minorMinimumCredits: "rule_minor_min_credits",
  projectMinimumCount: "rule_project_min_count",
  seminarCredits: "rule_seminar_credits",
  internshipCredits: "rule_internship_credits",
  freeElectiveSpaceCredits: "rule_free_elective_space_credits",
  graduationCredits: "rule_graduation_credits",
});

export const QUESTION_NAMES = Object.freeze({
  core: "core",
  coreElective: "core_elective",
  seminar: "seminar",
  homologation: "homologation_courses",
  internshipMetadata: "internship_course_display",
  graduation: "graduation",
  projectMetadata: "project_course_metadata",
});

const TRAJECTORY_NAMES = Object.freeze([
  "context",
  "stat",
  "db",
  "aiml",
  "dmml",
  "pmva",
  "ada",
]);

const FORM_LOOKUP = createSharedChoiceLookup(surveySource);

export const DEFAULT_RULES = Object.freeze(
  readNumericRulesFromSurvey(
    surveySource,
    RULE_FIELD_NAMES,
    "DS&AI form",
  ),
);

export const DEFAULT_CREDITS = DEFAULT_RULES.standardCourseCredits;

export const CORE_MANDATORY_CODES = Object.freeze(
  defaultCourseCodes(FORM_LOOKUP, QUESTION_NAMES.core, [])
    .map(normalizeCourseCode),
);

export const TRAJECTORIES = Object.freeze(
  TRAJECTORY_NAMES.map((name) => Object.freeze({
    name,
    label: FORM_LOOKUP.getQuestion(name)?.title ?? name,
  })),
);

export const PROJECT_COURSE_CODES = new Set(
  defaultCourseCodes(FORM_LOOKUP, QUESTION_NAMES.projectMetadata, [])
    .map(normalizeCourseCode),
);

export function createChoiceLookup(surveyJson = surveySource) {
  return createSharedChoiceLookup(surveyJson);
}

export function resolveDsaiRules(data) {
  return resolveNumericRules(data, DEFAULT_RULES, RULE_FIELD_NAMES);
}
