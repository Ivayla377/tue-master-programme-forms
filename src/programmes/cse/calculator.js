// Calculates normalized CSE selections, credit totals, and validation inputs.
import {
  courseFromValue,
  normalizeCourseCode as normalizeCode,
  selectedValues,
} from "../../shared/course-catalog.js";
import {
  isTrue,
  sumCredits as sumSharedCredits,
} from "../../shared/credit-utils.js";
import {
  claimCourse as claim,
  claimManualCourseRows as processRows,
  normalizeManualCourseRows as normalizeRows,
  renameCourseClaim as renameClaimedComponent,
  repeatedCourseCodes as repeatedCodes,
  sumCountedCourses,
  sumCountedRows,
  uniqueCourseCodes as uniqueCodes,
} from "../../shared/course-selection.js";
import { allocateCoursesToTarget } from "../../shared/elective-allocation.js";
import { validationState } from "../../shared/validation-utils.js";
import {
  CSE_COURSE_CREDITS,
  CSE_FOCUS_AREAS,
  CSE_GRADUATION_GROUPS,
  CSE_SPECIALIZATION_TARGET,
  createCseChoiceLookup,
  resolveCseRules,
} from "./form-config.js";
import {
  buildCseValidations,
} from "./rules.js";

export {
  CSE_COURSE_CREDITS,
  CSE_FOCUS_AREAS,
  CSE_GRADUATION_GROUPS,
  CSE_SPECIALIZATION_TARGET,
  createCseChoiceLookup,
};

export function calculateCse(data = {}, choiceLookup = createCseChoiceLookup()) {
  const config = choiceLookup.cseConfig;
  const rules = resolveCseRules(data, config);
  const doubleCountedCourses = [];
  const claimed = new Map();
  const foundationalSelections = config.foundationalFields.map(({ focus, field }) => ({
    focus,
    field,
    code: normalizeCode(data[field]),
  })).filter((selection) => selection.code !== "");
  const foundationalCodes = uniqueCodes(foundationalSelections.map((selection) => selection.code));
  const foundationalCourses = foundationalCodes.map((code) =>
    makeCourse(code, "foundational_algorithms", choiceLookup, rules),
  );
  for (const course of foundationalCourses) {
    course.counted = claim(course, "foundational course", claimed, doubleCountedCourses);
  }
  const foundationAssignment = new Map(
    foundationalSelections.map((selection) => [
      selection.focus,
      makeCourse(selection.code, selection.field, choiceLookup, rules),
    ]),
  );

  const extraFocus = String(data.extra_focus_area ?? "");
  const extraField = config.focusAreas.some((area) => area.value === extraFocus)
    ? `extra_${extraFocus}`
    : "extra";
  const extraCodes = uniqueCodes(data[extraField] ?? data.extra);
  const extraCandidateCourses = extraCodes.map((code) =>
    makeCourse(code, extraField, choiceLookup, rules));
  const extraCourses = [];
  for (const course of extraCandidateCourses) {
    if (claim(course, "extra course", claimed, doubleCountedCourses)) {
      course.counted = true;
      extraCourses.push(course);
    } else {
      course.counted = false;
    }
  }
  const extraOutsideFocus = extraCourses.filter(
    (course) => !config.courseFocuses.get(course.code)?.has(extraFocus),
  );

  const legacySpecialization = selectedValues(data.specialization_courses).filter(
    (code) => normalizeCode(code)
      !== normalizeCode(config.internshipCodes[0]),
  );
  const specializationRawCodes = [
    ...config.specializationFields.flatMap((field) => selectedValues(data[field])),
    ...legacySpecialization,
  ].map(normalizeCode).filter(Boolean);
  const duplicateSpecializationCodes = repeatedCodes(specializationRawCodes);
  const specializationCodes = uniqueCodes(specializationRawCodes);
  const specializationCandidateCourses = specializationCodes.map((code) =>
    makeCourse(code, "specialization_additional", choiceLookup, rules),
  );
  const selectedSpecializationCourses = [];
  for (const course of specializationCandidateCourses) {
    if (claim(course, "specialization elective", claimed, doubleCountedCourses)) {
      course.counted = true;
      selectedSpecializationCourses.push(course);
    } else {
      course.counted = false;
    }
  }

  const internshipSelected = isTrue(data.internship)
    || selectedValues(data.specialization_courses)
      .map(normalizeCode)
      .includes(normalizeCode(config.internshipCodes[0]));
  const internshipCourse = internshipSelected
    ? makeCourse(
      config.internshipCodes[0],
      "internship_course_display",
      choiceLookup,
      rules,
    )
    : null;
  if (internshipCourse) {
    internshipCourse.counted = claim(internshipCourse, "internship", claimed, doubleCountedCourses);
  }
  const internshipCredits = internshipCourse?.counted ? internshipCourse.credits : 0;
  const specializationCourseTarget = Math.max(
    0,
    rules.specializationTarget - internshipCredits,
  );
  const specializationAllocation = allocateCoursesToTarget(
    selectedSpecializationCourses,
    specializationCourseTarget,
  );
  const specializationCourses = specializationAllocation.required;
  const excessSpecializationCourses = specializationAllocation.excess;
  for (const course of excessSpecializationCourses) {
    renameClaimedComponent(
      course,
      "additional specialization elective in free-elective space",
      claimed,
    );
  }

  const duplicateSpecializationCourses = duplicateSpecializationCodes.map((code) =>
    makeCourse(code, "specialization_additional", choiceLookup, rules),
  );

  const seminar = data.seminar
    ? makeCourse(data.seminar, "seminar", choiceLookup, rules)
    : null;
  if (seminar) {
    seminar.counted = claim(seminar, "seminar", claimed, doubleCountedCourses);
  }

  const graduationCodes = data.graduation_courses === undefined
    ? config.graduationCodes
    : uniqueCodes(data.graduation_courses);
  const graduationCourses = graduationCodes.map((code) =>
    makeCourse(code, "graduation_courses", choiceLookup, rules),
  );
  for (const course of graduationCourses) {
    course.counted = claim(course, "graduation project", claimed, doubleCountedCourses);
  }

  const homologationRows = processRows(
    isTrue(data.homologation) ? normalizeRows(data.homologation_courses) : [],
    "homologation",
    claimed,
    doubleCountedCourses,
  );
  const freeRows = processRows(
    normalizeRows(data.free_electives),
    "free elective",
    claimed,
    doubleCountedCourses,
  );
  const invalidFreeRows = freeRows.filter((row) => !row.validCredits);
  const invalidHomologationRows = homologationRows.filter((row) => !row.validCredits);
  const manualFreeCredits = sumCountedRows(freeRows);
  const specializationExcessCredits = specializationAllocation.excessCredits;
  const freeCredits = manualFreeCredits + specializationExcessCredits;
  const homologationCredits = sumCountedRows(homologationRows);
  const freeSpaceTotal = freeCredits + homologationCredits;

  const foundationalCredits = sumCountedCourses(foundationalCourses);
  const extraCredits = sumCountedCourses(extraCourses);
  const specializationCourseCredits = specializationAllocation.requiredCredits;
  const specializationCredits = specializationCourseCredits + internshipCredits;
  const seminarCredits = seminar?.counted ? seminar.credits : 0;
  const graduationCredits = sumCountedCourses(graduationCourses);
  const totalCredits =
    foundationalCredits
    + extraCredits
    + specializationCredits
    + freeSpaceTotal
    + seminarCredits
    + graduationCredits;

  const validations = buildCseValidations({
    foundationalSelections,
    foundationalCourses,
    extraCourses,
    extraFocus,
    extraOutsideFocus,
    specializationCourses,
    duplicateSpecializationCourses,
    doubleCountedCourses,
    specializationCredits,
    specializationExcessCredits,
    internshipSelected,
    internshipCourse,
    freeSpaceTotal,
    seminarCredits,
    graduationCredits,
    totalCredits,
    freeRows,
    homologationRows,
    invalidFreeRows,
    invalidHomologationRows,
    rules,
    focusAreas: config.focusAreas,
    data,
  });

  return {
    subtotals: {
      foundational: foundationalCredits,
      extra: extraCredits,
      specializationCoursesSelected: sumCountedCourses(selectedSpecializationCourses),
      specializationCourses: specializationCourseCredits,
      specializationExcess: specializationExcessCredits,
      internship: internshipCredits,
      specialization: specializationCredits,
      manualFreeElectives: manualFreeCredits,
      freeElectives: freeCredits,
      homologation: homologationCredits,
      freeSpace: freeSpaceTotal,
      seminar: seminarCredits,
      graduation: graduationCredits,
      total: totalCredits,
    },
    selected: {
      foundationalCourses,
      extraCourses,
      specializationCourses,
      allSpecializationCourses: selectedSpecializationCourses,
      excessSpecializationCourses,
      foundationAssignment,
      extraFocus,
      seminar,
      freeRows,
      homologationRows,
      graduationCourses,
      internship: {
        selected: internshipSelected,
        supervisor: data.internship_supervisor ?? "",
        credits: internshipCredits,
        course: internshipCourse,
        counted: internshipCourse?.counted ?? false,
        exclusionReason:
          internshipCourse && !internshipCourse.counted ? "Duplicate course; excluded from totals." : "",
      },
      doubleCountedCourses,
      duplicateSpecializationCourses,
    },
    validations,
    ...validationState(validations),
  };
}

function makeCourse(code, questionName, choiceLookup, rules) {
  const course = courseFromValue(
    code,
    choiceLookup,
    questionName,
    rules.standardCourseCredits,
  );
  const metadata = choiceLookup.getCourse(questionName, code);
  return {
    ...course,
    label: metadata?.text ?? course.label,
  };
}

function sumCredits(items) {
  return sumSharedCredits(items);
}
