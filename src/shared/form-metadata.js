// Reads programme headings and academic-year metadata from standard SurveyJS questions.
import {
  createChoiceLookup,
  defaultQuestionValue,
} from "./course-utils.js";

export const PROGRAMME_METADATA_QUESTIONS = Object.freeze({
  academicYear: "programme_academic_year",
  headerKicker: "programme_header_kicker",
});

export function readProgrammeFormMetadata(surveySource) {
  const lookup = createChoiceLookup(surveySource);
  const summaryTitle = String(
    surveySource?.title ?? "Form summary",
  ).trim();
  const pageTitle = summaryTitle
    .replace(/^Form\s+\d+:\s*/i, "")
    .trim();
  const academicYear = String(defaultQuestionValue(
    lookup,
    PROGRAMME_METADATA_QUESTIONS.academicYear,
  )).trim();
  const headerKicker = String(defaultQuestionValue(
    lookup,
    PROGRAMME_METADATA_QUESTIONS.headerKicker,
    pageTitle,
  )).trim();
  const reportingPageTitle = String(
    surveySource?.pages?.find(({ name }) => name === "reporting")?.title
      ?? "Review and print",
  ).trim();

  return Object.freeze({
    academicYear,
    headerKicker,
    pageTitle,
    reportingPageTitle,
    summaryEyebrow: [pageTitle, academicYear].filter(Boolean).join(" "),
    summaryTitle,
  });
}

export function programmeFormLabels(surveySource) {
  const metadata = readProgrammeFormMetadata(surveySource);
  return Object.freeze({
    pageTitle: metadata.pageTitle,
    kicker: metadata.headerKicker,
    heading: "Program of Examinations",
    year: metadata.academicYear,
    ariaLabel: `${metadata.pageTitle} form`,
    summaryEyebrow: metadata.summaryEyebrow,
    summaryTitle: metadata.summaryTitle,
    reportingPageTitle: metadata.reportingPageTitle,
  });
}
