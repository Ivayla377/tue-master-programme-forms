import surveySource from "../../../forms/iam/form.json" with { type: "json" };
import { Serializer } from "survey-core";

import { createChoiceLookup as createSharedChoiceLookup, walkElements } from "../../shared/course-utils.js";
import { formatCredits, isTrue } from "../../shared/credit-utils.js";
import { registerCourseChoiceMetadata } from "./survey-metadata.js";

registerCourseChoiceMetadata(Serializer);

const RULE_FIELD_NAMES = Object.freeze({
  programmeTarget: "rule_programme_target",
  coreMinimum: "rule_core_min_credits",
  coreMinimumCount: "rule_core_min_count",
  coreSpecializationMinimum: "rule_core_specialization_min_credits",
  homologationMaximum: "rule_homologation_max_credits",
});

const DEFAULT_RULES = readDefaultRules(surveySource);

const QUESTION_NAMES = Object.freeze({
  mandatory: "mandatory_components_display",
  core: "core_electives",
  specialization: "specialization_electives",
  officialFree: "official_free_electives",
  internship: "internship_course_display",
});

const FORM_COURSE_DATA = createIamCourseData(surveySource);

export const IAM_COURSE_CATALOG = FORM_COURSE_DATA.catalog;
export const MANDATORY_CODES = defaultsForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.mandatory);
export const CORE_ELECTIVE_CODES = codesForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.core);
export const SPECIALIZATION_ELECTIVE_CODES = codesForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.specialization);
export const OFFICIAL_FREE_ELECTIVE_CODES = codesForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.officialFree);


const CORE_CODE_SET = codeSet(CORE_ELECTIVE_CODES);
const SPECIALIZATION_CODE_SET = codeSet(SPECIALIZATION_ELECTIVE_CODES);
const OFFICIAL_FREE_CODE_SET = codeSet(OFFICIAL_FREE_ELECTIVE_CODES);
const INTERNSHIP_CODE = defaultsForQuestion(FORM_COURSE_DATA, QUESTION_NAMES.internship)[0] ?? "";

export function createIamChoiceLookup(surveyJson = surveySource) {
  const baseLookup = createSharedChoiceLookup(surveyJson);
  const courseData = createIamCourseData(surveyJson);

  return {
    ...baseLookup,
    getCourse(questionName, value) {
      const code = normalizeIamCode(value);
      return courseData.coursesByQuestion.get(questionName)?.get(code) ?? courseData.catalog[code] ?? null;
    },
    getCodes(questionName) {
      return codesForQuestion(courseData, questionName);
    },
  };
}

export const createChoiceLookup = createIamChoiceLookup;

export function calculateIam(data = {}, choiceLookup = createIamChoiceLookup()) {
  const rules = resolveRules(data);
  const duplicates = [];
  const claimed = new Map();

  const mandatoryCourses = MANDATORY_CODES.map((code) => makeCourse(code, choiceLookup, QUESTION_NAMES.mandatory));
  for (const item of mandatoryCourses) claim(item, "mandatory component", claimed, duplicates);

  const coreSelection = processStructuredSelection({
    values: selectedValues(data.core_electives),
    allowedCodes: codeSetFor(choiceLookup, QUESTION_NAMES.core, CORE_CODE_SET),
    questionName: QUESTION_NAMES.core,
    component: "core elective",
    choiceLookup,
    claimed,
    duplicates,
  });

  const specializationSelection = processStructuredSelection({
    values: selectedValues(data.specialization_electives),
    allowedCodes: codeSetFor(choiceLookup, QUESTION_NAMES.specialization, SPECIALIZATION_CODE_SET),
    questionName: QUESTION_NAMES.specialization,
    component: "special elective",
    choiceLookup,
    claimed,
    duplicates,
  });

  const mastermathRows = processRows(
    normalizeRows(data.mastermath_special_electives),
    "Mastermath/special elective",
    claimed,
    duplicates,
  );

  const officialFreeSelection = processStructuredSelection({
    values: selectedValues(data.official_free_electives),
    allowedCodes: codeSetFor(choiceLookup, QUESTION_NAMES.officialFree, OFFICIAL_FREE_CODE_SET),
    questionName: QUESTION_NAMES.officialFree,
    component: "free elective",
    choiceLookup,
    claimed,
    duplicates,
  });

  const internship = resolveInternship(data, choiceLookup);
  if (internship.course) {
    internship.counted = claim(internship.course, "internship", claimed, duplicates);
    internship.exclusionReason = internship.counted ? "" : "Duplicate course; excluded from totals.";
  }

  const homologationActive = isAffirmative(data.homologation);
  const selfChosenHomologationActive = homologationActive && isAffirmative(data.self_chosen_homologation);
  const homologationRows = homologationActive
    ? processRows(normalizeRows(data.homologation_courses), "homologation", claimed, duplicates)
    : [];
  const selfChosenHomologationRows = selfChosenHomologationActive
    ? processRows(
        normalizeRows(data.bachelor_free_electives, { requireLinkedCourse: true }),
        "self-chosen homologation",
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

  const mandatory = sumCourses(mandatoryCourses);
  const professionalPortfolio = creditFor(mandatoryCourses, "2MMR10");
  const finalProject = creditFor(mandatoryCourses, "2MMR30");
  const coreElectives = sumCourses(coreSelection.courses);
  const listedSpecialization = sumCourses(specializationSelection.courses);
  const mastermathSpecialization = sumCountedRows(mastermathRows);
  const specializationElectives = roundCredits(listedSpecialization + mastermathSpecialization);
  const coreAndSpecialization = roundCredits(coreElectives + specializationElectives);
  const officialFreeElectives = sumCourses(officialFreeSelection.courses);
  const internshipCredits = internship.selected && internship.counted
    ? internship.credits
    : 0;
  const assignedHomologation = sumCountedRows(homologationRows);
  const selfChosenHomologation = sumCountedRows(selfChosenHomologationRows);
  const homologation = roundCredits(assignedHomologation + selfChosenHomologation);
  const freeElectiveRowsCredits = sumCountedRows(freeElectiveRows);
  const freeElectiveSpace = roundCredits(
    officialFreeElectives + internshipCredits + homologation + freeElectiveRowsCredits,
  );
  const total = roundCredits(mandatory + coreAndSpecialization + freeElectiveSpace);

  const invalidManualRows = [
    ...mastermathRows,
    ...homologationRows,
    ...selfChosenHomologationRows,
    ...freeElectiveRows,
  ].filter((row) => !row.validCredits);
  const coreCount = coreSelection.courses.length;
  const homologationRowsPresent = homologationRows.filter((row) => row.validCredits && row.counted).length > 0;

  const flags = {
    coreMinimumMet: coreElectives >= rules.coreMinimum,
    coreCountMet: coreCount >= rules.coreMinimumCount,
    coreSpecializationMinimumMet: coreAndSpecialization >= rules.coreSpecializationMinimum,
    totalAtLeastTarget: total >= rules.programmeTarget,
    totalOverTarget: total > rules.programmeTarget,
    homologationWithinLimit: homologation <= rules.homologationMaximum,
    hasInvalidCoreSelections: coreSelection.invalidCourses.length > 0,
    hasInvalidSpecializationSelections: specializationSelection.invalidCourses.length > 0,
    hasInvalidOfficialFreeSelections: officialFreeSelection.invalidCourses.length > 0,
    hasInvalidManualRows: invalidManualRows.length > 0,
    hasDuplicates: duplicates.length > 0,
    hasAssignedHomologation: homologationRowsPresent,
    hasSelfChosenHomologation: selfChosenHomologation > 0,
    hasMastermathSpecialization: mastermathSpecialization > 0,
    hasInternship: internship.selected && internship.counted,
  };

  const validations = buildValidations({
    flags,
    rules,
    coreElectives,
    coreCount,
    specializationElectives,
    coreAndSpecialization,
    total,
    assignedHomologation,
    selfChosenHomologation,
    homologation,
    invalidManualRows,
    invalidCoreCourses: coreSelection.invalidCourses,
    invalidSpecializationCourses: specializationSelection.invalidCourses,
    invalidOfficialFreeCourses: officialFreeSelection.invalidCourses,
    duplicates,
    internship,
  });

  const hasErrors = validations.some((validation) => validation.status === "error");
  const hasWarnings = validations.some((validation) => validation.status === "warning");

  return {
    rules,
    subtotals: {
      mandatory,
      professionalPortfolio,
      finalProject,
      coreElectives,
      listedSpecialization,
      mastermathSpecialization,
      specializationElectives,
      coreAndSpecialization,
      officialFreeElectives,
      internship: internshipCredits,
      assignedHomologation,
      selfChosenHomologation,
      homologation,
      freeElectiveRows: freeElectiveRowsCredits,
      freeElectiveSpace,
      total,
    },
    selected: {
      mandatoryCourses,
      coreElectiveCourses: coreSelection.courses,
      invalidCoreCourses: coreSelection.invalidCourses,
      specializationElectiveCourses: specializationSelection.courses,
      invalidSpecializationCourses: specializationSelection.invalidCourses,
      mastermathSpecializationRows: mastermathRows,
      officialFreeElectiveCourses: officialFreeSelection.courses,
      invalidOfficialFreeCourses: officialFreeSelection.invalidCourses,
      internship,
      homologationRows,
      selfChosenHomologationRows,
      freeElectiveRows,
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

export const calculateEcts = calculateIam;

function readDefaultRules(surveyJson) {
  const calculatedValues = Array.isArray(surveyJson?.calculatedValues) ? surveyJson.calculatedValues : [];
  return {
    programmeTarget: readConstantRule(calculatedValues, RULE_FIELD_NAMES.programmeTarget),
    coreMinimum: readConstantRule(calculatedValues, RULE_FIELD_NAMES.coreMinimum),
    coreMinimumCount: readConstantRule(calculatedValues, RULE_FIELD_NAMES.coreMinimumCount),
    coreSpecializationMinimum: readConstantRule(calculatedValues, RULE_FIELD_NAMES.coreSpecializationMinimum),
    homologationMaximum: readConstantRule(calculatedValues, RULE_FIELD_NAMES.homologationMaximum),
  };
}

function readConstantRule(calculatedValues, field) {
  const expression = calculatedValues.find((item) => item?.name === field)?.expression;
  const value = Number(expression);
  if (!Number.isFinite(value)) throw new Error("IAM form rule " + field + " must be a numeric calculated value.");
  return value;
}

function resolveRules(data) {
  return {
    programmeTarget: readRule(data, RULE_FIELD_NAMES.programmeTarget, DEFAULT_RULES.programmeTarget),
    coreMinimum: readRule(data, RULE_FIELD_NAMES.coreMinimum, DEFAULT_RULES.coreMinimum),
    coreMinimumCount: readRule(data, RULE_FIELD_NAMES.coreMinimumCount, DEFAULT_RULES.coreMinimumCount),
    coreSpecializationMinimum: readRule(
      data,
      RULE_FIELD_NAMES.coreSpecializationMinimum,
      DEFAULT_RULES.coreSpecializationMinimum,
    ),
    homologationMaximum: readRule(data, RULE_FIELD_NAMES.homologationMaximum, DEFAULT_RULES.homologationMaximum),
  };
}

function readRule(data, field, fallback) {
  const rawValue = data?.[field];
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function buildValidations(values) {
  const validations = [
    {
      label: "Core electives",
      status: values.flags.coreMinimumMet && values.flags.coreCountMet ? "success" : "error",
      detail: values.flags.coreMinimumMet && values.flags.coreCountMet
        ? `${values.coreCount} core electives selected (${formatCredits(values.coreElectives)}).`
        : `${formatCredits(values.coreElectives)} / at least ${formatCredits(values.rules.coreMinimum)}.`,
    },
    {
      label: "Core and specialization total",
      status: values.flags.coreSpecializationMinimumMet ? "success" : "error",
      detail: `${formatCredits(values.coreAndSpecialization)} / at least ${formatCredits(values.rules.coreSpecializationMinimum)}.`,
    },
    totalValidation(values.total, values.rules.programmeTarget),
    {
      label: "Homologation credits",
      status: values.flags.homologationWithinLimit ? "success" : "error",
      detail: values.homologation === 0
        ? "No homologation credits included."
        : `${formatCredits(values.homologation)} / maximum ${formatCredits(values.rules.homologationMaximum)} homologation credits (${formatCredits(values.assignedHomologation)} assigned, ${formatCredits(values.selfChosenHomologation)} self-chosen).`,
    },
  ];

  if (values.invalidCoreCourses.length > 0) {
    validations.push({
      label: "Core-elective eligibility",
      status: "error",
      detail: `${values.invalidCoreCourses.map((course) => course.displayCode).join(", ")} excluded because they are not current IAM core electives.`,
    });
  }

  if (values.invalidSpecializationCourses.length > 0) {
    validations.push({
      label: "Specialization-elective eligibility",
      status: "error",
      detail: `${values.invalidSpecializationCourses.map((course) => course.displayCode).join(", ")} excluded because they are not current IAM specialization electives.`,
    });
  }

  if (values.invalidOfficialFreeCourses.length > 0) {
    validations.push({
      label: "Official free-elective eligibility",
      status: "error",
      detail: `${values.invalidOfficialFreeCourses.map((course) => course.displayCode).join(", ")} excluded because they are not current listed IAM free electives.`,
    });
  }

  if (values.invalidManualRows.length > 0) {
    validations.push({
      label: "Manual course rows",
      status: "error",
      detail: "Complete the course code, title and positive ECTS value for every manually entered row; bachelor rows also need a linked master-level course or project.",
    });
  }

  if (values.duplicates.length > 0) {
    validations.push({
      label: "Double counting",
      status: "error",
      detail: `${values.duplicates.map((course) => course.displayCode).join(", ")} excluded from lower-priority selections because each course may count only once.`,
    });
  }

  if (values.flags.hasAssignedHomologation) {
    validations.push({
      label: "Homologation academic review",
      status: "warning",
      detail: "Homologation included - review required for necessity and academic fit.",
    });
  }

  if (values.flags.hasSelfChosenHomologation) {
    validations.push({
      label: "Self-chosen homologation review",
      status: "warning",
      detail: "Self-chosen homologation included - add a motivation for the deficiency it compensates.",
    });
  }

  if (values.flags.hasMastermathSpecialization) {
    validations.push({
      label: "Mastermath specialization review",
      status: "warning",
      detail: "Mastermath or other approved specialization elective included - review required for fit and overlap.",
    });
  }

  if (values.internship.selected && values.internship.counted) {
    validations.push({
      label: "Internship",
      status: "warning",
      detail: "Internship included - permission required before starting.",
    });
  }

  return validations;
}

function totalValidation(total, programmeTarget) {
  if (total < programmeTarget) {
    return {
      label: "Total credits",
      status: "error",
      detail: `${formatCredits(total)} / at least ${formatCredits(programmeTarget)}.`,
    };
  }
  if (total > programmeTarget) {
    return {
      label: "Total credits",
      status: "warning",
      detail: `${formatCredits(total)} selected; ${formatCredits(programmeTarget)} is the normal programme size.`,
    };
  }
  return {
    label: "Total credits",
    status: "success",
    detail: `${formatCredits(total)} selected.`,
  };
}

function processStructuredSelection({ values, allowedCodes, questionName, component, choiceLookup, claimed, duplicates }) {
  const seen = new Set();
  const courses = [];
  const invalidCourses = [];

  for (const value of values) {
    const code = normalizeIamCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    if (!allowedCodes.has(code)) {
      invalidCourses.push({ ...makeUnknownCourse(value), counted: false, exclusionReason: "Not in the current PER list." });
      continue;
    }
    const item = makeCourse(value, choiceLookup, questionName);
    if (claim(item, component, claimed, duplicates)) {
      courses.push(item);
    } else {
      invalidCourses.push({ ...item, counted: false, exclusionReason: "Duplicate selection; excluded from totals." });
    }
  }

  return { courses, invalidCourses };
}

function resolveInternship(data, choiceLookup) {
  const selected = isAffirmative(data.internship);
  const course = selected && INTERNSHIP_CODE
    ? makeCourse(INTERNSHIP_CODE, choiceLookup, QUESTION_NAMES.internship)
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

function normalizeRows(rows, options = {}) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      const displayCode = String(row?.code ?? "").trim();
      const normalizedCode = normalizeIamCode(displayCode);
      const title = String(row?.title ?? row?.name ?? "").trim();
      const rawCredits = row?.credits ?? "";
      const parsedCredits = parseCredits(rawCredits);
      const linkedCourse = String(row?.master_course ?? row?.linkedCourse ?? row?.linked_course ?? "").trim();
      const validCredits = normalizedCode !== ""
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
        exclusionReason: validCredits ? "" : "Incomplete row or non-positive/invalid credit value.",
        rowNumber: index + 1,
      };
    })
    .filter((row) =>
      row.normalizedCode !== "" || row.title !== "" || String(row.rawCredits).trim() !== "" || row.linkedCourse !== "");
}

function processRows(rows, component, claimed, duplicates) {
  return rows.map((row) => {
    if (!row.validCredits) return row;
    const item = rowToCourse(row);
    const counted = claim(item, component, claimed, duplicates);
    return {
      ...row,
      counted,
      exclusionReason: counted ? "" : "Duplicate course; excluded from totals.",
    };
  });
}

function rowToCourse(row) {
  return {
    code: row.normalizedCode,
    displayCode: row.displayCode || row.normalizedCode.toUpperCase(),
    title: row.title,
    label: `${row.displayCode || row.normalizedCode.toUpperCase()} ${row.title}`.trim(),
    credits: row.credits,
  };
}

function claim(item, component, claimed, duplicates) {
  if (!item?.code) return false;
  const prior = claimed.get(item.code);
  if (prior) {
    duplicates.push({
      ...item,
      keptComponent: prior.component,
      excludedComponent: component,
      exclusionReason: `Already counted as ${prior.component}.`,
    });
    return false;
  }
  claimed.set(item.code, { component, item });
  return true;
}

function makeCourse(value, choiceLookup, questionName) {
  const code = normalizeIamCode(value);
  const metadata = choiceLookup?.getCourse?.(questionName, value) ?? IAM_COURSE_CATALOG[code];
  if (!metadata) {
    throw new Error(`Missing IAM course metadata for ${questionName}:${String(value ?? "")}`);
  }
  const displayCode = metadata.displayCode;
  const lookupLabel = choiceLookup?.getLabel?.(questionName, value);
  const title = metadata.title
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
  const displayCode = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  return {
    value: displayCode,
    code: normalizeIamCode(value),
    displayCode,
    title: "Course title not available",
    label: displayCode,
    credits: 0,
  };
}

function createIamCourseData(surveyJson) {
  const catalogEntries = new Map();
  const coursesByQuestion = new Map();
  const codesByQuestion = new Map();
  const defaultsByQuestion = new Map();

  walkElements(surveyJson?.pages ?? [], (element) => {
    if (!element.name) return;
    defaultsByQuestion.set(element.name, Object.freeze(selectedValues(element.defaultValue)));
    if (!Array.isArray(element.choices)) return;

    const questionCourses = new Map();
    const questionCodes = [];
    for (const choice of element.choices) {
      const item = courseFromChoice(choice);
      if (!item.code) continue;
      questionCourses.set(item.code, item);
      questionCodes.push(item.displayCode);
      catalogEntries.set(item.code, item);
    }

    coursesByQuestion.set(element.name, questionCourses);
    codesByQuestion.set(element.name, Object.freeze(questionCodes));
  });

  return Object.freeze({
    catalog: Object.freeze(Object.fromEntries(catalogEntries)),
    coursesByQuestion,
    codesByQuestion,
    defaultsByQuestion,
  });
}

function courseFromChoice(choice) {
  const rawValue = typeof choice === "object" && choice !== null ? choice.value : choice;
  const rawText = typeof choice === "object" && choice !== null ? choice.text : choice;
  const displayCode = String(rawValue ?? "").replace(/\s+/g, "").toUpperCase();
  const text = String(rawText ?? rawValue ?? "").trim();
  const credits = parseOptionalNumber(choice?.credits) ?? parseCreditsFromText(text);
  if (!Number.isFinite(credits)) {
    throw new Error(`IAM choice ${displayCode || text || "(empty)"} must define numeric credits.`);
  }
  const title = stripCourseCode(text, displayCode) || "Course title not available";
  return Object.freeze({
    code: normalizeIamCode(displayCode),
    displayCode,
    title,
    label: `${displayCode} ${title}`.trim(),
    credits,
  });
}

function stripCourseCode(label, displayCode) {
  const text = String(label ?? "").trim();
  if (!text || normalizeIamCode(text) === normalizeIamCode(displayCode)) return "";
  const escaped = displayCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^${escaped}\\s*[-:]?\\s*`, "i"), "")
    .replace(/\s*[([]\s*\d+(?:[.,]\d+)?\s*ECTS?\s*[)\]]\s*$/i, "")
    .trim();
}

function parseCreditsFromText(text) {
  const match = String(text ?? "").match(/[([]\s*(\d+(?:[.,]\d+)?)\s*ECTS?\s*[)\]]/i);
  return match ? parseOptionalNumber(match[1]) : null;
}

function parseCredits(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { value: 0, valid: false };
  }
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0
    ? { value: parsed, valid: true }
    : { value: 0, valid: false };
}

function selectedValues(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null && String(item) !== "");
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function sumCourses(items) {
  return roundCredits(items.reduce((total, item) => total + (Number(item?.credits) || 0), 0));
}

function sumCountedRows(rows) {
  return roundCredits(rows.reduce(
    (total, row) => total + (row.validCredits && row.counted ? row.credits : 0),
    0,
  ));
}

function creditFor(courses, code) {
  return courses.find((course) => course.code === normalizeIamCode(code))?.credits ?? 0;
}


function parseOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCredits(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function isAffirmative(value) {
  return isTrue(value) || String(value ?? "").trim().toLowerCase() === "yes";
}

function codesForQuestion(courseData, questionName) {
  return Object.freeze([...(courseData.codesByQuestion.get(questionName) ?? [])]);
}

function defaultsForQuestion(courseData, questionName) {
  return Object.freeze([...(courseData.defaultsByQuestion.get(questionName) ?? [])]);
}

function codeSet(values) {
  return new Set(values.map(normalizeIamCode));
}

function codeSetFor(choiceLookup, questionName, fallback) {
  const codes = choiceLookup?.getCodes?.(questionName);
  return Array.isArray(codes) && codes.length > 0 ? codeSet(codes) : fallback;
}

export function normalizeIamCode(value) {
  return value === undefined || value === null
    ? ""
    : String(value).replace(/\s+/g, "").toLowerCase();
}

export const normalizeCode = normalizeIamCode;
