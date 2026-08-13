// Calculates normalized IAM selections, credit totals, and validation inputs.
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
  sumCountedRows,
  sumCourses,
} from "../../shared/course-selection.js";
import { readNumericValue } from "../../shared/survey-rules.js";
import { validationState } from "../../shared/validation-utils.js";
import {
  CORE_ELECTIVE_CODES,
  IAM_COURSE_CATALOG,
  IAM_QUESTION_NAMES,
  MANDATORY_CODES,
  OFFICIAL_FREE_ELECTIVE_CODES,
  SPECIALIZATION_ELECTIVE_CODES,
  createIamChoiceLookup,
  resolveIamRules,
} from "./form-config.js";
import { buildIamValidations } from "./rules.js";

export {
  CORE_ELECTIVE_CODES,
  IAM_COURSE_CATALOG,
  MANDATORY_CODES,
  OFFICIAL_FREE_ELECTIVE_CODES,
  SPECIALIZATION_ELECTIVE_CODES,
  createIamChoiceLookup,
};

export const createChoiceLookup = createIamChoiceLookup;
export const normalizeIamCode = normalizeCourseCode;
export const normalizeCode = normalizeCourseCode;

export function calculateIam(data = {}, choiceLookup = createIamChoiceLookup()) {
  const config = choiceLookup.iamConfig;
  const rules = resolveIamRules(data, config);
  const duplicates = [];
  const claimed = new Map();
  const readCourse = (value, questionName) =>
    courseFromValue(value, choiceLookup, questionName);

  const mandatoryCourses = config.mandatoryCodes.map((code) =>
    readCourse(code, IAM_QUESTION_NAMES.mandatory),
  );
  for (const course of mandatoryCourses) {
    claimCourse(course, "mandatory component", claimed, duplicates);
  }

  const coreSelection = claimListedCourses({
    values: data.core_electives,
    allowedCodes: config.coreElectiveCodes,
    questionName: IAM_QUESTION_NAMES.core,
    component: "core elective",
    choiceLookup,
    claimed,
    duplicates,
    invalidReason: "Not in the current PER list.",
  });
  const specializationSelection = claimListedCourses({
    values: data.specialization_electives,
    allowedCodes: config.specializationElectiveCodes,
    questionName: IAM_QUESTION_NAMES.specialization,
    component: "special elective",
    choiceLookup,
    claimed,
    duplicates,
    invalidReason: "Not in the current PER list.",
  });
  const mastermathRows = claimManualCourseRows(
    normalizeManualCourseRows(data.mastermath_special_electives),
    "Mastermath/special elective",
    claimed,
    duplicates,
  );
  const officialFreeSelection = claimListedCourses({
    values: data.official_free_electives,
    allowedCodes: config.officialFreeElectiveCodes,
    questionName: IAM_QUESTION_NAMES.officialFree,
    component: "free elective",
    choiceLookup,
    claimed,
    duplicates,
    invalidReason: "Not in the current PER list.",
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

  const homologationActive = isTrue(data.homologation);
  const selfChosenHomologationActive =
    homologationActive && isTrue(data.self_chosen_homologation);
  const homologationRows = homologationActive
    ? claimManualCourseRows(
        normalizeManualCourseRows(data.homologation_courses),
        "homologation",
        claimed,
        duplicates,
      )
    : [];
  const selfChosenHomologationRows = selfChosenHomologationActive
    ? claimManualCourseRows(
        normalizeManualCourseRows(data.bachelor_free_electives, {
          requireLinkedCourse: true,
        }),
        "self-chosen homologation",
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
    && coreSelection.invalidCourses.length === 0
    && specializationSelection.invalidCourses.length === 0
    && officialFreeSelection.invalidCourses.length === 0
    && selfChosenHomologationRows.length === 0;
  const subtotal = (name, fallback) =>
    useCalculatedValues ? readNumericValue(data, name, fallback) : fallback;
  const mandatoryCredits = new Map(
    mandatoryCourses.map((course) => [course.code, course.credits]),
  );

  const professionalPortfolio = subtotal(
    "professional_portfolio_credits",
    mandatoryCredits.get(normalizeCourseCode(config.professionalPortfolioCode)) ?? 0,
  );
  const finalProject = subtotal(
    "final_project_credits",
    mandatoryCredits.get(normalizeCourseCode(config.finalProjectCode)) ?? 0,
  );
  const mandatory = subtotal("mandatory_credits", sumCourses(mandatoryCourses));
  const coreElectives = subtotal(
    "core_elective_credits",
    sumCourses(coreSelection.courses),
  );
  const listedSpecialization = subtotal(
    "listed_specialization_credits",
    sumCourses(specializationSelection.courses),
  );
  const mastermathSpecialization = subtotal(
    "mastermath_specialization_credits",
    sumCountedRows(mastermathRows),
  );
  const specializationElectives = subtotal(
    "specialization_credits",
    roundCredits(listedSpecialization + mastermathSpecialization),
  );
  const coreAndSpecialization = subtotal(
    "core_and_specialization_credits",
    roundCredits(coreElectives + specializationElectives),
  );
  const officialFreeElectives = subtotal(
    "official_free_elective_credits",
    sumCourses(officialFreeSelection.courses),
  );
  const internshipCredits = subtotal(
    "internship_credits",
    internship.selected && internship.counted ? internship.credits : 0,
  );
  const assignedHomologation = subtotal(
    "assigned_homologation_credits",
    sumCountedRows(homologationRows),
  );
  const selfChosenHomologation = subtotal(
    "self_chosen_homologation_credits",
    sumCountedRows(selfChosenHomologationRows),
  );
  const homologation = subtotal(
    "homologation_credits",
    roundCredits(assignedHomologation + selfChosenHomologation),
  );
  const freeElectiveRowsCredits = subtotal(
    "manual_free_elective_credits",
    sumCountedRows(freeElectiveRows),
  );
  const freeElectiveSpace = subtotal(
    "free_elective_space_credits",
    roundCredits(
      officialFreeElectives
      + internshipCredits
      + homologation
      + freeElectiveRowsCredits,
    ),
  );
  const total = subtotal(
    "total_programme_credits",
    roundCredits(mandatory + coreAndSpecialization + freeElectiveSpace),
  );

  const invalidManualRows = [
    ...mastermathRows,
    ...homologationRows,
    ...selfChosenHomologationRows,
    ...freeElectiveRows,
  ].filter((row) => !row.validCredits);
  const coreCount = coreSelection.courses.length;
  const homologationRowsPresent = homologationRows.some(
    (row) => row.validCredits && row.counted,
  );
  const homologationMotivationPresent =
    String(data.homologation_motivation ?? "").trim() !== "";
  const flags = {
    coreMinimumMet: coreElectives >= rules.coreMinimum,
    coreCountMet: coreCount >= rules.coreMinimumCount,
    coreSpecializationMinimumMet:
      coreAndSpecialization >= rules.coreSpecializationMinimum,
    totalAtLeastTarget: total >= rules.programmeTarget,
    totalOverTarget: total > rules.programmeTarget,
    homologationWithinLimit: homologation <= rules.homologationMaximum,
    hasInvalidCoreSelections: coreSelection.invalidCourses.length > 0,
    hasInvalidSpecializationSelections:
      specializationSelection.invalidCourses.length > 0,
    hasInvalidOfficialFreeSelections:
      officialFreeSelection.invalidCourses.length > 0,
    hasInvalidManualRows: invalidManualRows.length > 0,
    hasDuplicates: duplicates.length > 0,
    hasAssignedHomologation: homologationRowsPresent,
    hasSelfChosenHomologation:
      selfChosenHomologationActive
      && (homologationRowsPresent || selfChosenHomologation > 0),
    hasMastermathSpecialization: mastermathSpecialization > 0,
    hasInternship: internship.selected && internship.counted,
  };
  const validations = buildIamValidations({
    flags,
    rules,
    coreElectives,
    coreCount,
    specializationElectives,
    coreAndSpecialization,
    total,
    assignedHomologation,
    selfChosenHomologation,
    homologation,
    invalidManualRows,
    invalidCoreCourses: coreSelection.invalidCourses,
    invalidSpecializationCourses: specializationSelection.invalidCourses,
    invalidOfficialFreeCourses: officialFreeSelection.invalidCourses,
    duplicates,
    internship,
    selfChosenHomologationActive,
    homologationMotivationPresent,
  });

  return {
    rules,
    subtotals: {
      mandatory,
      professionalPortfolio,
      finalProject,
      coreElectives,
      listedSpecialization,
      mastermathSpecialization,
      specializationElectives,
      coreAndSpecialization,
      officialFreeElectives,
      internship: internshipCredits,
      assignedHomologation,
      selfChosenHomologation,
      homologation,
      freeElectiveRows: freeElectiveRowsCredits,
      freeElectiveSpace,
      total,
    },
    selected: {
      mandatoryCourses,
      coreElectiveCourses: coreSelection.courses,
      invalidCoreCourses: coreSelection.invalidCourses,
      specializationElectiveCourses: specializationSelection.courses,
      invalidSpecializationCourses: specializationSelection.invalidCourses,
      mastermathSpecializationRows: mastermathRows,
      officialFreeElectiveCourses: officialFreeSelection.courses,
      invalidOfficialFreeCourses: officialFreeSelection.invalidCourses,
      internship,
      homologationRows,
      selfChosenHomologationRows,
      freeElectiveRows,
      duplicates,
    },
    flags,
    validations,
    ...validationState(validations, { warningsAreComplete: true }),
  };
}

export const calculateEcts = calculateIam;

function resolveInternship(data, choiceLookup, config) {
  const selected = isTrue(data.internship);
  const code = config.internshipCodes[0] ?? "";
  const course = selected && code
    ? courseFromValue(code, choiceLookup, IAM_QUESTION_NAMES.internship)
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
