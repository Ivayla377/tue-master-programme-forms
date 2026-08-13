// Calculates normalized CYBR selections, credit totals, and validation inputs.
import {
  courseFromValue,
  normalizeCourseCode,
} from "../../shared/course-catalog.js";
import { isTrue } from "../../shared/credit-utils.js";
import {
  claimCourse,
  claimListedCourses,
  claimManualCourseRows,
  normalizeManualCourseRows,
  roundCredits,
  sumCountedCourses,
  sumCountedRows,
  sumCourses,
} from "../../shared/course-selection.js";
import { readNumericValue } from "../../shared/survey-rules.js";
import { validationState } from "../../shared/validation-utils.js";
import {
  GRADUATION_PATHS,
  CYBR_COURSE_CATALOG,
  CYBR_ELECTIVE_CODES,
  CYBR_QUESTION_NAMES,
  MANDATORY_CODES,
  MCS_ELECTIVE_CODES,
  createCybrChoiceLookup,
  resolveCybrRules,
} from "./form-config.js";
import { buildCybrValidations } from "./rules.js";

export {
  GRADUATION_PATHS,
  CYBR_COURSE_CATALOG,
  CYBR_ELECTIVE_CODES,
  MANDATORY_CODES,
  MCS_ELECTIVE_CODES,
  createCybrChoiceLookup,
};

export const createChoiceLookup = createCybrChoiceLookup;
export const normalizeCybrCode = normalizeCourseCode;
export const normalizeCode = normalizeCourseCode;

export function calculateCybr(data = {}, choiceLookup = createCybrChoiceLookup()) {
  const config = choiceLookup.cybrConfig;
  const rules = resolveCybrRules(data, config);
  const duplicates = [];
  const claimed = new Map();
  const readCourse = (value, questionName) =>
    courseFromValue(value, choiceLookup, questionName);

  const mandatoryFixedCourses = config.mandatoryCodes.map((code) =>
    readCourse(code, CYBR_QUESTION_NAMES.mandatory),
  );
  for (const course of mandatoryFixedCourses) {
    course.counted = claimCourse(
      course,
      "mandatory component",
      claimed,
      duplicates,
    );
  }

  const graduation = resolveGraduation(
    data,
    choiceLookup,
    config,
    claimed,
    duplicates,
  );
  const cybrSelection = claimListedCourses({
    values: data.cybr_electives,
    allowedCodes: config.cybrElectiveCodes,
    questionName: CYBR_QUESTION_NAMES.cybrElectives,
    component: "CYBR elective",
    choiceLookup,
    claimed,
    duplicates,
  });

  const internship = resolveInternship(data, choiceLookup, config);
  if (internship.course) {
    internship.counted = claimCourse(
      internship.course,
      "internship",
      claimed,
      duplicates,
    );
    internship.exclusionReason = internship.counted
      ? ""
      : "Duplicate course; excluded from totals.";
  }

  const mcsSelection = claimListedCourses({
    values: data.mcs_course_electives,
    allowedCodes: config.mcsElectiveCodes,
    questionName: CYBR_QUESTION_NAMES.mcsElectives,
    component: "IAM or CSE elective",
    choiceLookup,
    claimed,
    duplicates,
  });
  const otherMcsCoursesActive = isTrue(data.other_mcs_courses);
  const mcsRows = otherMcsCoursesActive
    ? claimManualCourseRows(
        normalizeManualCourseRows(data.mcs_other_courses),
        "IAM or CSE elective",
        claimed,
        duplicates,
      )
    : [];

  const homologationActive = isTrue(data.homologation);
  const homologationRows = homologationActive
    ? claimManualCourseRows(
        normalizeManualCourseRows(
          data.homologation_courses ?? data.assigned_homologation_courses,
        ),
        "homologation",
        claimed,
        duplicates,
      )
    : [];
  const freeElectiveRows = claimManualCourseRows(
    normalizeManualCourseRows(data.free_electives),
    "free elective",
    claimed,
    duplicates,
  );

  const useCalculatedValues =
    duplicates.length === 0
    && cybrSelection.invalidCourses.length === 0
    && mcsSelection.invalidCourses.length === 0
    && (!data.graduation_course_set || graduation.valid);
  const subtotal = (name, fallback) =>
    useCalculatedValues ? readNumericValue(data, name, fallback) : fallback;

  const mandatoryFixed = subtotal(
    "mandatory_fixed_credits",
    sumCountedCourses(mandatoryFixedCourses),
  );
  const graduationCredits = subtotal(
    "graduation_credits",
    sumCountedCourses(graduation.courses),
  );
  const mandatory = subtotal(
    "mandatory_credits",
    roundCredits(mandatoryFixed + graduationCredits),
  );
  const cybrElectives = subtotal(
    "cybr_elective_credits",
    sumCourses(cybrSelection.courses),
  );
  const mcsCourseElectives = subtotal(
    "mcs_course_credits",
    sumCourses(mcsSelection.courses),
  );
  const manualMcsElectives = subtotal(
    "manual_mcs_elective_credits",
    sumCountedRows(mcsRows),
  );
  const internshipCredits = subtotal(
    "internship_credits",
    internship.selected && internship.counted ? internship.credits : 0,
  );
  const mcsElectives = subtotal(
    "mcs_elective_credits",
    roundCredits(
      mcsCourseElectives + manualMcsElectives + internshipCredits,
    ),
  );
  const homologationCourses = subtotal(
    "homologation_course_credits",
    sumCountedRows(homologationRows),
  );
  const homologation = subtotal("homologation_credits", homologationCourses);
  const manualFreeElectives = subtotal(
    "manual_free_elective_credits",
    sumCountedRows(freeElectiveRows),
  );
  const otherFreeElectives = subtotal(
    "other_free_elective_credits",
    roundCredits(manualFreeElectives + homologation),
  );
  const freeElectiveSpace = subtotal(
    "free_elective_space_credits",
    roundCredits(mcsElectives + otherFreeElectives),
  );
  const total = subtotal(
    "total_programme_credits",
    roundCredits(mandatory + cybrElectives + freeElectiveSpace),
  );

  const invalidManualRows = [
    ...mcsRows,
    ...homologationRows,
    ...freeElectiveRows,
  ].filter((row) => !row.validCredits);
  const cybrElectiveCount = cybrSelection.courses.length;
  const flags = {
    graduationCourseSetComplete:
      graduation.valid && mandatory >= rules.mandatoryCredits,
    cybrElectiveMinimumMet:
      cybrElectives >= rules.cybrElectiveMinimum
      && cybrElectiveCount >= rules.cybrElectiveMinimumCount,
    mcsMinimumMet: mcsElectives >= rules.mcsMinimum,
    freeElectiveSpaceMinimumMet:
      freeElectiveSpace >= rules.freeElectiveSpaceMinimum,
    totalAtLeastTarget: total >= rules.programmeTarget,
    homologationWithinLimit: homologation <= rules.homologationMaximum,
    homologationSelectionComplete:
      !homologationActive || homologationRows.length > 0,
    otherMcsCoursesSelectionComplete:
      !otherMcsCoursesActive || mcsRows.length > 0,
  };
  const validations = buildCybrValidations({
    flags,
    rules,
    graduation,
    cybrElectives,
    cybrElectiveCount,
    mcsElectives,
    freeElectiveSpace,
    total,
    homologationCourses,
    homologation,
    invalidManualRows,
    invalidCybrCourses: cybrSelection.invalidCourses,
    invalidMcsCourses: mcsSelection.invalidCourses,
    duplicates,
    internship,
  });

  return {
    rules,
    subtotals: {
      mandatoryFixed,
      graduation: graduationCredits,
      mandatory,
      cybrElectives,
      mcsCourseElectives,
      manualMcsElectives,
      internship: internshipCredits,
      mcsElectives,
      manualFreeElectives,
      homologationCourses,
      homologation,
      otherFreeElectives,
      freeElectiveSpace,
      total,
    },
    selected: {
      mandatoryFixedCourses,
      graduation,
      cybrElectiveCourses: cybrSelection.courses,
      invalidCybrCourses: cybrSelection.invalidCourses,
      mcsElectiveCourses: mcsSelection.courses,
      invalidMcsCourses: mcsSelection.invalidCourses,
      mcsRows,
      homologationRows,
      freeElectiveRows,
      internship,
      duplicates,
    },
    flags,
    validations,
    ...validationState(validations, { warningsAreComplete: true }),
  };
}

export const calculateEcts = calculateCybr;

function resolveGraduation(data, choiceLookup, config, claimed, duplicates) {
  const value = String(data.graduation_course_set ?? "").trim();
  const path = config.graduationPaths.find((item) => item.value === value);
  const courses = path
    ? path.codes.map((code) =>
        courseFromValue(code, choiceLookup, path.questionName),
      )
    : [];
  for (const course of courses) {
    course.counted = claimCourse(
      course,
      "graduation component",
      claimed,
      duplicates,
    );
  }
  return {
    value,
    label: path?.label ?? "",
    valid: Boolean(path && courses.length > 0),
    courses,
  };
}

function resolveInternship(data, choiceLookup, config) {
  const selected = isTrue(data.internship);
  const code = config.internshipCodes[0] ?? "";
  const course = selected && code
    ? courseFromValue(code, choiceLookup, CYBR_QUESTION_NAMES.internship)
    : null;
  return {
    selected,
    course,
    code: course?.code ?? "",
    displayCode: course?.displayCode ?? "",
    title: course?.title ?? "",
    credits: course?.credits ?? 0,
    supervisor: data.internship_supervisor ?? "",
    counted: false,
    exclusionReason: "",
  };
}
