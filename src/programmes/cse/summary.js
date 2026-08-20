// Renders CSE credit panels and printable programme summaries.
import { CSE_FOCUS_AREAS } from "./calculator.js";
import { formatCredits, isTrue } from "../../shared/credit-utils.js";
import {
  escapeHtml,
  escapeRegExp,
  formatCurrentDate,
  formatMonthYear,
  formatText,
  graduationClusterDetails,
  renderDetailsTable,
  renderEctsPanel as renderSharedEctsPanel,
  renderReportTable as renderSharedReportTable,
} from "../../shared/summary-rendering.js";

const PANEL_SUBTOTAL_ROWS = [
  ["foundational", "Foundational courses"],
  ["extra", "Extra courses"],
  ["specializationCourses", "Specialization courses (required)"],
  ["internship", "Internship"],
  ["specialization", "Specialization total"],
  ["manualFreeElectives", "Entered free electives"],
  ["homologation", "Homologation courses"],
  ["freeSpace", "Free elective space total"],
  ["seminar", "Seminar"],
  ["graduation", "Graduation project"],
  ["total", "Total credits"],
];

const SUMMARY_SUBTOTAL_ROWS = [
  ...PANEL_SUBTOTAL_ROWS.slice(0, 6),
  ["specializationExcess", "Additional specialization in free space"],
  ...PANEL_SUBTOTAL_ROWS.slice(6),
];

export function renderCseEctsPanel(report) {
  return renderSharedEctsPanel(report, PANEL_SUBTOTAL_ROWS);
}

export function renderCseSummary(report, data, choiceLookup, labels = {}) {
  const personalInfo = data.personal_info ?? {};
  const summaryEyebrow = labels.summaryEyebrow ?? "CSE Program of Examinations";
  const summaryTitle = labels.summaryTitle ?? "Form 1: CSE Program of Examinations";
  const generatedOn = formatCurrentDate();
  const focusAreas = choiceLookup?.cseConfig?.focusAreas
    ?? CSE_FOCUS_AREAS;
  const focusArea = focusLabel(report.selected.extraFocus, choiceLookup);
  const hasFreeElectives = report.selected.freeRows.length > 0;
  const hasHomologationCourses = report.selected.homologationRows.length > 0;
  const hasExcessSpecializationCourses = report.selected.excessSpecializationCourses.length > 0;
  const hasFreeSpaceCourses = hasFreeElectives
    || hasHomologationCourses
    || hasExcessSpecializationCourses;

  return `
    <article class="summary-report">
      <header class="summary-header">
        <div>
          <p class="eyebrow">${escapeHtml(summaryEyebrow)}</p>
          <h2>${escapeHtml(summaryTitle)}</h2>
          <p class="summary-generated-on">Generated on ${escapeHtml(generatedOn)}</p>
        </div>
        <div class="summary-actions">
          <button type="button" class="print-button" data-print-report>Print / Save as PDF</button>
        </div>
      </header>

      <section class="summary-section">
        <h3>General information</h3>
        ${renderDetailsTable([
          ["Name", personalInfo.name],
          ["Student ID", personalInfo.id],
          ["Month and year of enrollment", formatMonthYear(personalInfo.enrollment)],
          ...graduationClusterDetails(data, choiceLookup),
          ["Change to previous program", yesNo(data.previous)],
        ])}
      </section>

      <section class="summary-section">
        <h3>Foundational courses</h3>
        ${renderReportTable(
          ["Area", "Course code", "Course title", "Credits"],
          focusAreas.flatMap((area) => {
            const course = report.selected.foundationAssignment.get(area.value);
            return course
              ? [{ cells: [area.label, courseCode(course), courseTitle(course), formatCourseCredits(course)] }]
              : [];
          }),
        )}
      </section>

      <section class="summary-section">
        <h3>Focus area and extra courses</h3>
        <p class="summary-inline-detail"><strong>Selected focus area:</strong> ${escapeHtml(focusArea)} (${escapeHtml(formatCredits(report.subtotals.extra))})</p>
        ${renderReportTable(
          ["Course code", "Course title", "Credits"],
          report.selected.extraCourses.map((course) => ({
            cells: [courseCode(course), courseTitle(course), formatCourseCredits(course)],
          })),
        )}
      </section>

      <section class="summary-section">
        <h3>Specialization electives</h3>
        ${renderReportTable(
          ["Course code", "Course title", "Credits"],
          report.selected.specializationCourses.map((course) => ({
            cells: [courseCode(course), courseTitle(course), formatCourseCredits(course)],
          })),
        )}
      </section>

      <section class="summary-section">
        <h3>Internship</h3>
        ${renderDetailsTable([
          ["Included", report.selected.internship.selected ? "Yes" : "No"],
          ["Supervisor", report.selected.internship.supervisor],
        ])}
        ${report.selected.internship.course
          ? renderReportTable(
              ["Course code", "Course title", "Credits"],
              [{
                cells: [
                  courseCode(report.selected.internship.course),
                  courseTitle(report.selected.internship.course),
                  formatCourseCredits(report.selected.internship.course),
                ],
              }],
            )
          : ""}
      </section>

      <section class="summary-section">
        <h3>Free electives and homologation</h3>
        ${renderDetailsTable([
          ["Homologation included", yesNo(data.homologation)],
          ...(isTrue(data.homologation)
            ? [["Self-chosen homologation included", yesNo(data.self_chosen_homologation)]]
            : []),
        ])}
        ${renderReportTable(["Type", "Course code", "Course title", "Credits"], [
          ...report.selected.excessSpecializationCourses.map((course) => ({
            cells: [
              "Additional specialization elective",
              courseCode(course),
              courseTitle(course),
              formatCourseCredits(course),
            ],
          })),
          ...report.selected.freeRows.map((row) => ({
            cells: [
              "Free elective",
              row.code,
              row.name,
              row.validCredits && row.counted !== false ? formatCredits(row.credits) : "Not counted",
            ],
          })),
          ...report.selected.homologationRows.map((row) => ({
            cells: [
              "Homologation",
              row.code,
              row.name,
              row.validCredits && row.counted !== false ? formatCredits(row.credits) : "Not counted",
            ],
          })),
        ], "None selected")}
        ${hasFreeElectives
          ? `<p class="summary-footnote">External free electives: ${yesNo(data.external_courses)}</p>`
          : ""}
        ${hasFreeSpaceCourses && !hasHomologationCourses
          ? '<p class="summary-footnote">Homologation: None selected</p>'
          : ""}
      </section>
      <section class="summary-section">
        <h3>Seminar and graduation project</h3>
        ${renderReportTable(["Component", "Course code", "Course title", "Credits"], [
          ...(report.selected.seminar
            ? [{
                cells: [
                  "Seminar",
                  courseCode(report.selected.seminar),
                  courseTitle(report.selected.seminar),
                  formatCourseCredits(report.selected.seminar),
                ],
              }]
            : []),
          ...report.selected.graduationCourses.map((course) => ({
            cells: [
              "Graduation project",
              courseCode(course),
              courseTitle(course),
              formatCourseCredits(course),
            ],
          })),
        ])}
      </section>

      <section class="summary-section">
        <h3>Notes for the examination committee</h3>
        ${renderNotes([
          ["Changes to previous program", data.changes],
          ["External free-elective links and justification", data.external_justification],
          ["Self-chosen homologation motivation", data.homologation_motivation],
          ["Additional committee notes", data.committee_notes],
        ])}
      </section>

      <section class="summary-section">
        <h3>ECTS subtotals</h3>
        ${renderSubtotalsTable(report)}
      </section>

      <section class="summary-section">
        <h3>Validation results</h3>
        <ul class="validation-list">
          ${report.validations.map(renderValidationItem).join("")}
        </ul>
      </section>

    </article>
  `;
}

function renderSubtotalsTable(report) {
  return `
    <table class="summary-table summary-table--subtotals">
      <tbody>
        ${visibleSummarySubtotalRows(report).map(
          ([key, label]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(formatCredits(report.subtotals[key]))}</td></tr>`,
        ).join("")}
      </tbody>
    </table>
  `;
}

function visibleSummarySubtotalRows(report) {
  return SUMMARY_SUBTOTAL_ROWS.filter(
    ([key]) => key !== "specializationExcess" || report.subtotals.specializationExcess > 0,
  );
}

function renderReportTable(headers, rows, emptyText = "None selected.") {
  return renderSharedReportTable(
    headers,
    rows,
    emptyText,
    reportTableClass(headers),
  );
}
function reportTableClass(headers) {
  if (!headers.includes("Course code")) return "";
  if (headers.length === 3) return "summary-table--course-data summary-table--three-course";
  if (headers[0] === "Area") return "summary-table--course-data summary-table--foundational";
  if (headers[0] === "Type") return "summary-table--course-data summary-table--electives";
  if (headers[0] === "Component") return "summary-table--course-data summary-table--completion";
  return "summary-table--course-data";
}

function renderNotes(notes) {
  const filledNotes = notes.filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== "",
  );
  if (!filledNotes.length) return '<p class="empty-state">No additional notes entered.</p>';
  return filledNotes.map(
    ([label, value]) => `<div class="note-block"><h4>${escapeHtml(label)}</h4><p>${formatText(value)}</p></div>`,
  ).join("");
}

function renderValidationItem(validation) {
  return `<li class="validation-item validation-item--${escapeHtml(validation.status)}"><strong>${escapeHtml(validation.label)}</strong><span>${escapeHtml(validation.detail)}</span></li>`;
}

function formatCourseCredits(course) {
  return course?.counted === false ? "Not counted" : formatCredits(course?.credits ?? 0);
}

function courseCode(course) {
  return String(course?.code ?? course?.value ?? "").trim().toUpperCase();
}

function courseTitle(course) {
  const label = String(course?.label ?? "")
    .replace(/\s*\((?:\d+(?:\.\d+)?)\s*ECTS\)\s*$/i, "")
    .trim();
  const code = courseCode(course);
  const title = code
    ? label.replace(new RegExp(`^${escapeRegExp(code)}\\s+`, "i"), "").trim()
    : label;

  return title || "Course title not available";
}

function focusLabel(value, choiceLookup) {
  const configured = choiceLookup?.getLabel?.("extra_focus_area", value);
  if (configured && configured !== value) return configured;
  return CSE_FOCUS_AREAS.find((area) => area.value === value)?.label ?? "Not selected";
}

function yesNo(value) {
  if (value === undefined || value === null || value === "") return "Not answered";
  return isTrue(value) ? "Yes" : "No";
}
