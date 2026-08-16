// Builds CSE metadata and programme rules from the SurveyJS form JSON.
import surveySource from "../../../forms/cse/form.json" with { type: "json" };

import {
  createChoiceLookup as createSharedChoiceLookup,
  defaultCourseCodes,
  normalizeCourseCode,
} from "../../shared/course-catalog.js";
import {
  readNumericRulesFromSurvey,
  resolveNumericRules,
} from "../../shared/survey-rules.js";

export const CSE_SURVEY_SOURCE = surveySource;

export const CSE_QUESTION_NAMES = Object.freeze({
  focusArea: "extra_focus_area",
  graduationGroup: "intended_graduation_cluster",
  graduationCourses: "graduation_courses",
  internshipCourse: "internship_course_display",
  specializationAdditional: "specialization_additional",
});

export const CSE_RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  standardCourseCredits: "rule_standard_course_credits",
  foundationalCourseCount: "rule_foundational_course_count",
  extraCourseCount: "rule_extra_course_count",
  specializationTarget: "rule_specialization_target",
  freeElectiveSpaceTarget: "rule_free_elective_space_target",
  seminarCredits: "rule_seminar_credits",
  graduationCredits: "rule_graduation_credits",
  internshipCredits: "rule_internship_credits",
});

export function createCseChoiceLookup(surveyJson = surveySource) {
  const lookup = createSharedChoiceLookup(surveyJson);
  lookup.cseConfig = buildCseFormConfig(surveyJson, lookup);
  return lookup;
}

export function buildCseFormConfig(surveyJson, lookup) {
  const rules = Object.freeze(readNumericRulesFromSurvey(
    surveyJson,
    CSE_RULE_FIELD_NAMES,
    "CSE form",
  ));
  const focusAreas = Object.freeze(
    optionList(lookup, CSE_QUESTION_NAMES.focusArea),
  );
  const graduationGroups = Object.freeze(
    optionList(lookup, CSE_QUESTION_NAMES.graduationGroup),
  );
  const foundationalFields = Object.freeze(
    focusAreas.map(({ value }) => Object.freeze({
      focus: value,
      field: `foundational_${value}`,
    })),
  );
  const specializationFields = Object.freeze([
    ...focusAreas.map(({ value }) => `specialization_${value}`),
    CSE_QUESTION_NAMES.specializationAdditional,
  ]);
  const graduationCodes = Object.freeze(defaultCourseCodes(
    lookup,
    CSE_QUESTION_NAMES.graduationCourses,
  ));
  const internshipCodes = Object.freeze(defaultCourseCodes(
    lookup,
    CSE_QUESTION_NAMES.internshipCourse,
  ));
  const fixedCourseCredits = Object.freeze(Object.fromEntries(
    [
      ...graduationCodes.map((code) => [CSE_QUESTION_NAMES.graduationCourses, code]),
      ...internshipCodes.map((code) => [CSE_QUESTION_NAMES.internshipCourse, code]),
    ].map(([questionName, code]) => [
      normalizeCourseCode(code),
      lookup.getCourse(questionName, code)?.credits,
    ]),
  ));

  return Object.freeze({
    rules,
    focusAreas,
    graduationGroups,
    foundationalFields,
    specializationFields,
    graduationCodes,
    internshipCodes,
    fixedCourseCredits,
    courseFocuses: buildCourseFocuses(lookup, focusAreas),
  });
}

export function resolveCseRules(data, config = DEFAULT_CSE_CONFIG) {
  return resolveNumericRules(
    data,
    config.rules,
    CSE_RULE_FIELD_NAMES,
  );
}

function optionList(lookup, questionName) {
  return lookup.getChoices(questionName).map((choice) => Object.freeze({
    value: String(choice.value),
    label: choice.text,
  }));
}

function buildCourseFocuses(lookup, focusAreas) {
  const focuses = new Map();
  for (const { value } of focusAreas) {
    for (const course of lookup.getChoices(`extra_${value}`)) {
      const current = focuses.get(course.code) ?? new Set();
      current.add(value);
      focuses.set(course.code, current);
    }
  }
  return focuses;
}

const DEFAULT_CSE_LOOKUP = createCseChoiceLookup(surveySource);
export const DEFAULT_CSE_CONFIG = DEFAULT_CSE_LOOKUP.cseConfig;
export const CSE_FOCUS_AREAS = DEFAULT_CSE_CONFIG.focusAreas;
export const CSE_GRADUATION_GROUPS = DEFAULT_CSE_CONFIG.graduationGroups;
export const CSE_COURSE_CREDITS = DEFAULT_CSE_CONFIG.fixedCourseCredits;
export const CSE_SPECIALIZATION_TARGET =
  DEFAULT_CSE_CONFIG.rules.specializationTarget;
