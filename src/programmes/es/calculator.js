// Calculates normalized ES selections, allocated credits, and validation inputs.
import {
  courseFromValue,
  normalizeCourseCode as normalizeEsCode,
  selectedValues,
} from "../../shared/course-catalog.js";
import {
  claimCourse,
  claimManualCourseRows,
  createCourseClaims,
  finalizeCourseClaims,
  normalizeManualCourseRows,
  sumCountedCourses,
  sumCountedRows,
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
  const claimed = createCourseClaims(choiceLookup);
  const duplicates = [];

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
  const graduation = resolveGraduation(config, readCourse);
  const internship = resolveInternship(data, rules, choiceLookup, config);
  const claim = (courses, section) => {
    for (const course of courses.filter(Boolean)) claimCourse(course, section, claimed, duplicates);
  };
  claim(commonMandatoryCourses, "Common mandatory courses");
  claim([graduation.preparationProject, graduation.graduationProject, ...graduation.additionalCourses], "Graduation courses");
  claim(streamMandatoryCourses, "Stream mandatory courses");
  claim([internship.course], "Internship");
  internship.counted = internship.course?.counted ?? false;

  const activeElectiveValues = streamDefinition
    ? selectedValues(data[streamDefinition.electiveQuestion])
    : [];
  const allowedElectiveCodes = new Set(
    (streamDefinition?.electiveCodes ?? []).map(claimed.identity),
  );
  const streamElectiveCourses = [];
  const invalidStreamElectiveCourses = [];
  const duplicateStreamElectiveCourses = [];
  for (const value of activeElectiveValues) {
    const course = readCourse(streamDefinition.electiveQuestion)(value);
    if (allowedElectiveCodes.has(claimed.identity(course.code))) {
      if (claimCourse(course, "Stream electives", claimed, duplicates)) {
        streamElectiveCourses.push(course);
      } else {
        duplicateStreamElectiveCourses.push(course);
      }
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

  const homologationActive = booleanValue(data.homologation) === true;
  const homologationRows = homologationActive
    ? claimManualCourseRows(normalizeManualCourseRows(data.homologation_courses), "Homologation", claimed, duplicates)
    : [];
  const freeElectiveRows = claimManualCourseRows(
    normalizeManualCourseRows(data.free_electives), "Free electives", claimed, duplicates,
  );
  finalizeCourseClaims(claimed, duplicates);
  const subtotal = (name, fallback) => duplicates.length > 0
    ? fallback : readNumericValue(data, name, fallback);
  const selfChosenActive = homologationActive
    && booleanValue(data.self_chosen_homologation) === true;
  const validHomologationCount = homologationRows.filter(
    ({ validCredits, counted }) => validCredits && counted,
  ).length;
  const selfChosenCount = selfChosenActive ? validHomologationCount : 0;

  const commonMandatory = subtotal(
    "credits_common_mandatory",
    sumCountedCourses(commonMandatoryCourses),
  );
  const streamMandatory = subtotal(
    "credits_stream_mandatory",
    sumCountedCourses(streamMandatoryCourses),
  );
  const streamElectivesSelected = subtotal(
    "credits_stream_electives_selected",
    sumCourses(streamElectiveCourses),
  );
  const streamElectivesRequired = subtotal(
    "credits_stream_electives_required",
    streamElectiveAllocation.requiredCredits,
  );
  const streamElectivesExcess = subtotal(
    "credits_stream_electives_excess",
    streamElectiveAllocation.excessCredits,
  );
  const freeElectiveRowCredits = subtotal(
    "credits_free_rows",
    sumCountedRows(freeElectiveRows),
  );
  const homologationCredits = subtotal(
    "credits_homologation",
    sumCountedRows(homologationRows),
  );
  const internshipCredits = subtotal(
    "credits_internship",
    internship.selected && internship.valid && internship.counted ? internship.credits : 0,
  );
  const freeElectiveSpace = subtotal(
    "credits_free_space",
    sumCourses([
      { credits: streamElectivesExcess },
      { credits: freeElectiveRowCredits },
      { credits: homologationCredits },
      { credits: internshipCredits },
    ]),
  );
  const preparationProjectCredits = subtotal(
    "credits_preparation_project",
    graduation.preparationProject?.counted ? graduation.preparationProject.credits : 0,
  );
  const graduationProjectCredits = subtotal(
    "credits_graduation_project",
    graduation.graduationProject?.counted ? graduation.graduationProject.credits : 0,
  );
  const graduationPhase = subtotal(
    "credits_graduation_phase",
    sumCourses([
      { credits: preparationProjectCredits },
      { credits: graduationProjectCredits },
      ...graduation.additionalCourses.filter((course) => course.counted),
    ]),
  );
  const mandatoryAndGraduation = subtotal(
    "credits_mandatory_and_graduation",
    sumCourses([
      { credits: commonMandatory },
      { credits: graduationPhase },
    ]),
  );
  const total = subtotal(
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
    hasText(data.external_course_institutions)
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
    preparationProjectValid: Boolean(graduation.preparationProject),
    graduationProjectValid: Boolean(graduation.graduationProject),
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
    duplicates,
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
    externalCourseCodes: config.externalCourseCodes,
    externalCourseDisplayCodes: config.externalCourseDisplayCodes,
  });

  return {
    allocationCredits: {
      credits_stream_electives_excess: streamElectivesExcess,
    },
    manualCourseTables: {
      free_electives: freeElectiveRows,
      homologation_courses: homologationRows,
    },
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
      requiredStreamElectiveCourses: [...requiredStreamElectiveCourses, ...duplicateStreamElectiveCourses],
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
      additionalGraduationCourses: graduation.additionalCourses,
      incompatibleCombinations,
      duplicates,
    },
    flags,
    validations,
    ...validationState(validations),
  };
}

export const calculateEcts = calculateEs;

function resolveGraduation(config, readCourse) {
  const definition = config.graduationCourses;
  const preparationProject = definition.preparationCode
    ? readCourse(definition.questionName)(definition.preparationCode)
    : null;
  const graduationProject = definition.graduationCode
    ? readCourse(definition.questionName)(definition.graduationCode)
    : null;
  return {
    preparationProject,
    graduationProject,
    additionalCourses: definition.additionalCodes.map(readCourse(definition.questionName)),
    preparationDetail:
      "The fixed preparation graduation project is missing from the ES form definition.",
    graduationDetail:
      "The fixed graduation project is missing from the ES form definition.",
  };
}

function resolveInternship(data, rules, choiceLookup, config) {
  const selected = booleanValue(data.internship) === true;
  const code = config.internshipCodes[0];
  const course = selected && code
    ? courseFromValue(code, choiceLookup, "internship_course_display")
    : null;
  if (course) course.credits = rules.internshipCredits;
  return {
    selected,
    valid: !selected || Boolean(course),
    code: course?.code ?? "",
    course,
    credits: selected ? rules.internshipCredits : 0,
    supervisor: data.internship_supervisor ?? "",
    invalidValues: [],
  };
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
