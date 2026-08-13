// Calculates normalized ES selections, allocated credits, and validation inputs.
import {
  courseFromValue,
  normalizeCourseCode as normalizeEsCode,
  selectedValues,
} from "../../shared/course-catalog.js";
import {
  normalizeManualCourseRows,
  sumCourses,
} from "../../shared/course-selection.js";
import { allocateCoursesToTarget } from "../../shared/elective-allocation.js";
import { readNumericValue } from "../../shared/survey-rules.js";
import { validationState } from "../../shared/validation-utils.js";
import {
  COMMON_MANDATORY_CODES,
  DEFAULT_ES_CONFIG,
  ES_COURSES,
  ES_COURSE_CATALOG,
  ES_STREAMS,
  FREE_ELECTIVE_TARGET,
  GRADUATION_CONTEXTS,
  HOMOLOGATION_MAX_CREDITS,
  INTERNSHIP_CODES,
  PROHIBITED_COMBINATIONS,
  PROGRAMME_TARGET,
  SELF_CHOSEN_HOMOLOGATION_MAX_COURSES,
  STALE_STREAM_ELECTIVE_CODES,
  STREAM_ELECTIVE_TARGET,
  createEsChoiceLookup,
  resolveEsRules,
} from "./form-config.js";
import { buildEsValidations } from "./rules.js";

export {
  COMMON_MANDATORY_CODES,
  ES_COURSES,
  ES_COURSE_CATALOG,
  ES_STREAMS,
  FREE_ELECTIVE_TARGET,
  GRADUATION_CONTEXTS,
  HOMOLOGATION_MAX_CREDITS,
  INTERNSHIP_CODES,
  PROHIBITED_COMBINATIONS,
  PROGRAMME_TARGET,
  SELF_CHOSEN_HOMOLOGATION_MAX_COURSES,
  STALE_STREAM_ELECTIVE_CODES,
  STREAM_ELECTIVE_TARGET,
  createEsChoiceLookup,
};

export const createChoiceLookup = createEsChoiceLookup;

export function calculateEs(data = {}, choiceLookup = createEsChoiceLookup()) {
  const config = choiceLookup.esConfig ?? DEFAULT_ES_CONFIG;
  const rules = resolveEsRules(data, config);

  function readCourse(questionName) {
    return (value) => {
      const course = courseFromValue(
        value,
        choiceLookup,
        questionName,
        rules.standardCourseCredits,
      );
      const metadata = config.courseCatalog[course.code];
      const displayCode = metadata?.code ?? course.displayCode;
      const title = metadata?.title || course.title || "Course title not available";
      return {
        value: displayCode,
        code: course.code,
        displayCode,
        title,
        label: `${displayCode} ${title}`.trim(),
        credits: metadata?.credits ?? course.credits,
      };
    };
  }

  const commonMandatoryCourses = config.commonMandatoryCodes.map(
    readCourse("common_mandatory_display"),
  );
  const rawStreamValues = selectedValues(data.stream)
    .map(normalizeStreamValue)
    .filter(Boolean);
  const streamDefinition = rawStreamValues.length === 1
    ? config.streams.find(({ value }) => value === rawStreamValues[0]) ?? null
    : null;
  const stream = streamDefinition
    ? { value: streamDefinition.value, label: streamDefinition.label }
    : null;
  const streamMandatoryCourses = streamDefinition
    ? streamDefinition.mandatoryCodes.map(
      readCourse(streamDefinition.mandatoryQuestion),
    )
    : [];
  const graduation = resolveGraduation(data, config, readCourse);
  const internship = resolveInternship(data, config, readCourse);

  const activeElectiveValues = streamDefinition
    ? selectedValues(data[streamDefinition.electiveQuestion])
    : [];
  const allowedElectiveCodes = new Set(
    (streamDefinition?.electiveCodes ?? []).map(normalizeEsCode),
  );
  const streamElectiveCourses = [];
  const invalidStreamElectiveCourses = [];
  for (const value of activeElectiveValues) {
    const course = readCourse(streamDefinition.electiveQuestion)(value);
    if (allowedElectiveCodes.has(course.code)) {
      streamElectiveCourses.push(course);
    } else {
      invalidStreamElectiveCourses.push({
        ...course,
        exclusionReason:
          `Not in the selected stream's current ${config.academicYear} PER elective list.`,
      });
    }
  }
  const streamElectiveAllocation = allocateCoursesToTarget(
    streamElectiveCourses,
    rules.streamElectiveTarget,
  );
  const requiredStreamElectiveCourses = streamElectiveAllocation.required;
  const excessStreamElectiveCourses = streamElectiveAllocation.excess;

  const staleStreamElectiveCourses = config.streams
    .filter(({ value }) => value !== streamDefinition?.value)
    .flatMap(({ electiveQuestion }) =>
      selectedValues(data[electiveQuestion]).map((value) => ({
        ...readCourse(electiveQuestion)(value),
        sourceField: electiveQuestion,
        exclusionReason: streamDefinition
          ? "Selection belongs to a non-selected stream field."
          : "No single valid stream is selected.",
      })));

  const freeElectiveRows = normalizeManualCourseRows(data.free_electives);
  const homologationActive = booleanValue(data.homologation) === true;
  const homologationRows = homologationActive
    ? normalizeManualCourseRows(data.homologation_courses)
    : [];
  const selfChosenActive = homologationActive
    && booleanValue(data.self_chosen_homologation) === true;
  const validHomologationCount = homologationRows.filter(
    ({ validCredits }) => validCredits,
  ).length;
  const selfChosenCount = selfChosenActive ? validHomologationCount : 0;

  const commonMandatory = readNumericValue(
    data,
    "credits_common_mandatory",
    sumCourses(commonMandatoryCourses),
  );
  const streamMandatory = readNumericValue(
    data,
    "credits_stream_mandatory",
    sumCourses(streamMandatoryCourses),
  );
  const streamElectivesSelected = readNumericValue(
    data,
    "credits_stream_electives_selected",
    sumCourses(streamElectiveCourses),
  );
  const streamElectivesRequired = readNumericValue(
    data,
    "credits_stream_electives_required",
    streamElectiveAllocation.requiredCredits,
  );
  const streamElectivesExcess = readNumericValue(
    data,
    "credits_stream_electives_excess",
    streamElectiveAllocation.excessCredits,
  );
  const freeElectiveRowCredits = readNumericValue(
    data,
    "credits_free_rows",
    sumValidRows(freeElectiveRows),
  );
  const homologationCredits = readNumericValue(
    data,
    "credits_homologation",
    sumValidRows(homologationRows),
  );
  const internshipCredits = readNumericValue(
    data,
    "credits_internship",
    internship.selected && internship.valid ? internship.course.credits : 0,
  );
  const freeElectiveSpace = readNumericValue(
    data,
    "credits_free_space",
    sumCourses([
      { credits: streamElectivesExcess },
      { credits: freeElectiveRowCredits },
      { credits: homologationCredits },
      { credits: internshipCredits },
    ]),
  );
  const preparationProjectCredits = readNumericValue(
    data,
    "credits_preparation_project",
    graduation.preparationProject?.credits ?? 0,
  );
  const graduationProjectCredits = readNumericValue(
    data,
    "credits_graduation_project",
    graduation.graduationProject?.credits ?? 0,
  );
  const graduationPhase = readNumericValue(
    data,
    "credits_graduation_phase",
    sumCourses([
      { credits: preparationProjectCredits },
      { credits: graduationProjectCredits },
    ]),
  );
  const mandatoryAndGraduation = readNumericValue(
    data,
    "credits_mandatory_and_graduation",
    sumCourses([
      { credits: commonMandatory },
      { credits: graduationPhase },
    ]),
  );
  const total = readNumericValue(
    data,
    "credits_total",
    sumCourses([
      { credits: commonMandatory },
      { credits: streamMandatory },
      { credits: streamElectivesRequired },
      { credits: freeElectiveSpace },
      { credits: graduationPhase },
    ]),
  );

  const includedCourseCodes = new Set([
    ...commonMandatoryCourses,
    ...streamMandatoryCourses,
    ...streamElectiveCourses,
    ...freeElectiveRows.filter(({ validCredits }) => validCredits),
    ...homologationRows.filter(({ validCredits }) => validCredits),
    internship.valid ? internship.course : null,
    graduation.preparationProject,
    graduation.graduationProject,
  ].map((item) => normalizeEsCode(item?.normalizedCode ?? item?.code)).filter(Boolean));
  const incompatibleCombinations = config.prohibitedCombinations.filter(
    ({ codes }) => codes.every((code) => includedCourseCodes.has(normalizeEsCode(code))),
  );
  const invalidManualRows = [...freeElectiveRows, ...homologationRows]
    .filter(({ validCredits }) => !validCredits);

  const homologationAnswered = hasBooleanAnswer(data.homologation);
  const selfChosenAnswered = !homologationActive
    || hasBooleanAnswer(data.self_chosen_homologation);
  const internshipAnswered = hasBooleanAnswer(data.internship);
  const externalAnswered = hasBooleanAnswer(data.external_courses);
  const externalSelected = booleanValue(data.external_courses) === true;
  const externalCoursePresent = [
    ...streamElectiveCourses,
    ...invalidStreamElectiveCourses,
    ...freeElectiveRows,
    ...homologationRows,
  ].some((item) => config.externalCourseCodes.has(
    normalizeEsCode(item.normalizedCode ?? item.code),
  ));
  const externalEvidenceRequired = externalSelected || externalCoursePresent;
  const externalDeclarationConsistent = !externalCoursePresent || externalSelected;
  const externalInformationComplete = !externalEvidenceRequired || (
    hasText(data.external_course_university)
    && containsHttpUrl(data.external_course_links)
    && hasText(data.external_course_motivation)
    && hasText(data.external_course_overlap)
  );
  const homologationMotivationPresent = hasText(data.homologation_motivation);

  const flags = {
    commonMandatoryComplete: commonMandatory === rules.commonMandatoryCredits,
    hasExactlyOneStream: Boolean(streamDefinition),
    streamMandatoryComplete: streamMandatory === rules.streamMandatoryCredits,
    streamElectiveTargetMet: streamElectivesSelected >= rules.streamElectiveTarget,
    streamElectiveMinimumMet: streamElectivesSelected >= rules.streamElectiveTarget,
    freeElectiveSpaceMet: freeElectiveSpace >= rules.freeElectiveSpaceTarget,
    freeElectiveSpaceOver: freeElectiveSpace > rules.freeElectiveSpaceTarget,
    graduationContextValid: graduation.contextValid,
    preparationProjectValid: graduation.contextValid,
    graduationProjectValid: graduation.contextValid,
    graduationPhaseComplete: graduationPhase === rules.graduationPhaseCredits,
    homologationWithinLimit: homologationCredits <= rules.homologationMaximum,
    selfChosenHomologationWithinLimit:
      selfChosenCount <= rules.selfChosenHomologationMaximumCount,
    homologationMotivationPresent:
      !selfChosenActive || (selfChosenCount > 0 && homologationMotivationPresent),
    internshipValid: !internship.selected || internship.valid,
    externalInformationComplete,
    externalCoursePresent,
    externalDeclarationConsistent,
    homologationAnswered,
    selfChosenAnswered,
    internshipAnswered,
    externalAnswered,
    externalReviewRequired: externalEvidenceRequired,
    homologationReviewRequired: homologationCredits > 0,
    hasInvalidManualRows: invalidManualRows.length > 0,
    hasInvalidStreamElectives: invalidStreamElectiveCourses.length > 0,
    hasStaleStreamSelections: staleStreamElectiveCourses.length > 0,
    hasIncompatibleCourses: incompatibleCombinations.length > 0,
    totalAtLeastTarget: total >= rules.programmeTarget,
    totalOverTarget: total > rules.programmeTarget,
  };

  const validations = buildEsValidations({
    flags,
    stream,
    streamMandatory,
    streamElectivesSelected,
    streamElectivesExcess,
    invalidStreamElectiveCourses,
    staleStreamElectiveCourses,
    freeElectiveSpace,
    graduation,
    graduationPhase,
    total,
    incompatibleCombinations,
    invalidManualRows,
    homologationCredits,
    selfChosenCount,
    selfChosenActive,
    homologationActive,
    validHomologationCount,
    homologationAnswered,
    selfChosenAnswered,
    homologationMotivationPresent,
    internship,
    internshipAnswered,
    externalCoursePresent,
    externalEvidenceRequired,
    externalDeclarationConsistent,
    externalAnswered,
    externalInformationComplete,
    streamElectiveCourses,
    rules,
    streamCount: config.streams.length,
    commonMandatoryCount: config.commonMandatoryCodes.length,
    seminarCodes: config.seminarCodes,
    internshipCodes: config.internshipCodes,
    externalCourseCodes: config.externalCourseCodes,
    externalCourseDisplayCodes: config.externalCourseDisplayCodes,
  });

  return {
    subtotals: {
      commonMandatory,
      streamMandatory,
      streamElectivesSelected,
      streamElectivesRequired,
      streamElectivesExcess,
      freeElectiveRows: freeElectiveRowCredits,
      homologation: homologationCredits,
      assignedHomologation: homologationCredits,
      selfChosenHomologation: 0,
      internship: internshipCredits,
      freeElectiveSpace,
      preparationProject: preparationProjectCredits,
      graduationProject: graduationProjectCredits,
      graduationPhase,
      mandatoryAndGraduation,
      total,
    },
    selected: {
      commonMandatoryCourses,
      stream,
      streamMandatoryCourses,
      streamElectiveCourses,
      requiredStreamElectiveCourses,
      excessStreamElectiveCourses,
      invalidStreamElectiveCourses,
      staleStreamElectiveCourses,
      freeElectiveRows,
      assignedHomologationRows: homologationRows,
      selfChosenHomologationRows: [],
      homologationRows,
      internship,
      preparationProject: graduation.preparationProject,
      graduationProject: graduation.graduationProject,
      incompatibleCombinations,
      graduationContext: graduation.context,
    },
    flags,
    validations,
    ...validationState(validations),
  };
}

export const calculateEcts = calculateEs;

function resolveGraduation(data, config, readCourse) {
  const values = selectedValues(data.graduation_context)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  const definition = values.length === 1
    ? config.graduationContexts.find(({ value }) => value === values[0]) ?? null
    : null;
  return {
    context: definition
      ? { value: definition.value, label: definition.label }
      : null,
    contextValid: Boolean(definition),
    preparationProject: definition
      ? readCourse(definition.questionName)(definition.preparationCode)
      : null,
    graduationProject: definition
      ? readCourse(definition.questionName)(definition.graduationCode)
      : null,
    preparationDetail:
      "A preparation-project code can be derived only after one valid graduation department is selected.",
    graduationDetail:
      "A graduation-project code can be derived only after one valid graduation department is selected.",
  };
}

function resolveInternship(data, config, readCourse) {
  const selected = booleanValue(data.internship) === true;
  const values = selected ? selectedValues(data.internship_code) : [];
  const type = String(data.internship_type ?? "").trim().toLowerCase();
  const valid = !selected || (
    values.length === 1
    && config.internshipCodes.map(normalizeEsCode).includes(normalizeEsCode(values[0]))
    && config.internshipTypes.has(type)
  );
  const course = selected && valid
    ? readCourse("internship_code")(values[0])
    : null;
  return {
    selected,
    valid,
    code: course?.code ?? "",
    course,
    credits: course?.credits ?? 0,
    type,
    supervisor: data.internship_supervisor ?? "",
    invalidValues: valid ? [] : values,
  };
}

function sumValidRows(rows) {
  return sumCourses(rows.filter(({ validCredits }) => validCredits));
}

function normalizeStreamValue(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export { normalizeEsCode };
export const normalizeCode = normalizeEsCode;

function hasText(value) {
  if (Array.isArray(value)) return value.some(hasText);
  if (value && typeof value === "object") return Object.values(value).some(hasText);
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function containsHttpUrl(value) {
  if (Array.isArray(value)) return value.some(containsHttpUrl);
  if (value && typeof value === "object") return Object.values(value).some(containsHttpUrl);
  return /https?:\/\/[^\s]+/i.test(String(value ?? ""));
}

function booleanValue(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
}

function hasBooleanAnswer(value) {
  return booleanValue(value) !== null;
}
