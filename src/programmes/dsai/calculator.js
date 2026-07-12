import { createChoiceLookup as createSharedChoiceLookup } from "../../shared/course-utils.js";
import {
  DEFAULT_CREDITS as sharedDefaultCredits,
  formatCredits as formatSharedCredits,
  isTrue as sharedIsTrue,
  sumCredits as sumSharedCredits,
} from "../../shared/credit-utils.js";
import {
  minimumCreditValidation,
  targetCreditValidation,
} from "../../shared/validation-utils.js";

export const DEFAULT_CREDITS = sharedDefaultCredits;
export const CORE_MANDATORY_CODES = [
  "2amm20",
  "2ams11",
  "0lm190",
  "2amu10",
  "2amd15",
];

export const TRAJECTORIES = [
  { name: "context", label: "DS&AI in Context" },
  { name: "stat", label: "Statistics" },
  { name: "db", label: "Data Engineering & Management" },
  { name: "aiml", label: "Artificial Intelligence & Machine Learning" },
  { name: "dmml", label: "Data Mining & Machine Learning" },
  { name: "pmva", label: "Process Mining & Visual Analytics" },
  { name: "ada", label: "Algorithmic Data Analysis" },
];

export const PROJECT_COURSE_CODES = new Set([
  "2amv10",
  "2amv11",
  "2amd20",
  "2ami30",
  "2amc15",
]);

const COURSE_CREDITS = {
  "2amc05": 10,
  "2amc00": 30,
  "2imc10": 15,
};

const BLOCKED_SPECIALIZATION_BY_CORE = {
  "2ami10": [{ field: "pmva", codes: ["2ami10"] }],
  "2ams50": [{ field: "ada", codes: ["2ams50"] }],
  // The source form uses 2AMV11 in the specialization list for the Visual Analytics choice.
  "2amv10": [{ field: "pmva", codes: ["2amv11"] }],
};

export function createChoiceLookup(surveyJson) {
  return createSharedChoiceLookup(surveyJson);
}
export function calculateEcts(data = {}, choiceLookup = createEmptyLookup()) {
  const coreCodes = hasOwn(data, "core")
    ? getSelectedCodes(data, "core")
    : CORE_MANDATORY_CODES;
  const coreCourses = unique(coreCodes).map((code) =>
    makeCourse(code, choiceLookup, "core"),
  );

  const coreElectiveCode = normalizeCode(data.core_elective);
  const coreElectiveCourse = coreElectiveCode
    ? makeCourse(coreElectiveCode, choiceLookup, "core_elective")
    : null;

  const coreTotal =
    sumCredits(coreCourses) + (coreElectiveCourse ? coreElectiveCourse.credits : 0);
  const blockedByCore = getBlockedSpecializationCodes(coreElectiveCode);
  const selectedCoreCodes = new Set(coreCourses.map((course) => course.code));
  if (coreElectiveCode) selectedCoreCodes.add(coreElectiveCode);

  const seenSpecializationCodes = new Set();
  const duplicateSpecializationCourses = [];
  const trajectories = TRAJECTORIES.map((trajectory) => {
    const courses = [];

    for (const code of getSelectedCodes(data, trajectory.name)) {
      const course = makeCourse(code, choiceLookup, trajectory.name);
      const isCoreDuplicate = selectedCoreCodes.has(course.code);
      const isBlockedByCore = blockedByCore.has(course.code);
      const isRepeatedSpecialization = seenSpecializationCodes.has(course.code);

      if (isCoreDuplicate || isBlockedByCore || isRepeatedSpecialization) {
        duplicateSpecializationCourses.push(course);
        continue;
      }

      seenSpecializationCodes.add(course.code);
      courses.push(course);
    }

    return {
      ...trajectory,
      courses,
      credits: sumCredits(courses),
      count: courses.length,
    };
  });

  const specializationCourses = trajectories.flatMap((trajectory) => trajectory.courses);
  const specializationTotal = sumCredits(specializationCourses);
  const majorTrajectories = chooseMajorTrajectories(trajectories, specializationTotal);
  const majorNames = new Set(majorTrajectories.map((trajectory) => trajectory.name));
  const minorTrajectories = trajectories.filter(
    (trajectory) => !majorNames.has(trajectory.name) && trajectory.courses.length > 0,
  );
  const specializationMajor = sumCredits(
    majorTrajectories.flatMap((trajectory) => trajectory.courses),
  );
  const specializationMinor = sumCredits(
    minorTrajectories.flatMap((trajectory) => trajectory.courses),
  );

  const seminar = data.seminar
    ? {
        value: String(data.seminar),
        label: choiceLookup.getLabel("seminar", data.seminar),
        credits: DEFAULT_CREDITS,
      }
    : null;
  const seminarCredits = seminar ? seminar.credits : 0;

  const freeRows = normalizeFreeRows(data.free);
  const freeRowsCredits = sumCredits(freeRows);

  const homologationCourses = isTrue(data.homologation)
    ? getSelectedValues(data, "homologation_courses").map((value) =>
        makeCourse(value, choiceLookup, "homologation_courses"),
      )
    : [];
  const homologationCredits = sumCredits(homologationCourses);

  const internshipSelected = isTrue(data.internship);
  const internshipCredits = internshipSelected ? COURSE_CREDITS["2imc10"] : 0;
  const internship = {
    selected: internshipSelected,
    supervisor: data.internship_supervisor ?? "",
    credits: internshipCredits,
  };

  const graduationCodes = hasOwn(data, "graduation")
    ? getSelectedCodes(data, "graduation")
    : ["2amc05", "2amc00"];
  const graduationCourses = unique(graduationCodes).map((code) =>
    makeCourse(code, choiceLookup, "graduation"),
  );
  const graduationCredits = sumCredits(graduationCourses);

  const freeSpaceTotal = freeRowsCredits + homologationCredits + internshipCredits;
  const totalCredits =
    coreTotal + specializationTotal + seminarCredits + freeSpaceTotal + graduationCredits;
  const projectCourses = [
    ...coreCourses,
    ...(coreElectiveCourse ? [coreElectiveCourse] : []),
    ...specializationCourses,
  ].filter((course) => PROJECT_COURSE_CODES.has(course.code));

  const invalidFreeRows = freeRows.filter((row) => !row.validCredits);
  const validations = buildValidations({
    coreTotal,
    specializationTotal,
    specializationMajor,
    specializationMinor,
    majorTrajectories,
    minorTrajectories,
    seminarCredits,
    freeRowsCredits,
    freeSpaceTotal,
    homologationCredits,
    internshipCredits,
    graduationCredits,
    totalCredits,
    projectCourses,
    duplicateSpecializationCourses,
    invalidFreeRows,
  });

  return {
    subtotals: {
      core: coreTotal,
      specializationMajor,
      specializationMinor,
      specializationTotal,
      seminar: seminarCredits,
      freeRows: freeRowsCredits,
      homologation: homologationCredits,
      internship: internshipCredits,
      freeSpace: freeSpaceTotal,
      graduation: graduationCredits,
      total: totalCredits,
    },
    selected: {
      coreCourses,
      coreElectiveCourse,
      trajectories,
      majorTrajectories,
      minorTrajectories,
      seminar,
      freeRows,
      homologationCourses,
      internship,
      graduationCourses,
      projectCourses,
      duplicateSpecializationCourses,
    },
    validations,
    hasErrors: validations.some((validation) => validation.status === "error"),
    hasWarnings: validations.some((validation) => validation.status === "warning"),
    isValid: validations.every((validation) => validation.status !== "error"),
    isComplete: validations.every((validation) => validation.status === "success"),
  };
}

export function removeBlockedSpecializationSelections(survey) {
  const coreElectiveCode = normalizeCode(survey.getValue("core_elective"));
  const blocks = BLOCKED_SPECIALIZATION_BY_CORE[coreElectiveCode] ?? [];
  let changed = false;

  for (const block of blocks) {
    const blockedCodes = new Set(block.codes.map(normalizeCode));
    const selected = getSelectedCodes(survey.data, block.field);
    const remaining = selected.filter((code) => !blockedCodes.has(code));

    if (remaining.length !== selected.length) {
      survey.setValue(block.field, remaining);
      changed = true;
    }
  }

  return changed;
}

export function formatCredits(value) {
  return formatSharedCredits(value);
}

export function isTrue(value) {
  return sharedIsTrue(value);
}
function buildValidations(values) {
  const validations = [
    targetValidation(
      "Core and core electives",
      values.coreTotal,
      30,
      "Core courses plus one core elective should total 30 ECTS.",
    ),
    minimumValidation(
      "Specialization total",
      values.specializationTotal,
      30,
      "At least six specialization elective courses are needed.",
      true,
    ),
    {
      label: "Major trajectories",
      status: values.majorTrajectories.length >= 2 ? "success" : "error",
      detail: `${values.majorTrajectories.length}/2 trajectories have at least 10 ECTS.`,
    },
    {
      label: "Minor trajectory courses",
      status: values.specializationMinor >= 10 ? "success" : "error",
      detail: `${formatCredits(values.specializationMinor)} selected outside the inferred majors.`,
    },
    {
      label: "Project course",
      status: values.projectCourses.length > 0 ? "success" : "error",
      detail:
        values.projectCourses.length > 0
          ? values.projectCourses.map((course) => course.label).join(", ")
          : "Select at least one project course.",
    },
    {
      label: "Seminar",
      status: values.seminarCredits === 5 ? "success" : "error",
      detail: `${formatCredits(values.seminarCredits)} / 5 ECTS`,
    },
    targetValidation(
      "Free elective space",
      values.freeSpaceTotal,
      15,
      "Free elective rows, homologation courses, and internship together fill this space.",
      true,
    ),
    targetValidation(
      "Graduation project",
      values.graduationCredits,
      40,
      "Graduation Preparation and Master Project should total 40 ECTS.",
    ),
    {
      label: "Total credits",
      status: values.totalCredits >= 120 ? "success" : "error",
      detail: `${formatCredits(values.totalCredits)} / at least 120 ECTS`,
    },
  ];

  if (values.duplicateSpecializationCourses.length > 0) {
    validations.push({
      label: "Double counting",
      status: "error",
      detail: `${values.duplicateSpecializationCourses
        .map((course) => course.label)
        .join(", ")} excluded from totals because it overlaps with another selection.`,
    });
  }

  if (values.invalidFreeRows.length > 0) {
    validations.push({
      label: "Free elective credits",
      status: "warning",
      detail: "One or more free elective rows has an empty or invalid credit value and is counted as 0 ECTS.",
    });
  }

  if (values.internshipCredits > 0 && values.freeRowsCredits > 0) {
    validations.push({
      label: "Internship and free elective rows",
      status: "warning",
      detail: "The internship already contributes 15 ECTS to the free elective space.",
    });
  }

  return validations;
}

function targetValidation(label, value, target, successDetail, warnWhenOver = false) {
  return targetCreditValidation(label, value, target, successDetail, warnWhenOver);
}

function minimumValidation(label, value, target, successDetail, warnWhenOver = false) {
  return minimumCreditValidation(label, value, target, successDetail, warnWhenOver);
}
function chooseMajorTrajectories(trajectories, specializationTotal) {
  const candidates = trajectories.filter((trajectory) => trajectory.credits >= 10);

  if (candidates.length < 2) return candidates;

  let best = null;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const pair = [candidates[i], candidates[j]];
      const majorCredits = pair[0].credits + pair[1].credits;
      const minorCredits = specializationTotal - majorCredits;
      const score = [minorCredits >= 10 ? 1 : 0, minorCredits, -majorCredits];

      if (!best || compareScores(score, best.score) > 0) {
        best = { pair, score };
      }
    }
  }

  return best?.pair ?? candidates.slice(0, 2);
}

function compareScores(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }

  return 0;
}

function normalizeFreeRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const credits = parseCredits(row?.credits);
      return {
        code: row?.code ?? "",
        name: row?.name ?? "",
        credits: credits.value,
        rawCredits: row?.credits ?? "",
        validCredits: credits.valid,
        rowNumber: index + 1,
      };
    })
    .filter(
      (row) => row.code !== "" || row.name !== "" || String(row.rawCredits) !== "",
    );
}

function parseCredits(value) {
  if (value === undefined || value === null || value === "") {
    return { value: 0, valid: false };
  }

  const number = Number(String(value).replace(",", "."));
  if (!Number.isFinite(number) || number < 0) {
    return { value: 0, valid: false };
  }

  return { value: number, valid: true };
}

function getBlockedSpecializationCodes(coreElectiveCode) {
  return new Set(
    (BLOCKED_SPECIALIZATION_BY_CORE[coreElectiveCode] ?? [])
      .flatMap((block) => block.codes)
      .map(normalizeCode),
  );
}

function makeCourse(value, choiceLookup, questionName) {
  const code = normalizeCode(value);
  return {
    value: String(value),
    code,
    label:
      choiceLookup.getLabel(questionName, value) || choiceLookup.courseLabel(value) || String(value),
    credits: COURSE_CREDITS[code] ?? DEFAULT_CREDITS,
  };
}

function getSelectedValues(data, name) {
  const value = data?.[name];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function getSelectedCodes(data, name) {
  return getSelectedValues(data, name).map(normalizeCode);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sumCredits(items) {
  return sumSharedCredits(items);
}

function normalizeCode(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

function normalizeChoice(choice) {
  if (typeof choice === "string" || typeof choice === "number") {
    return { value: String(choice), text: String(choice) };
  }

  const value = choice.value ?? choice.text ?? "";
  const text = choice.text ?? choice.value ?? "";
  return { value: String(value), text: String(text) };
}

function walkElements(nodes, callback) {
  for (const node of nodes) {
    if (Array.isArray(node.elements)) {
      walkElements(node.elements, callback);
    } else {
      callback(node);
    }

    if (Array.isArray(node.templateElements)) {
      walkElements(node.templateElements, callback);
    }
  }
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function createEmptyLookup() {
  return {
    getLabel(_questionName, value) {
      return value === undefined || value === null ? "" : String(value);
    },
    courseLabel(value) {
      return value === undefined || value === null ? "" : String(value);
    },
  };
}
