export function createChoiceLookup(surveyJson) {
  const byQuestion = new Map();
  const byValue = new Map();

  walkElements(surveyJson.pages ?? [], (element) => {
    if (!element.name || !Array.isArray(element.choices)) return;

    const questionLookup = new Map();
    for (const choice of element.choices) {
      const { value, text } = normalizeChoice(choice);
      questionLookup.set(value, text);
      questionLookup.set(normalizeCode(value), text);
      byValue.set(value, text);
      byValue.set(normalizeCode(value), text);
    }

    byQuestion.set(element.name, questionLookup);
  });

  return {
    getLabel(questionName, value) {
      if (value === undefined || value === null || value === "") return "";
      const rawValue = String(value);
      const normalized = normalizeCode(rawValue);
      const questionLookup = byQuestion.get(questionName);
      return questionLookup?.get(rawValue)
        ?? questionLookup?.get(normalized)
        ?? byValue.get(rawValue)
        ?? byValue.get(normalized)
        ?? rawValue;
    },
    courseLabel(value) {
      if (value === undefined || value === null || value === "") return "";
      const rawValue = String(value);
      return byValue.get(rawValue) ?? byValue.get(normalizeCode(rawValue)) ?? rawValue;
    },
  };
}

export function normalizeCode(value) {
  return value === undefined || value === null ? "" : String(value).trim().toLowerCase();
}

export function selectedValues(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

export function selectedCodes(data, name) {
  return selectedValues(data?.[name]).map(normalizeCode);
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function walkElements(nodes, callback) {
  for (const node of nodes) {
    if (Array.isArray(node.elements)) {
      walkElements(node.elements, callback);
    } else {
      callback(node);
    }
    if (Array.isArray(node.templateElements)) walkElements(node.templateElements, callback);
  }
}

function normalizeChoice(choice) {
  if (typeof choice === "string" || typeof choice === "number") {
    return { value: String(choice), text: String(choice) };
  }
  const value = choice.value ?? choice.text ?? "";
  const text = choice.text ?? choice.value ?? "";
  return { value: String(value), text: String(text) };
}
