// Indexes SurveyJS questions and resolves normalized course metadata from choices.
export function createChoiceLookup(surveyJson = {}) {
  const questions = indexSurveyQuestions(surveyJson);
  const choicesByQuestion = new Map();
  const coursesByCode = new Map();

  for (const [questionName, question] of questions) {
    if (!Array.isArray(question.choices)) continue;

    const questionChoices = question.choices.map(courseFromChoice);
    const byValue = new Map();
    for (const choice of questionChoices) {
      byValue.set(choice.value, choice);
      byValue.set(normalizeCode(choice.value), choice);
      if (choice.code && !coursesByCode.has(choice.code)) {
        coursesByCode.set(choice.code, choice);
      }
    }

    choicesByQuestion.set(questionName, {
      list: Object.freeze(questionChoices),
      byValue,
    });
  }

  function findChoice(questionName, value) {
    if (value === undefined || value === null || value === "") return null;
    const rawValue = String(value);
    return choicesByQuestion.get(questionName)?.byValue.get(rawValue)
      ?? choicesByQuestion.get(questionName)?.byValue.get(normalizeCode(rawValue))
      ?? null;
  }

  return {
    getLabel(questionName, value) {
      if (value === undefined || value === null || value === "") return "";
      return findChoice(questionName, value)?.text
        ?? coursesByCode.get(normalizeCode(value))?.text
        ?? String(value);
    },
    courseLabel(value) {
      if (value === undefined || value === null || value === "") return "";
      return coursesByCode.get(normalizeCode(value))?.text ?? String(value);
    },
    getCourse(questionName, value) {
      return findChoice(questionName, value)
        ?? coursesByCode.get(normalizeCode(value))
        ?? null;
    },
    getChoice(questionName, value) {
      return findChoice(questionName, value);
    },
    getChoices(questionName) {
      return choicesByQuestion.get(questionName)?.list ?? [];
    },
    getQuestion(questionName) {
      return questions.get(questionName) ?? null;
    },
    getCodes(questionName) {
      return (choicesByQuestion.get(questionName)?.list ?? [])
        .map((choice) => choice.displayCode)
        .filter(Boolean);
    },
    getChoiceValues(questionName) {
      return (choicesByQuestion.get(questionName)?.list ?? [])
        .map((choice) => choice.value)
        .filter(Boolean);
    },
    getCourses() {
      return Object.freeze([...coursesByCode.values()]);
    },
    getDefaultCodes(questionName) {
      return selectedValues(questions.get(questionName)?.defaultValue)
        .map((value) => String(value).replace(/\s+/g, "").toUpperCase());
    },
  };
}

export function defaultCourseCodes(
  choiceLookup,
  questionName,
  fallback = [],
) {
  const codes = choiceLookup?.getDefaultCodes?.(questionName);
  return Array.isArray(codes) && codes.length > 0 ? codes : fallback;
}

export function indexSurveyQuestions(surveyJson = {}) {
  const questions = new Map();

  visitElements(surveyJson.pages ?? [], (element) => {
    if (element?.name) questions.set(element.name, element);
  });

  return questions;
}

export function courseFromChoice(choice) {
  const source = normalizeChoice(choice);
  const displayCode = String(source.value).replace(/\s+/g, "").toUpperCase();
  const code = normalizeCode(displayCode);
  const credits = resolveChoiceCredits(choice);
  const title = stripCourseCodeAndCredits(source.text, displayCode);
  const label = [displayCode, title].filter(Boolean).join(" ");

  return Object.freeze({
    ...(typeof choice === "object" && choice !== null ? choice : {}),
    value: source.value,
    text: source.text,
    code,
    displayCode,
    title,
    label: label || source.text || displayCode,
    credits,
  });
}

export function courseFromValue(
  value,
  choiceLookup,
  questionName,
  fallbackCredits,
) {
  const metadata = choiceLookup?.getCourse?.(questionName, value);
  const code = normalizeCode(value);
  const displayCode = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  const credits = metadata?.credits ?? Number(fallbackCredits);

  if (!Number.isFinite(credits)) {
    throw new Error(
      `Missing course credit metadata for ${questionName}:${String(value ?? "")}`,
    );
  }

  return {
    value: String(value ?? ""),
    code,
    displayCode: metadata?.displayCode ?? displayCode,
    title: metadata?.title ?? "",
    label: metadata?.label || String(value ?? ""),
    credits,
  };
}

export function resolveChoiceCredits(choice, allowLabelFallback = true) {
  const explicit = parseOptionalNumber(
    typeof choice === "object" && choice !== null ? choice.credits : null,
  );
  if (explicit !== null) return explicit;
  if (!allowLabelFallback) return null;

  const text = typeof choice === "object" && choice !== null
    ? choice.text ?? choice.value
    : choice;
  return parseCreditsFromLabel(text);
}

export function parseCreditsFromLabel(label) {
  const match = String(label ?? "").match(
    /[([]\s*(\d+(?:[.,]\d+)?)\s*E(?:C|CTS?)\s*[)\]]\s*$/i,
  );
  return match ? parseOptionalNumber(match[1]) : null;
}

export function normalizeCode(value) {
  return value === undefined || value === null
    ? ""
    : String(value).replace(/\s+/g, "").toLowerCase();
}

export const normalizeCourseCode = normalizeCode;

export function selectedValues(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined && item !== null && item !== "")
      .map(String);
  }
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

export function selectedCodes(data, name) {
  return selectedValues(data?.[name]).map(normalizeCode);
}

export function walkElements(nodes, callback) {
  for (const node of nodes ?? []) {
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

function visitElements(nodes, callback) {
  for (const node of nodes ?? []) {
    callback(node);
    if (Array.isArray(node.elements)) visitElements(node.elements, callback);
    if (Array.isArray(node.templateElements)) {
      visitElements(node.templateElements, callback);
    }
  }
}

function stripCourseCodeAndCredits(label, displayCode) {
  let text = String(label ?? "").trim();
  if (!text) return "";

  if (displayCode) {
    const escapedCode = displayCode.replace(/[.*+?^()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^${escapedCode}\\s*[-:]?\\s*`, "i"), "");
  }

  return text
    .replace(/\s*[([]\s*\d+(?:[.,]\d+)?\s*E(?:C|CTS?)\s*[)\]]\s*$/i, "")
    .trim();
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

function normalizeChoice(choice) {
  if (typeof choice === "string" || typeof choice === "number") {
    return { value: String(choice), text: String(choice) };
  }
  const value = choice?.value ?? choice?.text ?? "";
  const text = choice?.text ?? choice?.value ?? "";
  return { value: String(value), text: String(text) };
}
