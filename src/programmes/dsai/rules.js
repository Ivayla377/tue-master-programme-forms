// Builds DS&AI-specific trajectory and academic validation results.
import { normalizeCourseCode } from "../../shared/course-catalog.js";
import { formatCredits } from "../../shared/credit-utils.js";
import {
  minimumCreditValidation,
  targetCreditValidation,
} from "../../shared/validation-utils.js";

export function classifyTrajectories(
  trajectories,
  selectedMajorNames,
  rules,
) {
  const selected = trajectories.filter(
    (trajectory) => trajectory.courses.length > 0,
  );
  const majorCandidates = selected.filter(
    (trajectory) =>
      trajectory.credits >= rules.majorMinimumCredits,
  );
  const requiredCount = rules.majorMinimumCount;
  const candidateNames = new Set(
    majorCandidates.map((trajectory) => trajectory.name),
  );
  const requestedNames = [...new Set(
    selectedMajorNames.map((name) => String(name).trim().toLowerCase()),
  )].filter(Boolean);
  const validRequestedNames = requestedNames.filter(
    (name) => candidateNames.has(name),
  );
  const choiceRequired = majorCandidates.length > requiredCount;
  const choiceValid = choiceRequired
    && requestedNames.length === requiredCount
    && validRequestedNames.length === requiredCount;

  let state;
  let majorTrajectories;
  if (majorCandidates.length < requiredCount) {
    state = "incomplete";
    majorTrajectories = majorCandidates;
  } else if (!choiceRequired) {
    state = "automatic";
    majorTrajectories = majorCandidates;
  } else if (choiceValid) {
    state = "selected";
    const chosenNames = new Set(validRequestedNames);
    majorTrajectories = majorCandidates.filter(
      (trajectory) => chosenNames.has(trajectory.name),
    );
  } else {
    state = "choice_required";
    majorTrajectories = [];
  }

  const majorNames = new Set(
    majorTrajectories.map((trajectory) => trajectory.name),
  );
  const classificationResolved = state === "automatic" || state === "selected";
  const minorTrajectories = selected.filter((trajectory) => {
    if (majorNames.has(trajectory.name)) return false;
    return classificationResolved || !candidateNames.has(trajectory.name);
  });
  const trajectoryClassifications = selected.map((trajectory) => ({
    ...trajectory,
    role: majorNames.has(trajectory.name)
      ? state === "incomplete" ? "major_candidate" : "major"
      : candidateNames.has(trajectory.name) && !classificationResolved
        ? "major_candidate"
        : "minor",
  }));

  return {
    state,
    choiceRequired,
    choiceValid,
    majorCandidates,
    majorTrajectories,
    minorTrajectories,
    trajectoryClassifications,
  };
}

export function getBlockedSpecializationCodes(
  coreElectiveCode,
  choiceLookup,
  trajectories,
) {
  return new Set(
    [...getBlockedSpecializationByField(
      coreElectiveCode,
      choiceLookup,
      trajectories,
    ).values()].flatMap((codes) => [...codes]),
  );
}

export function getBlockedSpecializationByField(
  coreElectiveCode,
  choiceLookup,
  trajectories,
) {
  const blockedByField = new Map();
  if (!coreElectiveCode) return blockedByField;

  for (const trajectory of trajectories) {
    const blockedCodes = new Set(
      choiceLookup
        .getChoices(trajectory.name)
        .filter((choice) =>
          choiceIsBlockedByCore(choice, coreElectiveCode),
        )
        .map((choice) => choice.code),
    );
    if (blockedCodes.size > 0) {
      blockedByField.set(trajectory.name, blockedCodes);
    }
  }

  return blockedByField;
}

function choiceIsBlockedByCore(choice, coreElectiveCode) {
  const conditions = [choice.visibleIf, choice.enableIf]
    .filter(Boolean)
    .map(String);

  return conditions.some((condition) => {
    const excludedCoreCodes = [
      ...condition.matchAll(
        /\{core_elective\}\s*<>\s*['"]([^'"]+)['"]/gi,
      ),
    ].map((match) => normalizeCourseCode(match[1]));
    return excludedCoreCodes.includes(coreElectiveCode);
  });
}

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
      status: ["automatic", "selected"].includes(values.majorClassificationState)
        ? "success"
        : "error",
      detail: majorTrajectoryValidationDetail(values),
    },
    {
      label: "Minor trajectory courses",
      status:
        values.majorClassificationState !== "choice_required"
        && values.specializationMinor >= rules.minorMinimumCredits
          ? "success"
          : "error",
      detail:
        values.majorClassificationState === "choice_required"
          ? "Choose the two major trajectories before the minor courses can be classified."
          : `${formatCredits(values.specializationMinor)} classified toward the minor requirement.`,
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

function majorTrajectoryValidationDetail(values) {
  const { rules } = values;
  const candidateCount = values.majorCandidates.length;
  if (values.majorClassificationState === "automatic") {
    return "Automatically classified as majors: "
      + values.majorTrajectories.map((trajectory) => trajectory.label).join(", ")
      + ".";
  }
  if (values.majorClassificationState === "selected") {
    return "Selected majors: "
      + values.majorTrajectories.map((trajectory) => trajectory.label).join(", ")
      + ".";
  }
  if (values.majorClassificationState === "choice_required") {
    return `${candidateCount} trajectories qualify. Select exactly `
      + `${rules.majorMinimumCount} as majors.`;
  }
  return `${candidateCount}/${rules.majorMinimumCount} trajectories currently `
    + `have at least ${formatCredits(rules.majorMinimumCredits)}.`;
}
