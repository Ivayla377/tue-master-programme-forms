import {
  removeAllocatedCourseFromSources,
  synchronizeAllocatedCourseRows,
} from "../../shared/elective-allocation.js";
import { normalizeEsCode } from "./calculator.js";

export const ES_EXCESS_ELECTIVES_QUESTION = "stream_elective_excess_free_electives";

const STREAM_ELECTIVE_SOURCE_QUESTIONS = [
  "stream_electives_systems_on_chip",
  "stream_electives_embedded_software",
  "stream_electives_embedded_networking",
  "stream_electives_cyber_physical_systems",
  "systems_on_chip_electives",
  "soc_electives",
  "embedded_software_electives",
  "software_electives",
  "embedded_networking_electives",
  "networking_electives",
  "cyber_physical_systems_electives",
  "cps_electives",
  "stream_electives",
  "stream_elective_courses",
];

export function synchronizeEsElectiveRows(survey, report) {
  return synchronizeAllocatedCourseRows(
    survey,
    ES_EXCESS_ELECTIVES_QUESTION,
    report.selected.excessStreamElectiveCourses,
  );
}

export function handleEsElectiveRowRemoving(survey, options) {
  return removeAllocatedCourseFromSources({
    survey,
    questionName: options?.question?.name,
    matrixQuestionName: ES_EXCESS_ELECTIVES_QUESTION,
    removedCourse: options?.row?.value,
    sourceQuestionNames: STREAM_ELECTIVE_SOURCE_QUESTIONS,
    normalizeCode: normalizeEsCode,
  });
}
