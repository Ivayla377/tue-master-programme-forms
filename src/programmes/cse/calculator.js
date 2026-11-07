// Calculates normalized CSE selections, credit totals, and validation inputs.
import {
  courseFromValue,
  normalizeCourseCode as normalizeCode,
  selectedValues,
} from "../../shared/course-catalog.js";
import {
  isTrue,
} from "../../shared/credit-utils.js";
import {
  claimCourse as claim,
  createCourseClaims,
  finalizeCourseClaims,
  claimManualCourseRows as processRows,
  normalizeManualCourseRows as normalizeRows,
  renameCourseClaim as renameClaimedComponent,
  sumCountedCourses,
  sumCountedRows,
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
  const claimed = createCourseClaims(choiceLookup);
  const graduationCodes = data.graduation_courses === undefined
    ? config.graduationCodes
    : selectedValues(data.graduation_courses);
  const graduationCourses = graduationCodes.map((code) =>
    makeCourse(code, "graduation_courses", choiceLookup, rules),
  );
  for (const course of graduationCourses) {
    course.counted = claim(course, "Graduation courses", claimed, doubleCountedCourses);
  }

  const foundationalSelections = config.foundationalFields.map(({ focus, field }) => ({
    focus,
    field,
    code: normalizeCode(data[field]),
  })).filter((selection) => selection.code !== "");
  const foundationAssignment = new Map();
  const foundationalCourses = foundationalSelections.map((selection) => {
    const course = makeCourse(selection.code, selection.field, choiceLookup, rules);
    const area = config.focusAreas.find(({ value }) => value === selection.focus)?.label ?? selection.focus;
    claim(course, `Foundational courses (${area})`, claimed, doubleCountedCourses);
    foundationAssignment.set(selection.focus, course);
    return course;
  });

  const extraFocus = String(data.extra_focus_area ?? "");
  const extraField = config.focusAreas.some((area) => area.value === extraFocus)
    ? `extra_${extraFocus}`
    : "extra";
  const extraCodes = selectedValues(data[extraField] ?? data.extra);
  const extraCandidateCourses = extraCodes.map((code) =>
    makeCourse(code, extraField, choiceLookup, rules));
  const extraCourses = [];
  for (const course of extraCandidateCourses) {
    if (claim(course, "Extra courses", claimed, doubleCountedCourses)) {
      course.counted = true;
      extraCourses.push(course);
    } else {
      course.counted = false;
    }
  }
  const extraOutsideFocus = extraCourses.filter(
    (course) => !config.courseFocuses.get(course.code)?.has(extraFocus),
  );

  const internshipSelected = isTrue(data.internship)
    || selectedValues(data.specialization_courses)
      .map(claimed.identity)
      .includes(claimed.identity(config.internshipCodes[0]));
  const internshipCourse = internshipSelected
    ? makeCourse(
      config.internshipCodes[0],
      "internship_course_display",
      choiceLookup,
      rules,
    )
    : null;
  if (internshipCourse) {
    internshipCourse.counted = claim(internshipCourse, "Internship", claimed, doubleCountedCourses);
  }
  const internshipCredits = internshipCourse?.counted ? internshipCourse.credits : 0;

  const legacySpecialization = selectedValues(data.specialization_courses).filter(
    (code) => claimed.identity(code)
      !== claimed.identity(config.internshipCodes[0]),
  );
  const specializationSelections = [
    ...config.specializationFields.flatMap((field) =>
      selectedValues(data[field]).map((code) => ({ code, field }))),
    ...legacySpecialization.map((code) => ({ code, field: "specialization_courses" })),
  ];
  const specializationCandidateCourses = specializationSelections.map(({ code, field }) => {
    const course = makeCourse(code, field, choiceLookup, rules);
    const section = choiceLookup.getQuestion(field)?.title ?? "Specialization electives";
    claim(course, `Specialization electives (${section})`, claimed, doubleCountedCourses);
    return course;
  });
  const selectedSpecializationCourses = specializationCandidateCourses.filter((course) => course.counted);
  const duplicateSpecializationCourses = specializationCandidateCourses.filter((course) => course.duplicate);

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
      "Additional specialization electives",
      claimed,
    );
  }

  const seminar = data.seminar
    ? makeCourse(data.seminar, "seminar", choiceLookup, rules)
    : null;
  if (seminar) {
    seminar.counted = claim(seminar, "Seminar", claimed, doubleCountedCourses);
  }

  const homologationRows = processRows(
    isTrue(data.homologation) ? normalizeRows(data.homologation_courses) : [],
    "Homologation",
    claimed,
    doubleCountedCourses,
  );
  const freeRows = processRows(
    normalizeRows(data.free_electives),
    "Free electives",
    claimed,
    doubleCountedCourses,
  );
  finalizeCourseClaims(claimed, doubleCountedCourses);

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
    foundationalCourses: foundationalCourses.filter((course) => course.counted),
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
    allocationCredits: {
      credits_specialization_excess: specializationExcessCredits,
    },
    manualCourseTables: {
      free_electives: freeRows,
      homologation_courses: homologationRows,
    },
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
      extraCourses: extraCandidateCourses,
      specializationCourses: [...specializationCourses, ...duplicateSpecializationCourses],
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
