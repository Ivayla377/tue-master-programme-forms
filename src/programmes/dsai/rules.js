import { normalizeCourseCode } from "../../shared/course-utils.js";
import { sumCourses } from "../../shared/course-selection.js";
import { formatCredits } from "../../shared/credit-utils.js";
import {
  minimumCreditValidation,
  targetCreditValidation,
} from "../../shared/validation-utils.js";

export function chooseMajorTrajectories(
  trajectories,
  specializationTotal,
  rules,
) {
  const candidates = trajectories.filter(
    (trajectory) =>
      trajectory.credits >= rules.majorMinimumCredits,
  );
  if (candidates.length < rules.majorMinimumCount) return candidates;

  let best = null;
  for (
    const group of combinations(candidates, rules.majorMinimumCount)
  ) {
    const majorCredits = sumCourses(group);
    const minorCredits = specializationTotal - majorCredits;
    const score = [
      minorCredits >= rules.minorMinimumCredits ? 1 : 0,
      minorCredits,
      -majorCredits,
    ];

    if (!best || compareScores(score, best.score) > 0) {
      best = { group, score };
    }
  }

  return best?.group ?? candidates.slice(0, rules.majorMinimumCount);
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

function combinations(items, size, start = 0, prefix = []) {
  if (prefix.length === size) return [prefix];

  const groups = [];
  for (
    let index = start;
    index <= items.length - (size - prefix.length);
    index += 1
  ) {
    groups.push(
      ...combinations(
        items,
        size,
        index + 1,
        [...prefix, items[index]],
      ),
    );
  }
  return groups;
}

function compareScores(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
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
