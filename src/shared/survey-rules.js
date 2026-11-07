// Reads numeric programme rules and calculated values from SurveyJS data.
import { sumCountedRows } from "./course-selection.js";

// Matrix footers otherwise sum raw entries, including excluded duplicates.
export function syncCourseCreditDisplays(survey, report, choiceLookup) {
  for (const [name, rows] of Object.entries(report.manualCourseTables ?? {})) {
    const table = survey.getQuestionByName(name);
    const column = table?.columns?.find(({ name }) => name === "credits");
    if (!column || column.totalType !== "sum") continue;
    const total = sumCountedRows(rows);
    const expression = String(total);
    if (column.totalExpression !== expression) column.totalExpression = expression;
    // SurveyJS does not refresh an already-created total cell on column changes.
    const cell = table.visibleTotalRow?.getQuestionByColumnName("credits");
    if (cell) {
      if (cell.expression !== expression) cell.expression = expression;
      if (cell.value !== total) cell.value = total;
    }
  }
  // Allocation notices must use the same counted totals as the report.
  for (const question of survey.getAllQuestions()) {
    const source = choiceLookup?.getQuestion(question.name);
    if (source?.type !== "html") continue;
    for (const [name, total] of Object.entries(report.allocationCredits ?? {})) {
      if (source.visibleIf !== `{${name}} > 0`) continue;
      question.visibleIf = "";
      question.visible = total > 0;
      question.html = source.html.replaceAll(`{${name}}`, String(total));
    }
  }
}

export function readNumericRulesFromSurvey(
  surveyJson,
  fields,
  sourceLabel = "Survey form",
) {
  const calculatedValues = Array.isArray(surveyJson?.calculatedValues)
    ? surveyJson.calculatedValues
    : [];

  return Object.fromEntries(
    Object.entries(fields).map(([key, fieldName]) => [
      key,
      readCalculatedNumericValue(calculatedValues, fieldName, sourceLabel),
    ]),
  );
}

export function resolveNumericRules(data, defaults, fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, fieldName]) => [
      key,
      readNumericRule(data, fieldName, defaults[key]),
    ]),
  );
}

export function readNumericRule(data, fieldName, fallback) {
  return readNumericValue(data, fieldName, fallback);
}

export function readNumericValue(data, fieldName, fallback) {
  const rawValue = data?.[fieldName];
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

export function readCalculatedNumericValue(
  calculatedValues,
  fieldName,
  sourceLabel = "Survey form",
) {
  const expression = calculatedValues.find(
    (item) => item?.name === fieldName,
  )?.expression;
  const value = Number(expression);

  if (!Number.isFinite(value)) {
    throw new Error(
      `${sourceLabel} rule ${fieldName} must be a numeric calculated value.`,
    );
  }

  return value;
}
