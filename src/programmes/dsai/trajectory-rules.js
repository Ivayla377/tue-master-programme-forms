import { normalizeCourseCode } from "../../shared/course-utils.js";
import { sumCourses } from "../../shared/course-selection.js";

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
