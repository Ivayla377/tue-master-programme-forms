// Builds IAM-specific academic validation results from calculated programme data.
import { formatCredits } from "../../shared/credit-utils.js";
export { resolveIamRules } from "./form-config.js";

export function buildIamValidations(values) {
  const validations = [
    {
      label: "Core electives",
      status:
        values.flags.coreMinimumMet && values.flags.coreCountMet
          ? "success"
          : "error",
      detail:
        values.flags.coreMinimumMet && values.flags.coreCountMet
          ? `${values.coreCount} core electives selected (${formatCredits(values.coreElectives)}).`
          : `${formatCredits(values.coreElectives)} / at least ${formatCredits(values.rules.coreMinimum)}.`,
    },
    {
      label: "Core and specialization total",
      status:
        values.flags.coreSpecializationMinimumMet
          ? "success"
          : "error",
      detail:
        `${formatCredits(values.coreAndSpecialization)} / at least ${formatCredits(values.rules.coreSpecializationMinimum)}.`,
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
          : `${formatCredits(values.homologation)} / maximum ${formatCredits(values.rules.homologationMaximum)} homologation credits.`,
    },
  ];

  if (values.invalidCoreCourses.length > 0) {
    validations.push({
      label: "Core-elective eligibility",
      status: "error",
      detail:
        `${values.invalidCoreCourses.map((course) => course.displayCode).join(", ")} excluded because they are not current IAM core electives.`,
    });
  }

  if (values.invalidSpecializationCourses.length > 0) {
    validations.push({
      label: "Specialization-elective eligibility",
      status: "error",
      detail:
        `${values.invalidSpecializationCourses.map((course) => course.displayCode).join(", ")} excluded because they are not current IAM specialization electives.`,
    });
  }

  if (values.invalidOfficialFreeCourses.length > 0) {
    validations.push({
      label: "Official free-elective eligibility",
      status: "error",
      detail:
        `${values.invalidOfficialFreeCourses.map((course) => course.displayCode).join(", ")} excluded because they are not current listed IAM free electives.`,
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
        `${values.duplicates.map((course) => course.displayCode).join(", ")} excluded from lower-priority selections because each course may count only once.`,
    });
  }

  if (values.flags.hasAssignedHomologation) {
    validations.push({
      label: "Homologation academic review",
      status: "warning",
      detail:
        "Homologation included - review required for necessity and academic fit.",
    });
  }

  if (values.flags.hasSelfChosenHomologation) {
    validations.push({
      label: "Self-chosen homologation review",
      status: "warning",
      detail:
        "Self-chosen homologation included - add a motivation for the deficiency it compensates.",
    });
  }

  if (
    values.selfChosenHomologationActive
    && !values.homologationMotivationPresent
  ) {
    validations.push({
      label: "Self-chosen homologation motivation",
      status: "error",
      detail:
        "Provide a motivation for the self-chosen homologation courses.",
    });
  }

  if (values.flags.hasMastermathSpecialization) {
    validations.push({
      label: "Mastermath specialization review",
      status: "warning",
      detail:
        "Mastermath or other approved specialization elective included - review required for fit and overlap.",
    });
  }

  if (values.internship.selected && values.internship.counted) {
    validations.push({
      label: "Internship",
      status: "warning",
      detail:
        "Internship included - permission required before starting.",
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
        `${formatCredits(total)} / at least ${formatCredits(programmeTarget)}.`,
    };
  }
  if (total > programmeTarget) {
    return {
      label: "Total credits",
      status: "warning",
      detail:
        `${formatCredits(total)} selected; ${formatCredits(programmeTarget)} is the normal program size.`,
    };
  }
  return {
    label: "Total credits",
    status: "success",
    detail: `${formatCredits(total)} selected.`,
  };
}
