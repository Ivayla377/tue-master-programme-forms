// Calculates normalized IAM selections, credit totals, and validation inputs.
import {
  courseFromValue,
  normalizeCourseCode,
} from "../../shared/course-catalog.js";
import { isTrue } from "../../shared/credit-utils.js";
import {
  claimCourse,
  createCourseClaims,
  finalizeCourseClaims,
  sumCountedCourses,
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
  LISTED_FREE_ELECTIVE_CODES,
  SPECIALIZATION_ELECTIVE_CODES,
  createIamChoiceLookup,
  resolveIamRules,
  isIamQstTrack,
} from "./form-config.js";
import { buildIamValidations } from "./rules.js";

export {
  CORE_ELECTIVE_CODES,
  IAM_COURSE_CATALOG,
  MANDATORY_CODES,
  LISTED_FREE_ELECTIVE_CODES,
  SPECIALIZATION_ELECTIVE_CODES,
  createIamChoiceLookup,
};

export const createChoiceLookup = createIamChoiceLookup;
export const normalizeIamCode = normalizeCourseCode;
export const normalizeCode = normalizeCourseCode;

export function calculateIam(data = {}, choiceLookup = createIamChoiceLookup()) {
  const config = choiceLookup.iamConfig;
  const rules = resolveIamRules(data, config);
  const isQst = isIamQstTrack(data, config);
  const internshipInSpecialization = rules.internshipInSpecialization === 1;
  const duplicates = [];
  const claimed = createCourseClaims(choiceLookup);
  const readCourse = (value, questionName) =>
    courseFromValue(value, choiceLookup, questionName);

  const mandatoryCourses = (isQst ? config.qstMandatoryCodes : config.mandatoryCodes).map((code) =>
    readCourse(code, isQst ? IAM_QUESTION_NAMES.qstMandatory : IAM_QUESTION_NAMES.mandatory),
  );
  for (const course of mandatoryCourses) {
    course.counted = claimCourse(course, "Mandatory courses", claimed, duplicates);
  }

  const internship = resolveInternship(data, choiceLookup, config);
  internship.component = internshipInSpecialization ? "Specialization electives" : "Free electives";
  if (internship.course) {
    internship.counted = claimCourse(
      internship.course,
      internshipInSpecialization ? internship.component : "Internship",
      claimed,
      duplicates,
    );
    internship.exclusionReason = internship.counted
      ? ""
      : "Duplicate course; excluded from totals.";
  }

  const coreSelection = claimListedCourses({
    values: isQst ? [] : data.core_electives,
    allowedCodes: config.coreElectiveCodes,
    questionName: IAM_QUESTION_NAMES.core,
    component: "Core electives",
    choiceLookup,
    claimed,
    duplicates,
    invalidReason: "Not in the current PER list.",
  });
  const qstSelection = claimListedCourses({
    values: isQst ? data.qst_specialization_electives : [],
    allowedCodes: config.qstElectiveCodes,
    questionName: IAM_QUESTION_NAMES.qstSpecialization,
    component: "QST specialization electives",
    choiceLookup,
    claimed,
    duplicates,
    invalidReason: "Not in the QST elective list.",
  });
  const specializationSelection = claimListedCourses({
    values: data.specialization_electives,
    allowedCodes: isQst ? config.qstSpecializationElectiveCodes : config.specializationElectiveCodes,
    questionName: IAM_QUESTION_NAMES.specialization,
    component: "Specialization electives",
    choiceLookup,
    claimed,
    duplicates,
    invalidReason: "Not in the current PER list.",
  });
  const mastermathRows = claimManualCourseRows(
    normalizeManualCourseRows(data.mastermath_special_electives),
    "Mastermath / approved specialization",
    claimed,
    duplicates,
  );
  const listedFreeSelection = claimListedCourses({
    values: data.listed_free_electives,
    allowedCodes: config.listedFreeElectiveCodes,
    questionName: IAM_QUESTION_NAMES.listedFree,
    component: "Free electives",
    choiceLookup,
    claimed,
    duplicates,
    invalidReason: "Not in the current PER list.",
  });

  const homologationActive = isTrue(data.homologation);
  const selfChosenHomologationActive =
    homologationActive && isTrue(data.self_chosen_homologation);
  const homologationRows = homologationActive
    ? claimManualCourseRows(
        normalizeManualCourseRows(data.homologation_courses),
        "Homologation",
        claimed,
        duplicates,
      )
    : [];
  const selfChosenHomologationRows = selfChosenHomologationActive
    ? claimManualCourseRows(
        normalizeManualCourseRows(data.bachelor_free_electives, {
          requireLinkedCourse: true,
        }),
        "Self-chosen homologation",
        claimed,
        duplicates,
      )
    : [];
  const freeElectiveRows = claimManualCourseRows(
    normalizeManualCourseRows(data.free_electives),
    "Free electives",
    claimed,
    duplicates,
  );

  finalizeCourseClaims(claimed, duplicates);

  const useCalculatedValues =
    duplicates.length === 0
    && coreSelection.invalidCourses.length === 0
    && qstSelection.invalidCourses.length === 0
    && specializationSelection.invalidCourses.length === 0
    && listedFreeSelection.invalidCourses.length === 0
    && selfChosenHomologationRows.length === 0;
  const subtotal = (name, fallback) =>
    useCalculatedValues ? readNumericValue(data, name, fallback) : fallback;
  const mandatoryCredits = new Map(
    mandatoryCourses.filter((course) => course.counted).map((course) => [course.code, course.credits]),
  );

  const professionalPortfolio = subtotal(
    "professional_portfolio_credits",
    mandatoryCredits.get(normalizeCourseCode(config.professionalPortfolioCode)) ?? 0,
  );
  const finalProject = subtotal(
    "final_project_credits",
    mandatoryCredits.get(normalizeCourseCode(config.finalProjectCode)) ?? 0,
  );
  const mandatory = subtotal("mandatory_credits", sumCountedCourses(mandatoryCourses));
  const coreElectives = isQst ? 0 : subtotal(
    "core_elective_credits",
    sumCourses(coreSelection.courses),
  );
  const listedSpecialization = subtotal(
    "listed_specialization_credits",
    sumCourses(specializationSelection.courses),
  );
  const qstSpecialization = isQst ? subtotal(
    "qst_specialization_credits",
    sumCourses(qstSelection.courses),
  ) : 0;
  const mastermathSpecialization = subtotal(
    "mastermath_specialization_credits",
    sumCountedRows(mastermathRows),
  );
  const internshipCredits = subtotal(
    "internship_credits",
    internship.selected && internship.counted ? internship.credits : 0,
  );
  const specializationElectives = subtotal(
    "specialization_credits",
    roundCredits(qstSpecialization + listedSpecialization + mastermathSpecialization
      + (internshipInSpecialization ? internshipCredits : 0)),
  );
  const coreAndSpecialization = subtotal(
    "core_and_specialization_credits",
    roundCredits(coreElectives + specializationElectives),
  );
  const listedFreeElectives = subtotal(
    "listed_free_elective_credits",
    sumCourses(listedFreeSelection.courses),
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
      listedFreeElectives
      + (internshipInSpecialization ? 0 : internshipCredits)
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
    qstMinimumMet: !isQst || qstSpecialization >= rules.qstMinimum,
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
    hasInvalidListedFreeSelections:
      listedFreeSelection.invalidCourses.length > 0,
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
    isQst,
    qstSpecialization,
    invalidQstCourses: qstSelection.invalidCourses,
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
    invalidListedFreeCourses: listedFreeSelection.invalidCourses,
    duplicates,
    internship,
    selfChosenHomologationActive,
    homologationMotivationPresent,
  });

  return {
    rules,
    track: {
      isQst,
      label: config.trackChoices.find(choice => choice.value === (isQst ? "qst" : "standard"))?.text ?? "",
    },
    manualCourseTables: {
      free_electives: freeElectiveRows,
      homologation_courses: homologationRows,
      mastermath_special_electives: mastermathRows,
      bachelor_free_electives: selfChosenHomologationRows,
    },
    subtotals: {
      mandatory,
      professionalPortfolio,
      finalProject,
      coreElectives,
      qstSpecialization,
      listedSpecialization,
      mastermathSpecialization,
      specializationElectives,
      coreAndSpecialization,
      listedFreeElectives,
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
      qstSpecializationCourses: [...qstSelection.courses, ...qstSelection.duplicateCourses],
      invalidQstCourses: qstSelection.invalidCourses,
      coreElectiveCourses: [...coreSelection.courses, ...coreSelection.duplicateCourses],
      invalidCoreCourses: coreSelection.invalidCourses,
      specializationElectiveCourses: [...specializationSelection.courses, ...specializationSelection.duplicateCourses],
      invalidSpecializationCourses: specializationSelection.invalidCourses,
      mastermathSpecializationRows: mastermathRows,
      listedFreeElectiveCourses: [...listedFreeSelection.courses, ...listedFreeSelection.duplicateCourses],
      invalidListedFreeCourses: listedFreeSelection.invalidCourses,
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
