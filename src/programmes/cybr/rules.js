// Builds CYBR-specific academic validation results from calculated programme data.
import { formatCredits } from "../../shared/credit-utils.js";
export { resolveCybrRules } from "./form-config.js";

export function buildCybrValidations(values) {
  const validations = [
    {
      label: "Graduation course set",
      status:
        values.flags.graduationCourseSetComplete
          ? "success"
          : "error",
      detail:
        values.flags.graduationCourseSetComplete
          ? `${values.graduation.label} selected.`
          : "Select the graduation course set that applies to your project.",
    },
    {
      label: "CYBR electives",
      status:
        values.flags.cybrElectiveMinimumMet
          ? "success"
          : "error",
      detail:
        `${values.cybrElectiveCount} selected `
        + `(${formatCredits(values.cybrElectives)} / at least `
        + `${formatCredits(values.rules.cybrElectiveMinimum)}).`,
    },
    {
      label: "M&CS electives",
      status: values.flags.mcsMinimumMet ? "success" : "error",
      detail:
        `${formatCredits(values.mcsElectives)} / at least `
        + `${formatCredits(values.rules.mcsMinimum)}, including internship.`,
    },
    {
      label: "Free-elective space",
      status:
        values.flags.freeElectiveSpaceMinimumMet
          ? "success"
          : "error",
      detail:
        `${formatCredits(values.freeElectiveSpace)} / at least `
        + `${formatCredits(values.rules.freeElectiveSpaceMinimum)}.`,
    },
    totalValidation(values.total, values.rules.programmeTarget),
    {
      label: "Homologation credits",
      status:
        values.flags.homologationWithinLimit
          ? "success"
          : "error",
      detail:
        values.homologation === 0
          ? "No homologation credits included."
          : `${formatCredits(values.homologation)} / maximum `
            + `${formatCredits(values.rules.homologationMaximum)}.`,
    },
  ];

  if (!values.flags.homologationSelectionComplete) {
    validations.push({
      label: "Homologation courses",
      status: "error",
      detail:
        "Add the included homologation courses or answer No to homologation.",
    });
  }

  if (!values.flags.otherMcsCoursesSelectionComplete) {
    validations.push({
      label: "Other M&CS courses",
      status: "error",
      detail:
        "Add the other M&CS course details or answer No to this question.",
    });
  }

  if (values.invalidCybrCourses.length > 0) {
    validations.push({
      label: "CYBR-elective eligibility",
      status: "error",
      detail:
        `${values.invalidCybrCourses
          .map((course) => course.displayCode)
          .join(", ")} excluded because they are not current CYBR electives.`,
    });
  }

  if (values.invalidMcsCourses.length > 0) {
    validations.push({
      label: "M&CS-elective eligibility",
      status: "error",
      detail:
        `${values.invalidMcsCourses
          .map((course) => course.displayCode)
          .join(", ")} excluded because they are not in the IAM/CSE choices.`,
    });
  }

  if (values.invalidManualRows.length > 0) {
    validations.push({
      label: "Manual course rows",
      status: "error",
      detail:
        "Complete the course code, title and positive ECTS value for every manually entered row.",
    });
  }

  if (values.duplicates.length > 0) {
    validations.push({
      label: "Double counting",
      status: "error",
      detail:
        `${values.duplicates
          .map((course) => course.displayCode)
          .join(", ")} excluded from lower-priority selections because each course may count only once.`,
    });
  }

  if (values.internship.selected && values.internship.counted) {
    validations.push({
      label: "Internship",
      status: "warning",
      detail:
        "Internship included - permission is required before starting.",
    });
  }

  return validations;
}

function totalValidation(total, programmeTarget) {
  if (total < programmeTarget) {
    return {
      label: "Total credits",
      status: "error",
      detail:
        `${formatCredits(total)} / at least `
        + `${formatCredits(programmeTarget)}.`,
    };
  }
  if (total > programmeTarget) {
    return {
      label: "Total credits",
      status: "warning",
      detail:
        `${formatCredits(total)} selected; `
        + `${formatCredits(programmeTarget)} is the normal program size.`,
    };
  }
  return {
    label: "Total credits",
    status: "success",
    detail: `${formatCredits(total)} selected.`,
  };
}
