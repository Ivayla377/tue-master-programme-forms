import { CSE_FOCUS_AREAS, CSE_GRADUATION_GROUPS } from "./calculator.js";
import { formatCredits, isTrue } from "../../shared/credit-utils.js";
import { renderEctsPanel as renderSharedEctsPanel } from "../../shared/summary-layout.js";

const SUBTOTAL_ROWS = [
  ["foundational", "Foundational courses"],
  ["extra", "Extra courses"],
  ["specializationCourses", "Specialization courses"],
  ["internship", "Internship"],
  ["specialization", "Specialization total"],
  ["freeElectives", "Free elective courses"],
  ["homologation", "Homologation courses"],
  ["freeSpace", "Free elective space total"],
  ["seminar", "Seminar"],
  ["graduation", "Graduation project"],
  ["total", "Total credits"],
];

export function renderCseEctsPanel(report) {
  return renderSharedEctsPanel(report, SUBTOTAL_ROWS);
}

export function renderCseSummary(report, data, _choiceLookup, labels = {}) {
  const personalInfo = data.personal_info ?? {};
  const summaryEyebrow = labels.summaryEyebrow ?? "CSE Program of Examinations";
  const summaryTitle = labels.summaryTitle ?? "Form 1: CSE Program of Examinations";
  const generatedOn = formatCurrentDate();
const focusArea = focusLabel(report.selected.extraFocus);
  const hasFreeElectives = report.selected.freeRows.length > 0;
  const hasHomologationCourses = report.selected.homologationRows.length > 0;
  const hasFreeSpaceCourses = hasFreeElectives || hasHomologationCourses;

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
          ["Month and year of enrollment", personalInfo.enrollment],
          ["Intended graduation group", graduationGroupLabel(data.graduation_group)],
          ["Representative research cluster", data.research_cluster],
          ["Change to previous program", yesNo(data.previous)],
        ])}
      </section>

      <section class="summary-section">
        <h3>Foundational courses</h3>
        ${renderReportTable(
          ["Area", "Course code", "Course title", "Credits"],
          CSE_FOCUS_AREAS.flatMap((area) => {
            const course = report.selected.foundationAssignment.get(area.value);
            return course
              ? [{ cells: [area.label, courseCode(course), courseTitle(course), formatCredits(course.credits)] }]
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
            cells: [courseCode(course), courseTitle(course), formatCredits(course.credits)],
          })),
        )}
      </section>

      <section class="summary-section">
        <h3>Specialization electives</h3>
        ${renderReportTable(
          ["Course code", "Course title", "Credits"],
          report.selected.specializationCourses.map((course) => ({
            cells: [courseCode(course), courseTitle(course), formatCredits(course.credits)],
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
                  formatCredits(report.selected.internship.credits),
                ],
              }],
            )
          : ""}
      </section>

      <section class="summary-section">
        <h3>Free electives and homologation</h3>
        ${renderReportTable(["Type", "Course code", "Course title", "Credits"], [
          ...report.selected.freeRows.map((row) => ({
            cells: [
              "Free elective",
              row.code,
              row.name,
              row.validCredits ? formatCredits(row.credits) : "Not counted",
            ],
          })),
          ...report.selected.homologationRows.map((row) => ({
            cells: [
              "Homologation",
              row.code,
              row.name,
              row.validCredits ? formatCredits(row.credits) : "Not counted",
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
                  formatCredits(report.selected.seminar.credits),
                ],
              }]
            : []),
          ...report.selected.graduationCourses.map((course) => ({
            cells: [
              "Graduation project",
              courseCode(course),
              courseTitle(course),
              formatCredits(course.credits),
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
        ${SUBTOTAL_ROWS.map(
          ([key, label]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(formatCredits(report.subtotals[key]))}</td></tr>`,
        ).join("")}
      </tbody>
    </table>
  `;
}

function renderDetailsTable(rows) {
  return `
    <table class="summary-table summary-table--details">
      <tbody>
        ${rows.map(
          ([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${formatText(value)}</td></tr>`,
        ).join("")}
      </tbody>
    </table>
  `;
}

function renderReportTable(headers, rows, emptyText = "None selected.") {
  if (!rows.length) return `<p class="summary-footnote">${escapeHtml(emptyText)}</p>`;
  return `
    <table class="summary-table summary-table--report ${reportTableClass(headers)}">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map(
          (row) => `<tr${row.className ? ` class="${escapeHtml(row.className)}"` : ""}>${row.cells.map((cell) => `<td>${formatReportCell(cell)}</td>`).join("")}</tr>`,
        ).join("")}
      </tbody>
    </table>
  `;
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function graduationGroupLabel(value) {
  return CSE_GRADUATION_GROUPS.find((group) => group.value === value)?.label ?? value ?? "";
}

function focusLabel(value) {
  return CSE_FOCUS_AREAS.find((area) => area.value === value)?.label ?? "Not selected";
}

function yesNo(value) {
  if (value === undefined || value === null || value === "") return "Not answered";
  return isTrue(value) ? "Yes" : "No";
}

function formatText(value) {
  if (value === undefined || value === null || value === "") {
    return '<span class="muted">Not answered</span>';
  }
  return escapeHtml(String(value)).replace(/\n/g, "<br>");
}

function formatReportCell(value) {
  if (value === undefined || value === null || value === "") return "";
  return formatText(value);
}

function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
