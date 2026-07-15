import { formatCredits, isTrue } from "../../shared/credit-utils.js";
import { renderEctsPanel as renderSharedEctsPanel } from "../../shared/summary-layout.js";

const SUBTOTAL_ROWS = [
  ["core", "Core/core electives"],
  ["specializationMajor", "Specialization electives major"],
  ["specializationMinor", "Specialization electives minor"],
  ["specializationTotal", "Specialization total"],
  ["seminar", "Seminar"],
  ["freeRows", "Free elective rows"],
  ["homologation", "Homologation"],
  ["internship", "Internship"],
  ["freeSpace", "Free elective space total"],
  ["graduation", "Graduation project"],
  ["total", "Total credits"],
];

export function renderEctsPanel(report) {
  return renderSharedEctsPanel(report, SUBTOTAL_ROWS);
}
export function renderSummary(report, data, choiceLookup, labels = {}) {
  const personalInfo = data.personal_info ?? {};
  const matched = isTrue(data.matched);
const hasHomologation = isTrue(data.homologation);
  const hasFreeElectives = report.selected.freeRows.length > 0;
  const hasHomologationCourses = report.selected.homologationCourses.length > 0;
  const hasFreeSpaceCourses = hasFreeElectives || hasHomologationCourses;
  const graduationGroup = matched
    ? choiceLookup.getLabel("grad_group", data.grad_group)
    : data.mentor;

  const summaryEyebrow = labels.summaryEyebrow ?? "Program of Examinations";

  const summaryTitle = labels.summaryTitle ?? "Form summary";
  const generatedOn = formatCurrentDate();

  return `
    <article class="summary-report summary-report--dsai">
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
        <h3>Student Information</h3>
        ${renderDetailsTable([
          ["Name", personalInfo.name],
          ["Student ID", personalInfo.id],
          ["Enrollment date", personalInfo.enrollment],
          ["Matched to graduation group", yesNo(data.matched)],
          [matched ? "Graduation group" : "Mentor", graduationGroup],
          ["Change of approved program", yesNo(data.previous)],
        ])}
      </section>

      <section class="summary-section">
        <h3>Core and Core Electives</h3>
        ${renderReportTable(["Category", "Course", "Credits"], [
          ...renderCourseRows("Mandatory core", report.selected.coreCourses),
          ...renderCourseRows("Core elective", report.selected.coreElectiveCourse ? [report.selected.coreElectiveCourse] : []),
        ])}
      </section>

      <section class="summary-section">
        <h3>Specialization Electives</h3>
        ${renderReportTable(["Type", "Trajectory / course", "Credits"], [
          ...renderTrajectoryRows("Major", report.selected.majorTrajectories),
          ...renderTrajectoryRows("Minor", report.selected.minorTrajectories),
        ])}
      </section>

      <section class="summary-section">
        <h3>Seminar, Free Space, and Graduation</h3>
        ${renderReportTable(["Component", "Selection", "Value / credits"], [
          ...renderCourseRows("Seminar", report.selected.seminar ? [report.selected.seminar] : []),
          { cells: ["Internship", "Included", report.selected.internship.selected ? "Yes" : "No"] },
          ...(report.selected.internship.selected
            ? [
                { cells: ["Internship", "Supervisor", report.selected.internship.supervisor] },
              ]
            : []),
          ...renderCourseRows("Graduation project", report.selected.graduationCourses),
        ])}
      </section>

      <section class="summary-section">
        <h3>Free Electives and Homologation</h3>
        ${renderReportTable(["Area", "Selection", "Value / credits"], [
          ...renderFreeRows(report.selected.freeRows),
          ...(hasHomologationCourses
            ? renderCourseRows("Homologation course", report.selected.homologationCourses)
            : []),
        ], "None selected")}
        ${hasFreeElectives
          ? `<p class="summary-footnote">External free electives: ${yesNo(data.external_courses)}</p>`
          : ""}
        ${hasFreeSpaceCourses && !hasHomologationCourses
          ? '<p class="summary-footnote">Homologation: None selected</p>'
          : ""}
      </section>
      <section class="summary-section">
        <h3>Motivations and Notes</h3>
        ${renderNotes([
          ["Changes to previous program", data.changes],
          ["Core course explanation", data.core_deselected],
          ["Unassigned homologation motivation", data.unassigned_motivation],
          ["External free elective justification", data.external_justification],
          ["Seminar mismatch explanation", data.mismatch],
        ])}
      </section>

      <section class="summary-section">
        <h3>ECTS Subtotals</h3>
        ${renderSubtotalsTable(report)}
      </section>

      <section class="summary-section">
        <h3>Validation Results</h3>
        <ul class="validation-list">
          ${report.validations.map(renderValidationItem).join("")}
        </ul>
      </section>

    </article>
  `;
}

function renderSubtotal(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(formatCredits(value))}</dd>
    </div>
  `;
}

function renderSubtotalsTable(report) {
  return `
    <table class="summary-table summary-table--subtotals">
      <tbody>
        ${SUBTOTAL_ROWS.map(
          ([key, label]) => `
            <tr>
              <th scope="row">${escapeHtml(label)}</th>
              <td>${escapeHtml(formatCredits(report.subtotals[key]))}</td>
            </tr>
          `,
        ).join("")}
      </tbody>
    </table>
  `;
}

function renderDetailsTable(rows) {
  return `
    <table class="summary-table summary-table--details">
      <tbody>
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <th scope="row">${escapeHtml(label)}</th>
                <td>${formatText(value)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderReportTable(headers, rows, emptyText = "None selected.") {
  if (!rows.length) return `<p class="summary-footnote">${escapeHtml(emptyText)}</p>`;

  return `
    <table class="summary-table summary-table--report">
      <thead>
        <tr>
          ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr${row.className ? ` class="${escapeHtml(row.className)}"` : ""}>
                ${row.cells.map((cell) => `<td>${formatReportCell(cell)}</td>`).join("")}
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}
function renderCourseRows(category, courses) {
  return courses.map((course) => ({
    cells: [category, displayCourseLabel(course), formatCredits(course.credits)],
  }));
}

function renderTrajectoryRows(type, trajectories) {
  return trajectories.flatMap((trajectory) => [
    {
      className: "summary-row--group",
      cells: [type, trajectory.label, formatCredits(trajectory.credits)],
    },
    ...trajectory.courses.map((course) => ({
      cells: ["", displayCourseLabel(course), formatCredits(course.credits)],
    })),
  ]);
}

function renderFreeRows(rows) {
  return rows.map((row) => ({
    cells: [
      "Free elective",
      [row.code, row.name].filter(Boolean).join(" "),
      row.validCredits ? formatCredits(row.credits) : "Not counted",
    ],
  }));
}

function renderNotes(notes) {
  const filledNotes = notes.filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!filledNotes.length) return '<p class="empty-state">No additional notes entered.</p>';

  return filledNotes
    .map(
      ([label, value]) => `
        <div class="note-block">
          <h4>${escapeHtml(label)}</h4>
          <p>${formatText(value)}</p>
        </div>
      `,
    )
    .join("");
}

function renderValidationItem(validation) {
  return `
    <li class="validation-item validation-item--${escapeHtml(validation.status)}">
      <strong>${escapeHtml(validation.label)}</strong>
      <span>${escapeHtml(validation.detail)}</span>
    </li>
  `;
}

function displayCourseLabel(course) {
  return String(course.label).replace(/\s*\[(?:\d+(?:\.\d+)?)\s*E(?:C|CTS)\]\s*$/i, "");
}

function yesNo(value) {
  if (value === undefined || value === null || value === "") return "Not answered";
  return isTrue(value) ? "Yes" : "No";
}

function formatText(value) {
  if (value === undefined || value === null || value === "") return '<span class="muted">Not answered</span>';
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
