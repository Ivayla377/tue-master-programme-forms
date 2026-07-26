import { formatCredits } from "../../shared/credit-utils.js";
import {
  minimumCreditValidation,
  targetCreditValidation,
} from "../../shared/validation-utils.js";

export function buildDsaiValidations(values) {
  const { rules } = values;
  const validations = [
    targetCreditValidation(
      "Core and core electives",
      values.coreTotal,
      rules.coreCredits,
      `Core courses plus one core elective should total ${formatCredits(rules.coreCredits)}.`,
    ),
    minimumCreditValidation(
      "Specialization total",
      values.specializationTotal,
      rules.specializationMinimumCredits,
      `At least ${rules.specializationMinimumCount} specialization elective courses are needed.`,
      true,
    ),
    {
      label: "Major trajectories",
      status:
        values.majorTrajectories.length >= rules.majorMinimumCount
          ? "success"
          : "error",
      detail:
        `${values.majorTrajectories.length}/${rules.majorMinimumCount} `
        + `trajectories have at least ${formatCredits(rules.majorMinimumCredits)}.`,
    },
    {
      label: "Minor trajectory courses",
      status:
        values.specializationMinor >= rules.minorMinimumCredits
          ? "success"
          : "error",
      detail:
        `${formatCredits(values.specializationMinor)} selected outside the inferred majors.`,
    },
    {
      label: "Project course",
      status:
        values.projectCourses.length >= rules.projectMinimumCount
          ? "success"
          : "error",
      detail:
        values.projectCourses.length >= rules.projectMinimumCount
          ? values.projectCourses
              .map((course) => course.label)
              .join(", ")
          : "Select at least one project course.",
    },
    {
      label: "Seminar",
      status:
        values.seminarCredits === rules.seminarCredits
          ? "success"
          : "error",
      detail:
        `${formatCredits(values.seminarCredits)} / `
        + formatCredits(rules.seminarCredits),
    },
    targetCreditValidation(
      "Free elective space",
      values.freeSpaceTotal,
      rules.freeElectiveSpaceCredits,
      "Free elective rows, homologation courses, and internship together fill this space.",
      true,
    ),
    targetCreditValidation(
      "Graduation project",
      values.graduationCredits,
      rules.graduationCredits,
      `Graduation Preparation and Master Project total ${formatCredits(rules.graduationCredits)}.`,
    ),
    {
      label: "Total credits",
      status:
        values.totalCredits >= rules.programmeTarget
          ? "success"
          : "error",
      detail:
        `${formatCredits(values.totalCredits)} / at least `
        + formatCredits(rules.programmeTarget),
    },
  ];

  if (values.invalidFreeRows.length > 0) {
    validations.push({
      label: "Free elective credits",
      status: "warning",
      detail:
        "One or more free elective rows has an empty or invalid credit value and is counted as 0 ECTS.",
    });
  }

  if (values.internshipCredits > 0 && values.freeRowsCredits > 0) {
    validations.push({
      label: "Internship and free elective rows",
      status: "warning",
      detail:
        `The internship already contributes ${formatCredits(values.internshipCredits)} to the free elective space.`,
    });
  }

  return validations;
}
