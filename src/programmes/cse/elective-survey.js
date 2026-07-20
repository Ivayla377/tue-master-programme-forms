import {
  removeAllocatedCourseFromSources,
  synchronizeAllocatedCourseRows,
} from "../../shared/elective-allocation.js";

export const CSE_EXCESS_ELECTIVES_QUESTION = "specialization_excess_free_electives";

const SPECIALIZATION_SOURCE_QUESTIONS = [
  "specialization_algorithms",
  "specialization_architectures",
  "specialization_software",
  "specialization_additional",
  "specialization_courses",
];

export function synchronizeCseElectiveRows(survey, report) {
  return synchronizeAllocatedCourseRows(
    survey,
    CSE_EXCESS_ELECTIVES_QUESTION,
    report.selected.excessSpecializationCourses,
  );
}

export function handleCseElectiveRowRemoving(survey, options) {
  return removeAllocatedCourseFromSources({
    survey,
    questionName: options?.question?.name,
    matrixQuestionName: CSE_EXCESS_ELECTIVES_QUESTION,
    removedCourse: options?.row?.value,
    sourceQuestionNames: SPECIALIZATION_SOURCE_QUESTIONS,
    normalizeCode,
  });
}

function normalizeCode(value) {
  return value === undefined || value === null
    ? ""
    : String(value).replace(/\s+/g, "").toLowerCase();
}
