// Builds DS&AI metadata and programme rules from the SurveyJS form JSON.

import surveySource from "#forms/dsai" with { type: "json" };

import {
  createChoiceLookup as createSharedChoiceLookup,
  defaultCourseCodes,
  normalizeCourseCode,
} from "../../shared/course-catalog.js";
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
  majorTrajectories: "selected_major_trajectories",
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
const FORM_RULE_FIELDS = ruleFieldsForSurvey(surveySource);

export const DEFAULT_RULES = Object.freeze(
  readNumericRulesFromSurvey(
    surveySource,
    FORM_RULE_FIELDS,
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
  const lookup = createSharedChoiceLookup(surveyJson);
  const ruleFields = ruleFieldsForSurvey(surveyJson);
  lookup.dsaiConfig = Object.freeze({
    ruleFields,
    rules: Object.freeze(readNumericRulesFromSurvey(surveyJson, ruleFields, "DS&AI form")),
    trajectories: Object.freeze(TRAJECTORY_NAMES.map((name) => Object.freeze({
      name,
      label: lookup.getQuestion(name)?.title ?? name,
    }))),
  });
  return lookup;
}

export function resolveDsaiRules(data, choiceLookup) {
  return resolveNumericRules(
    data,
    choiceLookup?.dsaiConfig?.rules ?? DEFAULT_RULES,
    choiceLookup?.dsaiConfig?.ruleFields ?? FORM_RULE_FIELDS,
  );
}

function ruleFieldsForSurvey(surveyJson) {
  // Older definitions use a fixed homologation list without a separate credit cap.
  const hasHomologationLimit = surveyJson.calculatedValues?.some(
    ({ name }) => name === "rule_homologation_max_credits",
  );
  return Object.freeze({
    ...RULE_FIELD_NAMES,
    ...(hasHomologationLimit
      ? { homologationMaximumCredits: "rule_homologation_max_credits" }
      : {}),
  });
}
