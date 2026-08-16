// Renders shared sidebar and printable-summary HTML for every programme.
import { formatCredits } from "./credit-utils.js";

export function renderEctsPanel(report, subtotalRows) {
  const state = report.hasErrors
    ? { label: "Review needed", status: "error" }
    : report.hasWarnings
      ? { label: "Check", status: "warning" }
      : { label: "Complete", status: "success" };

  return `
    <section class="ects-card">
      <div class="ects-card__header">
        <div>
          <p class="eyebrow">ECTS overview</p>
          <h2>${escapeHtml(formatCredits(report.subtotals.total))}</h2>
        </div>
        <span class="status-pill status-pill--${state.status}">${state.label}</span>
      </div>
      <dl class="ects-list">
        ${subtotalRows.map(([key, label]) =>
          renderSidebarSubtotal(label, report.subtotals[key])).join("")}
      </dl>
      ${renderSidebarValidations(report.validations)}
    </section>
  `;
}
export function renderDetailsTable(rows) {
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

export function graduationClusterDetails(data, choiceLookup) {
  const source = asRecord(data);
  const clusterQuestionName = "intended_graduation_cluster";
  const matchedQuestionName = "matched_to_graduation_cluster";
  const matched = booleanValue(source[matchedQuestionName]);
  const rows = [
    [
      questionTitle(choiceLookup, clusterQuestionName, "Intended graduation cluster"),
      choiceLabel(choiceLookup, clusterQuestionName, source[clusterQuestionName]),
    ],
    [
      questionTitle(
        choiceLookup,
        matchedQuestionName,
        "Have you already been matched to your intended graduation cluster?",
      ),
      matched === true ? "Yes" : matched === false ? "No" : "",
    ],
  ];

  const advisorNameQuestion = matched === false
    ? "mentor_name"
    : matched === true
      ? "graduation_cluster_representative_name"
      : "";
  if (advisorNameQuestion) {
    rows.push([
      questionTitle(
        choiceLookup,
        advisorNameQuestion,
        advisorNameQuestion === "mentor_name"
          ? "Who is your mentor?"
          : "Who is the representative of your intended graduation cluster?",
      ),
      source[advisorNameQuestion],
    ]);
  }

  return rows;
}

export function renderReportTable(
  headers,
  rows,
  emptyText = "None selected.",
  modifier = "",
) {
  if (!rows.length) {
    return `<p class="summary-footnote">${escapeHtml(emptyText)}</p>`;
  }
  return `
    <table class="summary-table summary-table--report${modifier ? ` ${modifier}` : ""}">
      <thead><tr>${headers.map(
        (header) => `<th>${escapeHtml(header)}</th>`,
      ).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr${row.className ? ` class="${escapeHtml(row.className)}"` : ""}>
            ${row.cells.map(
              (cell) => `<td>${formatReportCell(cell)}</td>`,
            ).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

export function renderNotes(notes) {
  const visibleNotes = notes.filter(([, value]) => hasText(value));
  if (visibleNotes.length === 0) {
    return '<p class="empty-state">No changes, motivations or additional notes entered.</p>';
  }
  return visibleNotes.map(([label, value]) => `
    <div class="note-block"><h4>${escapeHtml(label)}</h4><p>${formatText(value)}</p></div>
  `).join("");
}

export function renderValidationList(validations, emptyText = "") {
  const items = asArray(validations);
  if (items.length === 0) {
    return `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul class="validation-list">${items.map(renderValidationItem).join("")}</ul>`;
}

export function renderValidationItem(validation) {
  const item = asRecord(validation);
  const label = typeof validation === "string"
    ? "Review item"
    : coalesce(item.label, item.title, "Validation result");
  const detail = typeof validation === "string"
    ? validation
    : coalesce(item.detail, item.message, item.reason, "No detail reported.");
  return `
    <li class="validation-item validation-item--${validationStatus(validation)}">
      <strong>${escapeHtml(displayText(label))}</strong>
      <span>${escapeHtml(displayText(detail))}</span>
    </li>
  `;
}

export function booleanValue(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return null;
}

export function validationStatus(validation) {
  const status = String(asRecord(validation).status ?? "").trim().toLowerCase();
  return ["success", "warning", "error"].includes(status)
    ? status
    : "warning";
}

export function numericCredits(value) {
  return parseCreditValue(value) ?? 0;
}

export function parseCreditValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatText(value) {
  if (!hasText(value)) return '<span class="muted">Not answered</span>';
  return escapeHtml(displayText(value)).replace(/\r?\n/g, "<br>");
}

export function formatReportCell(value) {
  if (value === undefined || value === null || value === "") return "";
  return escapeHtml(displayText(value)).replace(/\r?\n/g, "<br>");
}

export function displayText(value) {
  if (Array.isArray(value)) {
    return value.map(displayText).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    const item = asRecord(value);
    const preferred = coalesceNonBlank(
      item.label,
      item.title,
      item.name,
      item.value,
      item.code,
    );
    if (preferred !== undefined) return displayText(preferred);
    try {
      return JSON.stringify(value);
    } catch {
      return "Unprintable value";
    }
  }
  return String(value ?? "");
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function coalesce(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

export function coalesceNonBlank(...values) {
  return values.find(
    (value) =>
      value !== undefined
      && value !== null
      && String(value).trim() !== "",
  );
}

export function hasText(value) {
  if (Array.isArray(value)) return value.some(hasText);
  return value !== undefined
    && value !== null
    && displayText(value).trim() !== "";
}

export function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function choiceLabel(choiceLookup, questionName, value) {
  return choiceLookup?.getLabel?.(questionName, value) ?? displayText(value);
}

function questionTitle(choiceLookup, questionName, fallback) {
  return coalesceNonBlank(
    choiceLookup?.getQuestion?.(questionName)?.title,
    fallback,
  );
}

function renderSidebarSubtotal(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(formatCredits(value))}</dd>
    </div>
  `;
}

function renderSidebarValidations(validations) {
  return `
    <ul class="validation-list validation-list--compact">
      ${validations.map(renderSidebarValidation).join("")}
    </ul>
  `;
}

function renderSidebarValidation(validation) {
  return `
    <li class="validation-item validation-item--${escapeHtml(validation.status)}">
      <strong>${escapeHtml(validation.label)}</strong>
      <span>${escapeHtml(validation.detail)}</span>
    </li>
  `;
}
