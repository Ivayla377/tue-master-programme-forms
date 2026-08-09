// Normalizes manual course rows and provides reusable course aggregation helpers.
import {
  normalizeCourseCode,
  selectedValues,
} from "./course-utils.js";

export function normalizeManualCourseRows(rows, options = {}) {
  if (!Array.isArray(rows)) return [];

  const settings = {
    codeField: "code",
    titleFields: ["title", "name"],
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
  const prior = claimed.get(item.code);
  if (prior) {
    recordCourseDuplicate(item, component, prior, duplicates);
    return false;
  }
  claimed.set(item.code, { component, item });
  return true;
}

export function recordCourseDuplicate(
  item,
  component,
  prior,
  duplicates,
) {
  duplicates.push({
    ...item,
    keptComponent: prior.component,
    excludedComponent: component,
    exclusionReason: `Already counted as ${prior.component}.`,
  });
}

export function renameCourseClaim(item, component, claimed) {
  if (!item?.code || !claimed.has(item.code)) return;
  claimed.set(item.code, { component, item });
}

export function claimManualCourseRows(
  rows,
  component,
  claimed,
  duplicates,
) {
  return rows.map((row) => {
    if (!row.validCredits) return row;
    const displayCode = row.displayCode || row.normalizedCode.toUpperCase();
    const item = {
      code: row.normalizedCode,
      value: row.code,
      displayCode,
      title: row.title,
      label: [displayCode, row.title].filter(Boolean).join(" "),
      credits: row.credits,
    };
    const counted = claimCourse(item, component, claimed, duplicates);
    return {
      ...row,
      counted,
      exclusionReason: counted
        ? ""
        : "Duplicate course; excluded from totals.",
    };
  });
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
    name: title,
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
