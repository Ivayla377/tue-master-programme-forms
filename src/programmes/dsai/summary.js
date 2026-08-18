// Renders DS&AI credit panels and printable programme summaries.
import { formatCredits, isTrue } from "../../shared/credit-utils.js";
import {
  escapeHtml,
  formatCurrentDate,
  formatText,
  graduationClusterDetails,
  renderDetailsTable,
  renderEctsPanel as renderSharedEctsPanel,
  renderReportTable,
} from "../../shared/summary-rendering.js";

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

export function renderTrajectoryClassification(report) {
  const classifications = report.selected.trajectoryClassifications ?? [];

  return `
    <section class="trajectory-classification" aria-live="polite">
      <h4>Selection overview</h4>
      <p>Review how your selected trajectories are classified below.</p>
      ${classifications.length > 0
        ? `<div class="trajectory-classification__table">
            <ul aria-label="Current trajectory status">
              ${classifications.map(renderTrajectoryClassificationItem).join("")}
            </ul>
          </div>`
        : '<p class="trajectory-classification__empty">Select specialization electives to see the overview.</p>'}
    </section>
  `;
}

export function renderSummary(report, data, choiceLookup, labels = {}) {
  const personalInfo = data.personal_info ?? {};
  const hasFreeElectives = report.selected.freeRows.length > 0;
  const hasHomologationCourses = report.selected.homologationCourses.length > 0;
  const hasFreeSpaceCourses = hasFreeElectives || hasHomologationCourses;

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
          ...graduationClusterDetails(data, choiceLookup),
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
        <p class="summary-inline-detail"><strong>Trajectory classification:</strong> ${escapeHtml(
          printableClassificationMessage(report.selected.majorClassificationState),
        )}</p>
        ${renderReportTable(["Type", "Trajectory / course", "Credits"], [
          ...renderClassifiedTrajectoryRows(report.selected),
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

function renderCourseRows(category, courses) {
  return courses.map((course) => ({
    cells: [category, displayCourseLabel(course), formatCourseCredits(course)],
  }));
}

function renderTrajectoryRows(type, trajectories) {
  return trajectories.flatMap((trajectory) => [
    {
      className: "summary-row--group",
      cells: [type, trajectory.label, formatCredits(trajectory.credits)],
    },
    ...trajectory.courses.map((course) => ({
      cells: ["", displayCourseLabel(course), formatCourseCredits(course)],
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

function formatCourseCredits(course) {
  return formatCredits(course?.credits ?? 0);
}

function renderClassifiedTrajectoryRows(selected) {
  const classifications = selected.trajectoryClassifications;
  if (!Array.isArray(classifications)) {
    return [
      ...renderTrajectoryRows("Major", selected.majorTrajectories),
      ...renderTrajectoryRows("Minor", selected.minorTrajectories),
    ];
  }
  const labels = {
    major: "Major",
    minor: "Minor",
    major_candidate: "Major candidate",
  };
  return classifications.flatMap((trajectory) =>
    renderTrajectoryRows(labels[trajectory.role] ?? "Unclassified", [trajectory]));
}

function printableClassificationMessage(state) {
  if (state === "automatic") return "Majors detected automatically.";
  if (state === "selected") return "Majors selected by the student.";
  if (state === "choice_required") return "Major selection required.";
  return "Major requirements incomplete.";
}

function renderTrajectoryClassificationItem(trajectory) {
  const labels = {
    major: "Major",
    minor: "Minor",
    major_candidate: "Eligible for major",
  };
  const role = labels[trajectory.role] ?? "Unclassified";
  return `
    <li>
      <strong>${escapeHtml(trajectory.label)}</strong>
      <span class="trajectory-classification__credits">${escapeHtml(formatCredits(trajectory.credits))}</span>
      <span class="trajectory-classification__status">${escapeHtml(role)}</span>
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
