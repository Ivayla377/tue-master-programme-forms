// Builds CSE-specific academic validation results from calculated programme data.
import {
  formatCredits,
  isTrue,
} from "../../shared/credit-utils.js";
import {
  exactCreditValidation,
} from "../../shared/validation-utils.js";

export function buildCseValidations(values) {
  const { rules } = values;
  const validations = [
    {
      label: "Foundational courses",
      status:
        values.foundationalSelections.length === rules.foundationalCourseCount
        && values.foundationalCourses.length === rules.foundationalCourseCount
          ? "success"
          : "error",
      detail:
        values.foundationalSelections.length === rules.foundationalCourseCount
        && values.foundationalCourses.length === rules.foundationalCourseCount
          ? "One foundational course selected from each focus area."
          : `${values.foundationalCourses.length}/${rules.foundationalCourseCount} distinct foundational courses selected.`,
    },
    {
      label: "Extra courses",
      status:
        values.extraCourses.length === rules.extraCourseCount
        && values.extraFocus !== ""
        && values.extraOutsideFocus.length === 0
          ? "success"
          : "error",
      detail:
        values.extraOutsideFocus.length > 0
          ? `${values.extraOutsideFocus.map((course) => course.label).join(", ")} is outside the selected focus area.`
          : `${values.extraCourses.length}/${rules.extraCourseCount} selected from ${focusLabel(values.extraFocus, values.focusAreas)}.`,
    },
    exactCreditValidation(
      "Specialization electives",
      values.specializationCredits,
      rules.specializationTarget,
      values.specializationExcessCredits > 0
        ? `${formatCredits(rules.specializationTarget)} allocated to specialization. Additional specialization courses (${formatCredits(values.specializationExcessCredits)}) count towards the free-elective space.`
        : `Specialization courses and the optional internship total exactly ${formatCredits(rules.specializationTarget)}.`,
    ),
    exactCreditValidation(
      "Free elective space",
      values.freeSpaceTotal,
      rules.freeElectiveSpaceTarget,
      `Additional specialization courses, free electives and homologation courses together total ${formatCredits(rules.freeElectiveSpaceTarget)}.`,
    ),
    {
      label: "Seminar",
      status: values.seminarCredits === rules.seminarCredits ? "success" : "error",
      detail:
        values.seminarCredits === rules.seminarCredits
          ? `One ${formatCredits(rules.seminarCredits)} seminar selected.`
          : `Select one ${formatCredits(rules.seminarCredits)} seminar.`,
    },
    exactCreditValidation(
      "Graduation project",
      values.graduationCredits,
      rules.graduationCredits,
      `Preparation Graduation Project and Master Project total ${formatCredits(rules.graduationCredits)}.`,
    ),
    {
      label: "Total credits",
      status: values.totalCredits >= rules.programmeTarget ? "success" : "error",
      detail:
        `${formatCredits(values.totalCredits)} / at least ${formatCredits(rules.programmeTarget)}`,
    },
  ];

  if (values.doubleCountedCourses.length > 0) {
    validations.push({
      label: "Double counting",
      status: "error",
      detail:
        `Duplicate course code(s): ${values.doubleCountedCourses
          .map(formatDuplicateLabel)
          .join(", ")}. The later entry was excluded from the ECTS totals.`,
    });
  }

  if (values.duplicateSpecializationCourses.length > 0) {
    validations.push({
      label: "Repeated specialization course",
      status: "error",
      detail:
        `${values.duplicateSpecializationCourses.map((course) => course.label).join(", ")} is selected in more than one specialization list and is counted once.`,
    });
  }

  if (values.invalidFreeRows.length > 0) {
    validations.push({
      label: "Free elective rows",
      status: "error",
      detail:
        "Complete the course code, title, and a positive credit value for every free-elective row.",
    });
  }

  if (
    values.invalidHomologationRows.length > 0
    || (
      isTrue(values.data.homologation)
      && values.homologationRows.length === 0
    )
  ) {
    validations.push({
      label: "Homologation rows",
      status: "error",
      detail:
        "Complete each homologation row, or turn homologation off when none is included.",
    });
  }

  if (
    isTrue(values.data.external_courses)
    && ![
      values.data.external_course_institutions,
      values.data.external_course_links,
      values.data.external_course_motivation,
      values.data.external_course_overlap,
    ].every(hasText)
  ) {
    validations.push({
      label: "External-course information",
      status: "error",
      detail:
        "Add the institution, course-description links, motivation and non-overlap explanation for external courses.",
    });
  }

  if (
    isTrue(values.data.self_chosen_homologation)
    && !hasText(values.data.homologation_motivation)
  ) {
    validations.push({
      label: "Homologation motivation",
      status: "error",
      detail:
        "Add a motivation for self-chosen homologation courses.",
    });
  }

  if (values.internshipSelected) {
    validations.push({
      label: "Internship",
      status: "success",
      detail:
        `${values.internshipCourse?.displayCode ?? "Internship"} contributes ${formatCredits(values.internshipCourse?.credits ?? rules.internshipCredits)} to specialization electives.`,
    });
  }

  return validations;
}

function formatDuplicateLabel(item) {
  const label = String(item.label ?? "").trim();
  return label || item.code?.toUpperCase?.() || item.code || "";
}

function focusLabel(value, focusAreas) {
  return focusAreas.find(
    (area) => area.value === value,
  )?.label ?? "the selected focus area";
}

function hasText(value) {
  return (
    value !== undefined
    && value !== null
    && String(value).trim() !== ""
  );
}
