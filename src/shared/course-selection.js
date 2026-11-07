// Normalizes selected courses, handles duplicates, and calculates counted ECTS.
import {
  courseFromValue,
  createCourseCodeResolver,
  normalizeCourseCode,
  selectedValues,
} from "./course-catalog.js";

export function createCourseClaims(choiceLookup) {
  return {
    courses: new Map(),
    identity: choiceLookup?.courseIdentity ?? createCourseCodeResolver(),
    incompleteRows: [],
  };
}

export function claimListedCourses({
  values,
  questionName,
  component,
  choiceLookup,
  claimed,
  duplicates,
  allowedCodes = choiceLookup?.getCodes?.(questionName) ?? [],
  invalidReason = "Not in the current form list.",
}) {
  const allowed = new Set(allowedCodes.map(claimed.identity));
  const courses = [];
  const invalidCourses = [];
  const duplicateCourses = [];

  for (const value of selectedValues(values)) {
    const code = normalizeCourseCode(value);
    if (!code) continue;

    if (!allowed.has(claimed.identity(code))) {
      invalidCourses.push({
        ...unknownCourse(value),
        counted: false,
        exclusionReason: invalidReason,
      });
      continue;
    }

    const course = courseFromValue(value, choiceLookup, questionName);
    if (claimCourse(course, component, claimed, duplicates)) {
      courses.push(course);
    } else {
      duplicateCourses.push(course);
    }
  }

  return { courses, invalidCourses, duplicateCourses };
}

export function normalizeManualCourseRows(rows, options = {}) {
  if (!Array.isArray(rows)) return [];

  const settings = {
    codeField: "code",
    titleFields: ["title"],
    creditsField: "credits",
    linkedCourseFields: ["linkedCourse", "linked_course", "master_course"],
    requireCode: true,
    requireTitle: true,
    requireLinkedCourse: false,
    allowZeroCredits: false,
    invalidReason: "Incomplete row or non-positive/invalid credit value.",
    ...options,
  };

  return rows
    .map((sourceRow, index) => normalizeManualRow(sourceRow, index, settings))
    .filter((row) => row.hasInput);
}

export function sumCourses(items) {
  return roundCredits(
    items.reduce(
      (total, item) => total + (Number(item?.credits) || 0),
      0,
    ),
  );
}

export function parseCourseCredits(value, allowZero = false) {
  if (
    value === undefined
    || value === null
    || String(value).trim() === ""
  ) {
    return { value: 0, valid: false };
  }

  const parsed = Number(String(value).trim().replace(",", "."));
  const minimumMet = allowZero ? parsed >= 0 : parsed > 0;
  return Number.isFinite(parsed) && minimumMet
    ? { value: parsed, valid: true }
    : { value: 0, valid: false };
}

export function roundCredits(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function uniqueCourseCodes(values) {
  return [...new Set(
    selectedValues(values).map(normalizeCourseCode).filter(Boolean),
  )];
}

export function repeatedCourseCodes(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    const code = normalizeCourseCode(value);
    if (seen.has(code)) repeated.add(code);
    seen.add(code);
  }
  return [...repeated];
}

export function claimCourse(item, component, claimed, duplicates) {
  if (!item?.code) return false;
  const identity = claimed.identity(item.code);
  const prior = claimed.courses.get(identity);
  item.counted = !prior;
  if (prior) {
    recordCourseDuplicate(item, component, prior, duplicates);
    return false;
  }
  claimed.courses.set(identity, { component, item });
  return true;
}

export function recordCourseDuplicate(
  item,
  component,
  prior,
  duplicates,
) {
  item.duplicate = true;
  item.counted = false;
  item.exclusionReason = "Not counted (duplicate)";
  duplicates.push({
    ...item,
    displayCode: normalizeCourseCode(item.value ?? item.displayCode ?? item.code).toUpperCase(),
    keptComponent: prior.component,
    excludedComponent: component,
    keptCode: prior.item.displayCode,
    keptRowNumber: prior.item.rowNumber,
    keptCredits: prior.item.credits,
    creditMismatch: item.validCredits !== false && item.credits !== prior.item.credits,
  });
}

export function renameCourseClaim(item, component, claimed) {
  if (!item?.code) return;
  const prior = claimed.courses.get(claimed.identity(item.code));
  if (prior?.item === item) prior.component = component;
}

export function claimManualCourseRows(
  rows,
  component,
  claimed,
  duplicates,
) {
  return rows.map((row) => {
    if (!row.validCredits) {
      claimed.incompleteRows.push({ row, component });
      return row;
    }
    const displayCode = row.displayCode || row.normalizedCode.toUpperCase();
    const item = {
      code: row.normalizedCode,
      value: row.code,
      displayCode,
      title: row.title,
      label: [displayCode, row.title].filter(Boolean).join(" "),
      credits: row.credits,
      rowNumber: row.rowNumber,
    };
    const counted = claimCourse(item, component, claimed, duplicates);
    return {
      ...row,
      counted,
      duplicate: item.duplicate === true,
      exclusionReason: counted
        ? ""
        : "Not counted (duplicate)",
    };
  });
}

// Incomplete rows cannot reserve a code or displace a later valid course.
export function finalizeCourseClaims(claimed, duplicates) {
  for (const { row, component } of claimed.incompleteRows) {
    const prior = claimed.courses.get(claimed.identity(row.normalizedCode));
    if (prior) recordCourseDuplicate(row, component, prior, duplicates);
  }
  claimed.incompleteRows.length = 0;
}

export function duplicateCourseDetail(duplicate) {
  const kept = duplicate.keptComponent
    + (duplicate.keptRowNumber ? `, row ${duplicate.keptRowNumber}` : "");
  const excluded = duplicate.excludedComponent
    + (duplicate.rowNumber ? `, row ${duplicate.rowNumber}` : "");
  return `Already counted under ${kept}. It does not contribute additional credits in ${excluded}.`
    + (duplicate.creditMismatch
      ? ` Credits differ: ${duplicate.keptCredits} and ${duplicate.credits}.`
      : "");
}

export function duplicateCourseValidations(duplicates = []) {
  return duplicates.map((duplicate) => ({
    label: "Double counting",
    status: "error",
    duplicateCode: duplicate.displayCode,
    detail: `Duplicate course detected: ${duplicate.displayCode}. ${duplicateCourseDetail(duplicate)}`,
  }));
}

export function sumCountedCourses(items) {
  return sumCourses(items.filter((item) => item.counted !== false));
}

export function sumCountedRows(rows) {
  return sumCourses(rows.filter((row) => row.validCredits && row.counted));
}

function normalizeManualRow(sourceRow, index, settings) {
  const row = sourceRow ?? {};
  const code = String(row[settings.codeField] ?? "").trim();
  const normalizedCode = normalizeCourseCode(code);
  const title = firstFilledValue(row, settings.titleFields);
  const rawCredits = row[settings.creditsField] ?? "";
  const parsedCredits = parseCourseCredits(
    rawCredits,
    settings.allowZeroCredits,
  );
  const linkedCourse = firstFilledValue(row, settings.linkedCourseFields);
  const fieldsComplete =
    (!settings.requireCode || normalizedCode !== "")
    && (!settings.requireTitle || title !== "")
    && (!settings.requireLinkedCourse || linkedCourse !== "");
  const validCredits = fieldsComplete && parsedCredits.valid;
  const hasInput =
    normalizedCode !== ""
    || title !== ""
    || String(rawCredits).trim() !== ""
    || linkedCourse !== "";

  return {
    code,
    displayCode: code || normalizedCode.toUpperCase(),
    normalizedCode,
    title,
    credits: validCredits ? parsedCredits.value : 0,
    rawCredits,
    linkedCourse,
    masterCourse: linkedCourse,
    validCredits,
    exclusionReason: validCredits ? "" : settings.invalidReason,
    rowNumber: index + 1,
    hasInput,
  };
}

function firstFilledValue(row, fields) {
  for (const field of fields ?? []) {
    const value = String(row?.[field] ?? "").trim();
    if (value !== "") return value;
  }
  return "";
}

function unknownCourse(value) {
  const displayCode = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  return {
    value: displayCode,
    code: normalizeCourseCode(value),
    displayCode,
    title: "Course title not available",
    label: displayCode,
    credits: 0,
  };
}
