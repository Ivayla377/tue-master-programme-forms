import surveySource from "../../../forms/ist/form.json" with { type: "json" };
import { Serializer } from "survey-core";

import { createChoiceLookup as createSharedChoiceLookup, walkElements } from "../../shared/course-utils.js";
import { formatCredits, isTrue } from "../../shared/credit-utils.js";
import { registerCourseChoiceMetadata } from "./survey-metadata.js";

registerCourseChoiceMetadata(Serializer);

const RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  mandatoryCredits: "rule_mandatory_credits",
  istElectiveMinimum: "rule_ist_elective_min_credits",
  istElectiveMinimumCount: "rule_ist_elective_min_count",
  mcsMinimum: "rule_mcs_min_credits",
  freeElectiveSpaceMinimum: "rule_free_elective_space_min_credits",
  homologationMaximum: "rule_homologation_max_credits",
});

const QUESTION_NAMES = Object.freeze({
  mandatory: "mandatory_components_display",
  graduationPath: "graduation_course_set",
  graduationComputerScience: "graduation_computer_science_courses",
  graduationMathematics: "graduation_mathematics_courses",
  istElectives: "ist_electives",
  mcsElectives: "mcs_course_electives",
  internship: "internship_course_display",
});

const COURSE_QUESTION_NAMES = new Set([
  QUESTION_NAMES.mandatory,
  QUESTION_NAMES.graduationComputerScience,
  QUESTION_NAMES.graduationMathematics,
  QUESTION_NAMES.istElectives,
  QUESTION_NAMES.mcsElectives,
  QUESTION_NAMES.internship,
]);

const DEFAULT_RULES = readDefaultRules(surveySource);
const FORM_COURSE_DATA = createIstCourseData(surveySource);

export const IST_COURSE_CATALOG = FORM_COURSE_DATA.catalog;
export const MANDATORY_CODES = defaultsForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.mandatory);
export const IST_ELECTIVE_CODES = codesForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.istElectives);
export const MCS_ELECTIVE_CODES = codesForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.mcsElectives);
export const GRADUATION_PATHS = choicesForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.graduationPath);

const IST_ELECTIVE_CODE_SET = codeSet(IST_ELECTIVE_CODES);
const MCS_ELECTIVE_CODE_SET = codeSet(MCS_ELECTIVE_CODES);
const INTERNSHIP_CODE = defaultsForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.internship)[0] ?? "";

export function createIstChoiceLookup(surveyJson = surveySource) {
  const baseLookup = createSharedChoiceLookup(surveyJson);
  const courseData = createIstCourseData(surveyJson);

  return {
    ...baseLookup,
    getCourse(questionName, value) {
      const code = normalizeIstCode(value);
      return courseData.coursesByQuestion.get(questionName)?.get(code) ?? courseData.catalog[code] ?? null;
    },
    getCodes(questionName) {
      return codesForQuestion(courseData, questionName);
    },
    getDefaultCodes(questionName) {
      return defaultsForQuestion(courseData, questionName);
    },
    getChoiceValues(questionName) {
      return choicesForQuestion(courseData, questionName);
    },
  };
}

export const createChoiceLookup = createIstChoiceLookup;

export function calculateIst(data = {}, choiceLookup = createIstChoiceLookup()) {
  const rules = resolveRules(data);
  const duplicates = [];
  const claimed = new Map();

  const mandatoryCodes = defaultCodesFor(
    choiceLookup,
    QUESTION_NAMES.mandatory,
    MANDATORY_CODES,
  );
  const mandatoryFixedCourses = mandatoryCodes.map((code) =>
    makeCourse(code, choiceLookup, QUESTION_NAMES.mandatory),
  );
  for (const course of mandatoryFixedCourses) {
    claim(course, "mandatory component", claimed, duplicates);
  }

  const graduation = resolveGraduation(data, choiceLookup, claimed, duplicates);

  const istSelection = processStructuredSelection({
    values: selectedValues(data.ist_electives),
    allowedCodes: codeSetFor(
      choiceLookup,
      QUESTION_NAMES.istElectives,
      IST_ELECTIVE_CODE_SET,
    ),
    questionName: QUESTION_NAMES.istElectives,
    component: "IST elective",
    choiceLookup,
    claimed,
    duplicates,
  });

  const internship = resolveInternship(data, choiceLookup);
  if (internship.course) {
    internship.counted = claim(internship.course, "internship", claimed, duplicates);
    internship.exclusionReason = internship.counted
      ? ""
      : "Duplicate course; excluded from totals.";
  }

  const mcsSelection = processStructuredSelection({
    values: selectedValues(data.mcs_course_electives),
    allowedCodes: codeSetFor(
      choiceLookup,
      QUESTION_NAMES.mcsElectives,
      MCS_ELECTIVE_CODE_SET,
    ),
    questionName: QUESTION_NAMES.mcsElectives,
    component: "IAM or CSE elective",
    choiceLookup,
    claimed,
    duplicates,
  });
  const otherMcsCoursesActive = isAffirmative(data.other_mcs_courses);
  const mcsRows = otherMcsCoursesActive
    ? processRows(
        normalizeRows(data.mcs_other_courses),
        "IAM or CSE elective",
        claimed,
        duplicates,
      )
    : [];

  const homologationActive = isAffirmative(data.homologation);
  const homologationRows = homologationActive
    ? processRows(
        normalizeRows(
          data.homologation_courses ?? data.assigned_homologation_courses,
        ),
        "homologation",
        claimed,
        duplicates,
      )
    : [];
  const freeElectiveRows = processRows(
    normalizeRows(data.free_electives),
    "free elective",
    claimed,
    duplicates,
  );

  const mandatoryFixed = sumCourses(mandatoryFixedCourses);
  const graduationCredits = sumCourses(graduation.courses);
  const mandatory = roundCredits(mandatoryFixed + graduationCredits);
  const istElectives = sumCourses(istSelection.courses);
  const mcsCourseElectives = sumCourses(mcsSelection.courses);
  const manualMcsElectives = sumCountedRows(mcsRows);
  const internshipCredits =
    internship.selected && internship.counted ? internship.credits : 0;
  const mcsElectives = roundCredits(
    mcsCourseElectives + manualMcsElectives + internshipCredits,
  );
  const homologationCourses = sumCountedRows(homologationRows);
  const homologation = homologationCourses;
  const manualFreeElectives = sumCountedRows(freeElectiveRows);
  const otherFreeElectives = roundCredits(
    manualFreeElectives + homologation,
  );
  const freeElectiveSpace = roundCredits(mcsElectives + otherFreeElectives);
  const total = roundCredits(mandatory + istElectives + freeElectiveSpace);

  const invalidManualRows = [
    ...mcsRows,
    ...homologationRows,
    ...freeElectiveRows,
  ].filter((row) => !row.validCredits);
  const istElectiveCount = istSelection.courses.length;
  const hasHomologationRows = homologationRows.length > 0;

  const flags = {
    graduationCourseSetComplete:
      graduation.valid && mandatory >= rules.mandatoryCredits,
    istElectiveMinimumMet:
      istElectives >= rules.istElectiveMinimum
      && istElectiveCount >= rules.istElectiveMinimumCount,
    mcsMinimumMet: mcsElectives >= rules.mcsMinimum,
    freeElectiveSpaceMinimumMet:
      freeElectiveSpace >= rules.freeElectiveSpaceMinimum,
    totalAtLeastTarget: total >= rules.programmeTarget,
    homologationWithinLimit: homologation <= rules.homologationMaximum,
    homologationSelectionComplete:
      !homologationActive || hasHomologationRows,
    otherMcsCoursesSelectionComplete:
      !otherMcsCoursesActive || mcsRows.length > 0,
  };

  const validations = buildValidations({
    flags,
    rules,
    graduation,
    istElectives,
    istElectiveCount,
    mcsElectives,
    freeElectiveSpace,
    total,
    homologationCourses,
    homologation,
    invalidManualRows,
    invalidIstCourses: istSelection.invalidCourses,
    invalidMcsCourses: mcsSelection.invalidCourses,
    duplicates,
    internship,
  });

  const hasErrors = validations.some(
    (validation) => validation.status === "error",
  );
  const hasWarnings = validations.some(
    (validation) => validation.status === "warning",
  );

  return {
    rules,
    subtotals: {
      mandatoryFixed,
      graduation: graduationCredits,
      mandatory,
      istElectives,
      mcsCourseElectives,
      manualMcsElectives,
      internship: internshipCredits,
      mcsElectives,
      manualFreeElectives,
      homologationCourses,
      homologation,
      otherFreeElectives,
      freeElectiveSpace,
      total,
    },
    selected: {
      mandatoryFixedCourses,
      graduation,
      istElectiveCourses: istSelection.courses,
      invalidIstCourses: istSelection.invalidCourses,
      mcsElectiveCourses: mcsSelection.courses,
      invalidMcsCourses: mcsSelection.invalidCourses,
      mcsRows,
      homologationRows,
      freeElectiveRows,
      internship,
      duplicates,
    },
    flags,
    validations,
    hasErrors,
    hasWarnings,
    isValid: !hasErrors,
    isComplete: !hasErrors,
  };
}

export const calculateEcts = calculateIst;

function readDefaultRules(surveyJson) {
  const calculatedValues = Array.isArray(surveyJson?.calculatedValues)
    ? surveyJson.calculatedValues
    : [];

  return {
    programmeTarget: readConstantRule(
      calculatedValues,
      RULE_FIELD_NAMES.programmeTarget,
    ),
    mandatoryCredits: readConstantRule(
      calculatedValues,
      RULE_FIELD_NAMES.mandatoryCredits,
    ),
    istElectiveMinimum: readConstantRule(
      calculatedValues,
      RULE_FIELD_NAMES.istElectiveMinimum,
    ),
    istElectiveMinimumCount: readConstantRule(
      calculatedValues,
      RULE_FIELD_NAMES.istElectiveMinimumCount,
    ),
    mcsMinimum: readConstantRule(
      calculatedValues,
      RULE_FIELD_NAMES.mcsMinimum,
    ),
    freeElectiveSpaceMinimum: readConstantRule(
      calculatedValues,
      RULE_FIELD_NAMES.freeElectiveSpaceMinimum,
    ),
    homologationMaximum: readConstantRule(
      calculatedValues,
      RULE_FIELD_NAMES.homologationMaximum,
    ),
  };
}

function readConstantRule(calculatedValues, field) {
  const expression = calculatedValues.find(
    (item) => item?.name === field,
  )?.expression;
  const value = Number(expression);
  if (!Number.isFinite(value)) {
    throw new Error(
      `IST form rule ${field} must be a numeric calculated value.`,
    );
  }
  return value;
}

function resolveRules(data) {
  return {
    programmeTarget: readRule(
      data,
      RULE_FIELD_NAMES.programmeTarget,
      DEFAULT_RULES.programmeTarget,
    ),
    mandatoryCredits: readRule(
      data,
      RULE_FIELD_NAMES.mandatoryCredits,
      DEFAULT_RULES.mandatoryCredits,
    ),
    istElectiveMinimum: readRule(
      data,
      RULE_FIELD_NAMES.istElectiveMinimum,
      DEFAULT_RULES.istElectiveMinimum,
    ),
    istElectiveMinimumCount: readRule(
      data,
      RULE_FIELD_NAMES.istElectiveMinimumCount,
      DEFAULT_RULES.istElectiveMinimumCount,
    ),
    mcsMinimum: readRule(
      data,
      RULE_FIELD_NAMES.mcsMinimum,
      DEFAULT_RULES.mcsMinimum,
    ),
    freeElectiveSpaceMinimum: readRule(
      data,
      RULE_FIELD_NAMES.freeElectiveSpaceMinimum,
      DEFAULT_RULES.freeElectiveSpaceMinimum,
    ),
    homologationMaximum: readRule(
      data,
      RULE_FIELD_NAMES.homologationMaximum,
      DEFAULT_RULES.homologationMaximum,
    ),
  };
}

function readRule(data, field, fallback) {
  const rawValue = data?.[field];
  if (
    rawValue === undefined
    || rawValue === null
    || String(rawValue).trim() === ""
  ) {
    return fallback;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function buildValidations(values) {
  const validations = [
    {
      label: "Graduation course set",
      status: values.flags.graduationCourseSetComplete ? "success" : "error",
      detail: values.flags.graduationCourseSetComplete
        ? `${values.graduation.label} selected.`
        : "Select the graduation course set that applies to your project.",
    },
    {
      label: "IST electives",
      status: values.flags.istElectiveMinimumMet ? "success" : "error",
      detail:
        `${values.istElectiveCount} selected `
        + `(${formatCredits(values.istElectives)} / at least `
        + `${formatCredits(values.rules.istElectiveMinimum)}).`,
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
      status: values.flags.freeElectiveSpaceMinimumMet ? "success" : "error",
      detail:
        `${formatCredits(values.freeElectiveSpace)} / at least `
        + `${formatCredits(values.rules.freeElectiveSpaceMinimum)}.`,
    },
    totalValidation(values.total, values.rules.programmeTarget),
    {
      label: "Homologation credits",
      status: values.flags.homologationWithinLimit ? "success" : "error",
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


  if (values.invalidIstCourses.length > 0) {
    validations.push({
      label: "IST-elective eligibility",
      status: "error",
      detail:
        `${values.invalidIstCourses
          .map((course) => course.displayCode)
          .join(", ")} excluded because they are not current IST electives.`,
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
      detail: "Internship included - permission is required before starting.",
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

function resolveGraduation(data, choiceLookup, claimed, duplicates) {
  const selectedPath = String(data.graduation_course_set ?? "").trim();
  const allowedPaths = new Set(
    choiceValuesFor(
      choiceLookup,
      QUESTION_NAMES.graduationPath,
      GRADUATION_PATHS,
    ),
  );
  const valid = selectedPath !== "" && allowedPaths.has(selectedPath);
  const codes = valid
    ? defaultCodesFor(choiceLookup, selectedPath, [])
    : [];
  const courses = codes.map((code) =>
    makeCourse(code, choiceLookup, selectedPath),
  );
  for (const course of courses) {
    claim(course, "graduation component", claimed, duplicates);
  }

  return {
    value: selectedPath,
    label: valid
      ? choiceLookup?.getLabel?.(
          QUESTION_NAMES.graduationPath,
          selectedPath,
        ) ?? selectedPath
      : "",
    valid: valid && courses.length > 0,
    courses,
  };
}

function resolveInternship(data, choiceLookup) {
  const selected = isAffirmative(data.internship);
  const code = defaultCodesFor(
    choiceLookup,
    QUESTION_NAMES.internship,
    INTERNSHIP_CODE ? [INTERNSHIP_CODE] : [],
  )[0] ?? "";
  const course =
    selected && code
      ? makeCourse(code, choiceLookup, QUESTION_NAMES.internship)
      : null;

  return {
    selected,
    course,
    code: course?.code ?? "",
    displayCode: course?.displayCode ?? "",
    title: course?.title ?? "",
    credits: course?.credits ?? 0,
    supervisor: data.internship_supervisor ?? "",
    counted: false,
    exclusionReason: "",
  };
}

function processStructuredSelection({
  values,
  allowedCodes,
  questionName,
  component,
  choiceLookup,
  claimed,
  duplicates,
}) {
  const seen = new Set();
  const courses = [];
  const invalidCourses = [];

  for (const value of values) {
    const code = normalizeIstCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);

    if (!allowedCodes.has(code)) {
      invalidCourses.push({
        ...makeUnknownCourse(value),
        counted: false,
        exclusionReason: "Not in the current form list.",
      });
      continue;
    }

    const course = makeCourse(value, choiceLookup, questionName);
    if (claim(course, component, claimed, duplicates)) {
      courses.push(course);
    } else {
      invalidCourses.push({
        ...course,
        counted: false,
        exclusionReason: "Duplicate selection; excluded from totals.",
      });
    }
  }

  return { courses, invalidCourses };
}

function normalizeRows(rows, options = {}) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const displayCode = String(row?.code ?? "").trim();
      const normalizedCode = normalizeIstCode(displayCode);
      const title = String(row?.title ?? row?.name ?? "").trim();
      const rawCredits = row?.credits ?? "";
      const parsedCredits = parseCredits(rawCredits);
      const linkedCourse = String(
        row?.master_course
        ?? row?.linkedCourse
        ?? row?.linked_course
        ?? "",
      ).trim();
      const validCredits =
        normalizedCode !== ""
        && title !== ""
        && parsedCredits.valid
        && (!options.requireLinkedCourse || linkedCourse !== "");

      return {
        code: displayCode,
        displayCode: displayCode || normalizedCode.toUpperCase(),
        normalizedCode,
        title,
        name: title,
        credits: validCredits ? parsedCredits.value : 0,
        rawCredits,
        linkedCourse,
        masterCourse: linkedCourse,
        validCredits,
        counted: false,
        exclusionReason: validCredits
          ? ""
          : "Incomplete row or non-positive/invalid credit value.",
        rowNumber: index + 1,
      };
    })
    .filter(
      (row) =>
        row.normalizedCode !== ""
        || row.title !== ""
        || String(row.rawCredits).trim() !== ""
        || row.linkedCourse !== "",
    );
}

function processRows(rows, component, claimed, duplicates) {
  return rows.map((row) => {
    if (!row.validCredits) return row;
    const counted = claim(
      rowToCourse(row),
      component,
      claimed,
      duplicates,
    );
    return {
      ...row,
      counted,
      exclusionReason: counted
        ? ""
        : "Duplicate course; excluded from totals.",
    };
  });
}

function rowToCourse(row) {
  return {
    code: row.normalizedCode,
    displayCode: row.displayCode || row.normalizedCode.toUpperCase(),
    title: row.title,
    label:
      `${row.displayCode || row.normalizedCode.toUpperCase()} ${row.title}`.trim(),
    credits: row.credits,
  };
}

function claim(course, component, claimed, duplicates) {
  if (!course?.code) return false;
  const prior = claimed.get(course.code);
  if (prior) {
    duplicates.push({
      ...course,
      keptComponent: prior.component,
      excludedComponent: component,
      exclusionReason: `Already counted as ${prior.component}.`,
    });
    return false;
  }
  claimed.set(course.code, { component, course });
  return true;
}

function makeCourse(value, choiceLookup, questionName) {
  const code = normalizeIstCode(value);
  const metadata =
    choiceLookup?.getCourse?.(questionName, value)
    ?? IST_COURSE_CATALOG[code];

  if (!metadata) {
    throw new Error(
      `Missing IST course metadata for ${questionName}:${String(value ?? "")}`,
    );
  }

  const displayCode = metadata.displayCode;
  const lookupLabel = choiceLookup?.getLabel?.(questionName, value);
  const title =
    metadata.title
    ?? stripCourseCode(lookupLabel, displayCode)
    ?? "Course title not available";

  return {
    value: displayCode,
    code,
    displayCode,
    title,
    label: `${displayCode} ${title}`.trim(),
    credits: metadata.credits,
  };
}

function makeUnknownCourse(value) {
  const displayCode = String(value ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  return {
    value: displayCode,
    code: normalizeIstCode(value),
    displayCode,
    title: "Course title not available",
    label: displayCode,
    credits: 0,
  };
}

function createIstCourseData(surveyJson) {
  const catalogEntries = new Map();
  const coursesByQuestion = new Map();
  const codesByQuestion = new Map();
  const defaultsByQuestion = new Map();
  const choicesByQuestion = new Map();

  walkElements(surveyJson?.pages ?? [], (element) => {
    if (!element.name) return;

    defaultsByQuestion.set(
      element.name,
      Object.freeze(selectedValues(element.defaultValue)),
    );
    choicesByQuestion.set(
      element.name,
      Object.freeze(
        Array.isArray(element.choices)
          ? element.choices.map(choiceValue).filter(Boolean)
          : [],
      ),
    );

    if (
      !COURSE_QUESTION_NAMES.has(element.name)
      || !Array.isArray(element.choices)
    ) {
      return;
    }

    const questionCourses = new Map();
    const questionCodes = [];
    for (const choice of element.choices) {
      const course = courseFromChoice(choice);
      if (!course.code) continue;

      const existing = catalogEntries.get(course.code);
      if (existing && existing.credits !== course.credits) {
        throw new Error(
          `IST course ${course.displayCode} has conflicting credit values.`,
        );
      }

      questionCourses.set(course.code, course);
      questionCodes.push(course.displayCode);
      catalogEntries.set(course.code, course);
    }

    coursesByQuestion.set(element.name, questionCourses);
    codesByQuestion.set(element.name, Object.freeze(questionCodes));
  });

  return Object.freeze({
    catalog: Object.freeze(Object.fromEntries(catalogEntries)),
    coursesByQuestion,
    codesByQuestion,
    defaultsByQuestion,
    choicesByQuestion,
  });
}

function courseFromChoice(choice) {
  const rawValue =
    typeof choice === "object" && choice !== null ? choice.value : choice;
  const rawText =
    typeof choice === "object" && choice !== null ? choice.text : choice;
  const displayCode = String(rawValue ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const text = String(rawText ?? rawValue ?? "").trim();
  const credits =
    parseOptionalNumber(choice?.credits) ?? parseCreditsFromText(text);

  if (!Number.isFinite(credits)) {
    throw new Error(
      `IST choice ${displayCode || text || "(empty)"} must define numeric credits.`,
    );
  }

  const title =
    stripCourseCode(text, displayCode) || "Course title not available";
  return Object.freeze({
    code: normalizeIstCode(displayCode),
    displayCode,
    title,
    label: `${displayCode} ${title}`.trim(),
    credits,
  });
}

function choiceValue(choice) {
  const value =
    typeof choice === "object" && choice !== null
      ? choice.value ?? choice.text
      : choice;
  return String(value ?? "").trim();
}

function stripCourseCode(label, displayCode) {
  const text = String(label ?? "").trim();
  if (!text || normalizeIstCode(text) === normalizeIstCode(displayCode)) {
    return "";
  }
  const escaped = displayCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^${escaped}\\s*[-:]?\\s*`, "i"), "")
    .replace(
      /\s*[([]\s*\d+(?:[.,]\d+)?\s*ECTS?\s*[)\]]\s*$/i,
      "",
    )
    .trim();
}

function parseCreditsFromText(text) {
  const match = String(text ?? "").match(
    /[([]\s*(\d+(?:[.,]\d+)?)\s*ECTS?\s*[)\]]/i,
  );
  return match ? parseOptionalNumber(match[1]) : null;
}

function parseCredits(value) {
  if (
    value === undefined
    || value === null
    || String(value).trim() === ""
  ) {
    return { value: 0, valid: false };
  }
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0
    ? { value: parsed, valid: true }
    : { value: 0, valid: false };
}

function parseOptionalNumber(value) {
  if (
    value === undefined
    || value === null
    || String(value).trim() === ""
  ) {
    return null;
  }
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function selectedValues(value) {
  if (Array.isArray(value)) {
    return value.filter(
      (item) =>
        item !== undefined
        && item !== null
        && String(item).trim() !== "",
    );
  }
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function sumCourses(courses) {
  return roundCredits(
    courses.reduce(
      (total, course) => total + (Number(course?.credits) || 0),
      0,
    ),
  );
}

function sumCountedRows(rows) {
  return roundCredits(
    rows.reduce(
      (total, row) =>
        total + (row.validCredits && row.counted ? row.credits : 0),
      0,
    ),
  );
}

function roundCredits(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function isAffirmative(value) {
  return (
    isTrue(value)
    || String(value ?? "").trim().toLowerCase() === "yes"
  );
}

function codesForQuestion(courseData, questionName) {
  return Object.freeze([
    ...(courseData.codesByQuestion.get(questionName) ?? []),
  ]);
}

function defaultsForQuestion(courseData, questionName) {
  return Object.freeze([
    ...(courseData.defaultsByQuestion.get(questionName) ?? []),
  ]);
}

function choicesForQuestion(courseData, questionName) {
  return Object.freeze([
    ...(courseData.choicesByQuestion.get(questionName) ?? []),
  ]);
}

function defaultCodesFor(choiceLookup, questionName, fallback) {
  const codes = choiceLookup?.getDefaultCodes?.(questionName);
  return Array.isArray(codes) && codes.length > 0 ? codes : fallback;
}

function choiceValuesFor(choiceLookup, questionName, fallback) {
  const values = choiceLookup?.getChoiceValues?.(questionName);
  return Array.isArray(values) && values.length > 0 ? values : fallback;
}

function codeSet(values) {
  return new Set(values.map(normalizeIstCode));
}

function codeSetFor(choiceLookup, questionName, fallback) {
  const codes = choiceLookup?.getCodes?.(questionName);
  return Array.isArray(codes) && codes.length > 0
    ? codeSet(codes)
    : fallback;
}

export function normalizeIstCode(value) {
  return value === undefined || value === null
    ? ""
    : String(value).replace(/\s+/g, "").toLowerCase();
}

export const normalizeCode = normalizeIstCode;
