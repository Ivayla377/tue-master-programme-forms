/**
 * Allocates whole courses to a credit requirement in selection order.
 *
 * The programme elective lists currently contain 5 ECTS courses and their
 * targets are multiples of 5, so a course never needs to be split between
 * sections. Keeping this helper course-based also makes the report tables and
 * removal behavior unambiguous for students.
 */
export function allocateCoursesToTarget(courses, targetCredits) {
  const required = [];
  const excess = [];
  let allocatedCredits = 0;

  for (const course of courses) {
    const credits = Number(course?.credits) || 0;
    if (allocatedCredits + credits <= targetCredits) {
      required.push(course);
      allocatedCredits += credits;
    } else {
      excess.push(course);
    }
  }

  return {
    required,
    excess,
    requiredCredits: allocatedCredits,
    excessCredits: sumCourseCredits(excess),
  };
}

export function synchronizeAllocatedCourseRows(survey, questionName, courses) {
  if (!canReadAndWriteSurvey(survey)) return false;

  const nextRows = courses.map(toAllocatedCourseRow);
  const currentRows = survey.getValue(questionName);
  if (JSON.stringify(currentRows ?? []) === JSON.stringify(nextRows)) return false;

  survey.setValue(questionName, nextRows);
  return true;
}

/**
 * Mirrors a SurveyJS dynamic-matrix row removal back to the choice questions
 * that own the course. This runs from onMatrixRowRemoving, before SurveyJS
 * publishes its intermediate matrix value, so the calculated row cannot be
 * restored while the removal is still in progress.
 */
export function removeAllocatedCourseFromSources({
  survey,
  questionName,
  matrixQuestionName,
  removedCourse,
  sourceQuestionNames,
  normalizeCode,
}) {
  if (
    questionName !== matrixQuestionName
    || !canReadAndWriteSurvey(survey)
  ) {
    return false;
  }

  const removedCode = normalizeCode(
    removedCourse?.displayCode
      ?? removedCourse?.code
      ?? removedCourse?.value,
  );
  if (!removedCode) return false;

  let changed = false;
  for (const sourceQuestionName of sourceQuestionNames) {
    const currentValues = asArray(survey.getValue(sourceQuestionName));
    const nextValues = currentValues.filter((value) =>
      normalizeCode(choiceValue(value)) !== removedCode);

    if (nextValues.length !== currentValues.length) {
      survey.setValue(sourceQuestionName, nextValues);
      changed = true;
    }
  }

  return changed;
}

function toAllocatedCourseRow(course) {
  const code = String(
    course?.displayCode ?? course?.code ?? course?.value ?? "",
  ).trim().toUpperCase();

  return {
    code,
    title: courseTitle(course, code),
    credits: Number(course?.credits) || 0,
  };
}

function courseTitle(course, code) {
  const explicitTitle = String(course?.title ?? course?.name ?? "").trim();
  if (explicitTitle) return explicitTitle;

  return String(course?.label ?? "")
    .replace(new RegExp(`^${escapeRegExp(code)}\\s+`, "i"), "")
    .replace(/\s*\((?:\d+(?:\.\d+)?)\s*ECTS\)\s*$/i, "")
    .trim()
    || "Course title not available";
}

function sumCourseCredits(courses) {
  return courses.reduce(
    (total, course) => total + (Number(course?.credits) || 0),
    0,
  );
}

function choiceValue(value) {
  if (value && typeof value === "object") {
    return value.value ?? value.code ?? "";
  }
  return value;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function canReadAndWriteSurvey(survey) {
  return survey
    && typeof survey.getValue === "function"
    && typeof survey.setValue === "function";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
