// Reads numeric programme rules and calculated values from SurveyJS data.
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
