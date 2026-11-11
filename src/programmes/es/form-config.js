// Builds ES metadata and programme rules from the SurveyJS form JSON.
import surveySource from "#forms/es" with { type: "json" };

import {
  createChoiceLookup as createSharedChoiceLookup,
  defaultCourseCodes,
  defaultQuestionValue,
  indexSurveyQuestions,
  normalizeCourseCode,
} from "../../shared/course-catalog.js";
import {
  readNumericRulesFromSurvey,
  resolveNumericRules,
} from "../../shared/survey-rules.js";

export const ES_SURVEY_SOURCE = surveySource;

export const ES_QUESTION_NAMES = Object.freeze({
  track: "program_track",
  edgeMandatory: "edge_mandatory_display",
  edgeElectives: "edge_specialization_electives",
  commonMandatory: "common_mandatory_display",
  stream: "stream",
  graduationCourses: "graduation_courses",
  internshipCourse: "internship_course_display",
  academicYear: "programme_academic_year",
  legacyStreamElectives: "legacy_stream_elective_metadata",
  seminarCourses: "seminar_course_metadata",
  externalCourses: "external_course_metadata",
});

export const ES_RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  standardCourseCredits: "rule_standard_course_credits",
  commonMandatoryCredits: "rule_common_mandatory_credits",
  streamMandatoryCredits: "rule_stream_mandatory_credits",
  streamElectiveTarget: "rule_stream_elective_target",
  freeElectiveSpaceTarget: "rule_free_elective_space_target",
  preparationProjectCredits: "rule_preparation_project_credits",
  graduationProjectCredits: "rule_graduation_project_credits",
  graduationPhaseCredits: "rule_graduation_phase_credits",
  internshipCredits: "rule_internship_credits",
  homologationMaximum: "rule_homologation_max_credits",
  selfChosenHomologationMaximumCount:
    "rule_self_chosen_homologation_max_courses",
});

export function createEsChoiceLookup(surveyJson = surveySource) {
  const lookup = createSharedChoiceLookup(surveyJson);
  lookup.esConfig = buildEsFormConfig(surveyJson, lookup);
  return lookup;
}

export function buildEsFormConfig(surveyJson, lookup) {
  const ruleFields = { ...ES_RULE_FIELD_NAMES };
  // Earlier definitions cap self-chosen course counts; newer ones use credits only.
  if (!surveyJson.calculatedValues?.some(
    ({ name }) => name === ruleFields.selfChosenHomologationMaximumCount,
  )) {
    delete ruleFields.selfChosenHomologationMaximumCount;
  }
  Object.freeze(ruleFields);
  const rules = Object.freeze(readNumericRulesFromSurvey(
    surveyJson,
    ruleFields,
    "ES form",
  ));
  const streams = Object.freeze(
    optionList(lookup, ES_QUESTION_NAMES.stream).map(({ value, label }) =>
      Object.freeze({
        value,
        label,
        mandatoryQuestion: `${value}_mandatory_display`,
        electiveQuestion: `stream_electives_${value}`,
        mandatoryCodes: Object.freeze(defaultCourseCodes(
          lookup,
          `${value}_mandatory_display`,
        )),
        electiveCodes: Object.freeze(lookup.getCodes(
          `stream_electives_${value}`,
        )),
      })),
  );
  const graduationCodes = defaultCourseCodes(
    lookup,
    ES_QUESTION_NAMES.graduationCourses,
  );
  const graduationCourses = Object.freeze({
    additionalCodes: Object.freeze(graduationCodes.slice(2)),
    questionName: ES_QUESTION_NAMES.graduationCourses,
    preparationCode: graduationCodes[0] ?? "",
    graduationCode: graduationCodes[1] ?? "",
  });
  const externalCourseDisplayCodes = Object.freeze(lookup.getCodes(
    ES_QUESTION_NAMES.externalCourses,
  ));
  const routes = [{
    value: "standard",
    label: lookup.getChoices(ES_QUESTION_NAMES.track)
      .find(({ value }) => value === "standard")?.text
      ?? "Standard Embedded Systems program",
    usesStreams: true,
    mandatoryQuestion: ES_QUESTION_NAMES.commonMandatory,
    mandatoryCodes: Object.freeze(defaultCourseCodes(lookup, ES_QUESTION_NAMES.commonMandatory)),
  }];
  const edgeChoice = lookup.getChoices(ES_QUESTION_NAMES.track)
    .find(({ value }) => value === "edge_intelligence");
  if (edgeChoice) {
    routes.push({
      value: edgeChoice.value,
      label: edgeChoice.text,
      usesStreams: false,
      mandatoryQuestion: ES_QUESTION_NAMES.edgeMandatory,
      mandatoryCodes: Object.freeze(defaultCourseCodes(lookup, ES_QUESTION_NAMES.edgeMandatory)),
      electiveQuestion: ES_QUESTION_NAMES.edgeElectives,
      electiveCodes: Object.freeze(lookup.getCodes(ES_QUESTION_NAMES.edgeElectives)),
      rules: Object.freeze({
        ...readNumericRulesFromSurvey(surveyJson, {
          commonMandatoryCredits: "rule_edge_mandatory_credits",
          streamElectiveTarget: "rule_edge_specialization_target",
          freeElectiveSpaceTarget: "rule_edge_free_elective_target",
        }, "ES Edge Intelligence track"),
        streamMandatoryCredits: 0,
      }),
    });
  }
  return Object.freeze({
    routes: Object.freeze(routes.map(Object.freeze)),
    rules,
    ruleFields,
    academicYear: String(defaultQuestionValue(
      lookup,
      ES_QUESTION_NAMES.academicYear,
    )).trim(),
    streams,
    graduationCourses,
    commonMandatoryCodes: Object.freeze(defaultCourseCodes(
      lookup,
      ES_QUESTION_NAMES.commonMandatory,
    )),
    internshipCodes: Object.freeze(lookup.getCodes(
      ES_QUESTION_NAMES.internshipCourse,
    )),
    staleStreamElectiveCodes: Object.freeze(lookup.getCodes(
      ES_QUESTION_NAMES.legacyStreamElectives,
    )),
    seminarCodes: new Set(lookup.getChoices(
      ES_QUESTION_NAMES.seminarCourses,
    ).map(({ code }) => code)),
    externalCourseDisplayCodes,
    externalCourseCodes: new Set(
      externalCourseDisplayCodes.map(normalizeCourseCode),
    ),
    prohibitedCombinations: Object.freeze(readProhibitedCombinations(
      surveyJson,
      lookup,
    )),
    courseCatalog: Object.freeze(buildCourseCatalog(lookup)),
  });
}

export function resolveEsRules(data, config = DEFAULT_ES_CONFIG) {
  return {
    ...resolveNumericRules(data, config.rules, config.ruleFields),
    ...resolveEsRoute(data, config).rules,
  };
}

export function resolveEsRoute(data, config = DEFAULT_ES_CONFIG) {
  return config.routes.find(({ value }) => value === data.program_track)
    ?? config.routes[0];
}

export function esSectionLabels(route) {
  return route?.usesStreams === false ? {
    mandatory: "Edge Intelligence mandatory courses",
    electives: "Specialization electives",
    additionalElective: "Additional specialization elective",
    excessElectives: "Additional specialization electives in free space",
  } : {
    mandatory: "Common mandatory courses",
    electives: "Stream electives",
    additionalElective: "Additional stream elective",
    excessElectives: "Additional stream electives in free space",
  };
}

function optionList(lookup, questionName) {
  return lookup.getChoices(questionName).map((choice) => Object.freeze({
    value: String(choice.value),
    label: choice.text,
  }));
}

function buildCourseCatalog(lookup) {
  return Object.fromEntries(
    lookup.getCourses()
      .filter((course) =>
        /^\d[A-Z0-9]+(?:\/\d[A-Z0-9]+)?$/.test(course.displayCode)
        && Number.isFinite(course.credits))
      .map((course) => [
      course.code,
      Object.freeze({
        code: course.displayCode,
        title: course.title,
        credits: course.credits,
      }),
      ]),
  );
}

function readProhibitedCombinations(surveyJson, lookup) {
  return [...indexSurveyQuestions(surveyJson).entries()]
    .filter(([name]) => name.startsWith("prohibited_combination_"))
    .map(([name, question]) => Object.freeze({
      codes: Object.freeze(lookup.getCodes(name)),
      source: String(question.description ?? "")
        .replace(/^Source:\s*/i, ""),
    }));
}

const DEFAULT_ES_LOOKUP = createEsChoiceLookup(surveySource);
export const DEFAULT_ES_CONFIG = DEFAULT_ES_LOOKUP.esConfig;
export const ES_COURSE_CATALOG = DEFAULT_ES_CONFIG.courseCatalog;
export const ES_COURSES = ES_COURSE_CATALOG;
export const ES_ACADEMIC_YEAR = DEFAULT_ES_CONFIG.academicYear;
export const COMMON_MANDATORY_CODES = DEFAULT_ES_CONFIG.commonMandatoryCodes;
export const ES_STREAMS = DEFAULT_ES_CONFIG.streams;
export const INTERNSHIP_CODES = DEFAULT_ES_CONFIG.internshipCodes;
export const STALE_STREAM_ELECTIVE_CODES =
  DEFAULT_ES_CONFIG.staleStreamElectiveCodes;
export const PROHIBITED_COMBINATIONS =
  DEFAULT_ES_CONFIG.prohibitedCombinations;
export const STREAM_ELECTIVE_TARGET =
  DEFAULT_ES_CONFIG.rules.streamElectiveTarget;
export const FREE_ELECTIVE_TARGET =
  DEFAULT_ES_CONFIG.rules.freeElectiveSpaceTarget;
export const PROGRAMME_TARGET = DEFAULT_ES_CONFIG.rules.programmeTarget;
export const HOMOLOGATION_MAX_CREDITS =
  DEFAULT_ES_CONFIG.rules.homologationMaximum;
export const SELF_CHOSEN_HOMOLOGATION_MAX_COURSES =
  DEFAULT_ES_CONFIG.rules.selfChosenHomologationMaximumCount;
