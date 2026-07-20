import { formatCredits } from "../../shared/credit-utils.js";
import { renderEctsPanel as renderSharedEctsPanel } from "../../shared/summary-layout.js";

const PANEL_SUBTOTAL_ROWS = [
  ["professionalPortfolio", "Professional Portfolio"],
  ["finalProject", "Final Project"],
  ["coreElectives", "Core electives"],
  ["specializationElectives", "Specialization electives"],
  ["coreAndSpecialization", "Core + specialization"],
  ["freeElectiveSpace", "Free electives"],
  ["total", "Total credits"],
];

const SUMMARY_SUBTOTAL_ROWS = [
  ["professionalPortfolio", "Professional Portfolio"],
  ["finalProject", "Final Project"],
  ["coreElectives", "Core electives"],
  ["listedSpecialization", "Listed specialization electives"],
  ["mastermathSpecialization", "Mastermath / approved specialization"],
  ["coreAndSpecialization", "Core and specialization subtotal"],
  ["officialFreeElectives", "Listed free electives"],
  ["internship", "Internship"],
  ["homologation", "Homologation"],
  ["freeElectiveRows", "Other free electives"],
  ["total", "Overall programme total"],
];

const SIDEBAR_ALWAYS_VISIBLE = new Set([
  "Core electives",
  "Core and specialization total",
  "Total credits",
]);

const SIDEBAR_EXCEPTION_LABELS = new Set([
  "Core-elective eligibility",
  "Specialization-elective eligibility",
  "Official free-elective eligibility",
  "Manual course rows",
  "Double counting",
  "Homologation credits",
]);

export function renderIamEctsPanel(report) {
  const validations = selectIamSidebarValidations(report.validations);
  return renderSharedEctsPanel(
    {
      ...report,
      validations,
      hasWarnings: validations.some((validation) => validation.status === "warning"),
    },
    PANEL_SUBTOTAL_ROWS,
  );
}

export function selectIamSidebarValidations(validations) {
  return asArray(validations).filter((validation) => {
    const label = String(asRecord(validation).label ?? "");
    if (SIDEBAR_ALWAYS_VISIBLE.has(label)) return true;
    if (!SIDEBAR_EXCEPTION_LABELS.has(label)) return false;
    return validationStatus(validation) !== "success";
  });
}

export function renderIamSummary(report, data, choiceLookup, labels = {}) {
  const safeReport = normalizeReport(report);
  const safeData = asRecord(data);
  const selected = safeReport.selected;
  const personalInfo = asRecord(safeData.personal_info);
  const summaryEyebrow = labels.summaryEyebrow ?? "IAM Program of Examinations";
  const summaryTitle = labels.summaryTitle ?? "Form 1: IAM Program of Examinations";
  const generatedOn = formatCurrentDate();

  const specializationRows = [
    ...selected.specializationElectiveCourses.map((course) => typedCourseRow("Listed specialization", course)),
    ...manualRows("Mastermath / approved", selected.mastermathSpecializationRows),
    ...selected.invalidSpecializationCourses.map((course) => typedCourseRow("Not counted", course, "summary-row--not-counted")),
  ];

  const freeRows = [
    ...selected.officialFreeElectiveCourses.map((course) => ({
      cells: ["Listed free elective", courseCode(course), courseTitle(course), courseCredits(course)],
    })),
    ...manualRows("Homologation", [
      ...selected.homologationRows,
      ...selected.selfChosenHomologationRows,
    ]),
    ...manualRows("Other free elective", selected.freeElectiveRows),
  ];

  const internship = asRecord(selected.internship);
  const internshipSelected = booleanValue(coalesce(internship.selected, safeData.internship));
  const internshipCourse = internshipSelected ? internship.course : null;
  const externalActive = booleanValue(safeData.external_courses) === true;

  return `
    <article class="summary-report summary-report--iam">
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
        <h3>Student and mentor information</h3>
        ${renderDetailsTable([
          ["Name", personalInfo.name],
          ["Student ID", personalInfo.id],
          ["Enrollment", personalInfo.enrollment],
          ["Mentor", safeData.mentor],
          ["Updates a previously approved programme", yesNo(safeData.previous)],
        ])}
      </section>

      <section class="summary-section">
        <h3>Mandatory components</h3>
        ${renderCourseTable(selected.mandatoryCourses, "No mandatory components were reported.")}
      </section>

      <section class="summary-section summary-section--allow-break">
        <h3>Core electives</h3>
        <p class="summary-inline-detail"><strong>Selected:</strong> ${escapeHtml(formatCredits(safeReport.subtotals.coreElectives))} / at least ${escapeHtml(formatCredits(safeReport.rules.coreMinimum))}</p>
        ${renderCourseTable(selected.coreElectiveCourses, "No core electives selected.")}
      </section>

      <section class="summary-section summary-section--allow-break">
        <h3>Specialization electives</h3>
        <p class="summary-inline-detail"><strong>Selected:</strong> ${escapeHtml(formatCredits(safeReport.subtotals.specializationElectives))}</p>
        ${renderReportTable(
          ["Type", "Course code", "Course title", "Credits"],
          specializationRows,
          "No specialization electives selected.",
          "summary-table--course-data summary-table--completion",
        )}
      </section>

      <section class="summary-section summary-section--allow-break">
        <h3>Free electives, homologation and internship</h3>
        ${renderDetailsTable([
          ["Homologation included", yesNo(safeData.homologation)],
          ...(booleanValue(safeData.homologation) === true
            ? [["Self-chosen homologation included", yesNo(safeData.self_chosen_homologation)]]
            : []),
        ])}
        ${renderReportTable(
          ["Type", "Course code", "Course title", "Credits"],
          freeRows,
          "No free-elective, homologation or bachelor rows entered.",
          "summary-table--course-data summary-table--completion",
        )}
      </section>

      <section class="summary-section">
        <h3>Internship</h3>
        ${renderDetailsTable([
          ["Included", yesNo(coalesce(internship.selected, safeData.internship))],
          ...(internshipSelected
            ? [
                ["Supervisor", coalesce(internship.supervisor, safeData.internship_supervisor)],
              ]
            : []),
        ])}
        ${internshipCourse ? renderCourseTable([internshipCourse], "") : ""}
      </section>

      <section class="summary-section">
        <h3>External university courses</h3>
        ${renderDetailsTable([
          ["External university courses declared", yesNo(safeData.external_courses)],
          ...(externalActive
            ? [
                ["University / institution", safeData.external_course_university],
                ["Course-description links", safeData.external_course_links],
                ["Motivation and non-overlap", safeData.external_course_motivation],
              ]
            : []),
        ])}
      </section>

      ${selected.duplicates.length > 0
        ? `<section class="summary-section summary-section--allow-break">
            <h3>Duplicate selections excluded from counting</h3>
            ${renderReportTable(
              ["Course code", "Duplicate handling"],
              selected.duplicates.map((duplicate) => ({
                cells: [courseCode(duplicate), duplicateDetail(duplicate)],
                className: "summary-row--not-counted",
              })),
              "",
              "summary-table--es-duplicates",
            )}
          </section>`
        : ""}

      <section class="summary-section">
        <h3>Changes, motivations and notes</h3>
        ${renderNotes([
          ["Changes to the previously approved programme", booleanValue(safeData.previous) === true ? safeData.changes : undefined],
          [
            "Motivation for self-chosen homologation courses",
            booleanValue(safeData.self_chosen_homologation) === true
              ? safeData.homologation_motivation
              : undefined,
          ],
          ["Additional notes for the Examination Committee", safeData.committee_notes],
        ])}
      </section>

      <section class="summary-section">
        <h3>ECTS subtotals</h3>
        ${renderSubtotalsTable(safeReport)}
      </section>

      <section class="summary-section summary-section--allow-break">
        <h3>Validation results</h3>
        ${renderValidationList(compactIamSummaryValidations(safeReport.validations), "No validation results were reported.")}
      </section>

      <section class="summary-section summary-section--committee">
        <h3>Examination Committee use</h3>
        <p class="summary-footnote">This area is intentionally left blank for committee completion.</p>
        <table class="summary-table summary-table--details summary-table--committee">
          <tbody>
            <tr><th scope="row">Approval</th><td><span class="summary-approval-line" aria-hidden="true"></span></td></tr>
            <tr><th scope="row">Date</th><td><span class="summary-approval-line" aria-hidden="true"></span></td></tr>
          </tbody>
        </table>
      </section>
    </article>
  `;
}

export function compactIamSummaryValidations(validations) {
  return asArray(validations).filter((validation) => {
    const label = String(asRecord(validation).label ?? "");
    if (validationStatus(validation) !== "success") return true;
    return [
      "Core electives",
      "Core and specialization total",
      "Total credits",
    ].includes(label);
  });
}

function normalizeReport(report) {
  const source = asRecord(report);
  const sourceSubtotals = asRecord(source.subtotals);
  const sourceSelected = asRecord(source.selected);
  const sourceRules = asRecord(source.rules);
  const validations = asArray(source.validations);
  return {
    ...source,
    rules: {
      programmeTarget: numericCredits(sourceRules.programmeTarget),
      coreMinimum: numericCredits(sourceRules.coreMinimum),
      coreMinimumCount: numericCredits(sourceRules.coreMinimumCount),
      coreSpecializationMinimum: numericCredits(sourceRules.coreSpecializationMinimum),
      homologationMaximum: numericCredits(sourceRules.homologationMaximum),
    },
    subtotals: {
      professionalPortfolio: numericCredits(sourceSubtotals.professionalPortfolio),
      finalProject: numericCredits(sourceSubtotals.finalProject),
      coreElectives: numericCredits(sourceSubtotals.coreElectives),
      listedSpecialization: numericCredits(sourceSubtotals.listedSpecialization),
      mastermathSpecialization: numericCredits(sourceSubtotals.mastermathSpecialization),
      specializationElectives: numericCredits(sourceSubtotals.specializationElectives),
      coreAndSpecialization: numericCredits(sourceSubtotals.coreAndSpecialization),
      officialFreeElectives: numericCredits(sourceSubtotals.officialFreeElectives),
      internship: numericCredits(sourceSubtotals.internship),
      assignedHomologation: numericCredits(sourceSubtotals.assignedHomologation),
      selfChosenHomologation: numericCredits(sourceSubtotals.selfChosenHomologation),
      homologation: numericCredits(sourceSubtotals.homologation),
      freeElectiveRows: numericCredits(sourceSubtotals.freeElectiveRows),
      freeElectiveSpace: numericCredits(sourceSubtotals.freeElectiveSpace),
      total: numericCredits(sourceSubtotals.total),
    },
    selected: {
      mandatoryCourses: asArray(sourceSelected.mandatoryCourses),
      coreElectiveCourses: asArray(sourceSelected.coreElectiveCourses),
      specializationElectiveCourses: asArray(sourceSelected.specializationElectiveCourses),
      invalidSpecializationCourses: asArray(sourceSelected.invalidSpecializationCourses),
      mastermathSpecializationRows: asArray(sourceSelected.mastermathSpecializationRows),
      officialFreeElectiveCourses: asArray(sourceSelected.officialFreeElectiveCourses),
      internship: asRecord(sourceSelected.internship),
      homologationRows: asArray(sourceSelected.homologationRows),
      selfChosenHomologationRows: asArray(sourceSelected.selfChosenHomologationRows),
      freeElectiveRows: asArray(sourceSelected.freeElectiveRows),
      duplicates: asArray(sourceSelected.duplicates),
    },
    validations,
  };
}

function renderSubtotalsTable(report) {
  return `
    <table class="summary-table summary-table--subtotals">
      <tbody>
        ${SUMMARY_SUBTOTAL_ROWS.map(([key, label]) => `
          <tr${key === "total" ? ' class="summary-row--group"' : ""}>
            <th scope="row">${escapeHtml(label)}</th>
            <td>${escapeHtml(formatCredits(report.subtotals[key]))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderDetailsTable(rows) {
  return `
    <table class="summary-table summary-table--details">
      <tbody>
        ${rows.map(([label, value]) => `
          <tr><th scope="row">${escapeHtml(label)}</th><td>${formatText(value)}</td></tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderCourseTable(courses, emptyText, modifier = "summary-table--three-course") {
  return renderReportTable(
    ["Course code", "Course title", "Credits"],
    asArray(courses).map((course) => courseRow(course)),
    emptyText,
    `summary-table--course-data ${modifier}`,
  );
}

function renderReportTable(headers, rows, emptyText = "None selected.", modifier = "") {
  if (!rows.length) return `<p class="summary-footnote">${escapeHtml(emptyText)}</p>`;
  return `
    <table class="summary-table summary-table--report${modifier ? ` ${modifier}` : ""}">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr${row.className ? ` class="${escapeHtml(row.className)}"` : ""}>
            ${row.cells.map((cell) => `<td>${formatReportCell(cell)}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function courseRow(course, className = "") {
  return {
    cells: [courseCode(course), courseTitle(course), courseCredits(course)],
    className,
  };
}

function typedCourseRow(type, course, className = "") {
  return {
    cells: [type, courseCode(course), courseTitle(course), courseCredits(course)],
    className,
  };
}

function manualRows(type, rows, includeLink = false) {
  return asArray(rows).map((row) => ({
    cells: [
      type,
      courseCode(row),
      includeLink && hasText(asRecord(row).masterCourse)
        ? `${courseTitle(row, "Not entered")} (prepares for ${displayText(asRecord(row).masterCourse)})`
        : courseTitle(row, "Not entered"),
      manualCredits(row),
    ],
    className: manualRowIsCounted(row) ? "" : "summary-row--not-counted",
  }));
}

function renderNotes(notes) {
  const visibleNotes = notes.filter(([, value]) => hasText(value));
  if (visibleNotes.length === 0) return '<p class="empty-state">No changes, motivations or additional notes entered.</p>';
  return visibleNotes.map(([label, value]) => `
    <div class="note-block"><h4>${escapeHtml(label)}</h4><p>${formatText(value)}</p></div>
  `).join("");
}

function renderValidationList(validations, emptyText = "") {
  const items = asArray(validations);
  if (items.length === 0) return `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
  return `<ul class="validation-list">${items.map(renderValidationItem).join("")}</ul>`;
}

function renderValidationItem(validation) {
  const item = asRecord(validation);
  return `
    <li class="validation-item validation-item--${validationStatus(validation)}">
      <strong>${escapeHtml(displayText(coalesce(item.label, "Validation result")))}</strong>
      <span>${escapeHtml(displayText(coalesce(item.detail, "No detail reported.")))}</span>
    </li>
  `;
}

function manualRowIsCounted(row) {
  const item = asRecord(row);
  if (item.counted === true) return true;
  if (item.counted === false || item.validCredits === false) return false;
  return null;
}

function manualCredits(row) {
  const item = asRecord(row);
  const rawValue = coalesceNonBlank(item.rawCredits, item.credits);
  if (rawValue === undefined) return "Not entered";
  const parsed = parseCreditValue(rawValue);
  return parsed === null ? displayText(rawValue) : formatCredits(parsed);
}

function courseCode(course) {
  const item = asRecord(course);
  return String(coalesce(item.displayCode, item.value, item.code, item.normalizedCode, ""))
    .trim()
    .toUpperCase();
}

function courseTitle(course, fallback = "Course title not available") {
  const item = asRecord(course);
  const directTitle = coalesceNonBlank(item.title, item.name);
  if (directTitle !== undefined) return displayText(directTitle);

  const label = String(coalesce(item.label, ""))
    .replace(/\s*\((?:\d+(?:[.,]\d+)?)\s*ECTS\)\s*$/i, "")
    .trim();
  const code = courseCode(item);
  const title = code
    ? label.replace(new RegExp(`^${escapeRegExp(code)}\\s*[-:]?\\s*`, "i"), "").trim()
    : label;
  return title || fallback;
}

function courseCredits(course) {
  const item = asRecord(course);
  const value = coalesceNonBlank(item.credits, item.rawCredits);
  if (value === undefined) return "Not reported";
  const parsed = parseCreditValue(value);
  return parsed === null ? displayText(value) : formatCredits(parsed);
}

function duplicateDetail(duplicate) {
  const item = asRecord(duplicate);
  const details = [];
  if (hasText(item.excludedComponent)) details.push(`Excluded from ${displayText(item.excludedComponent)}`);
  if (hasText(item.exclusionReason)) details.push(displayText(item.exclusionReason));
  return details.length > 0
    ? details.join(". ")
    : "Repeated course code; the lower-priority occurrence was excluded.";
}

function yesNo(value) {
  const state = booleanValue(value);
  if (state === true) return "Yes";
  if (state === false) return "No";
  return hasText(value) ? displayText(value) : "Not answered";
}

function booleanValue(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return null;
}

function validationStatus(validation) {
  const status = String(asRecord(validation).status ?? "").trim().toLowerCase();
  return ["success", "warning", "error"].includes(status) ? status : "warning";
}

function numericCredits(value) {
  return parseCreditValue(value) ?? 0;
}

function parseCreditValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatText(value) {
  if (!hasText(value)) return '<span class="muted">Not answered</span>';
  return escapeHtml(displayText(value)).replace(/\r?\n/g, "<br>");
}

function formatReportCell(value) {
  if (value === undefined || value === null || value === "") return "";
  return escapeHtml(displayText(value)).replace(/\r?\n/g, "<br>");
}

function displayText(value) {
  if (Array.isArray(value)) return value.map(displayText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const item = asRecord(value);
    const preferred = coalesceNonBlank(item.label, item.title, item.name, item.value, item.code);
    if (preferred !== undefined) return displayText(preferred);
    try {
      return JSON.stringify(value);
    } catch {
      return "Unprintable value";
    }
  }
  return String(value ?? "");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function coalesce(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function coalesceNonBlank(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function hasText(value) {
  if (Array.isArray(value)) return value.some(hasText);
  return value !== undefined && value !== null && displayText(value).trim() !== "";
}


function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
