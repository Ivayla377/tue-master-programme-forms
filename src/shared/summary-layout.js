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
        ${subtotalRows.map(([key, label]) => renderSubtotal(label, report.subtotals[key])).join("")}
      </dl>
      ${renderValidationList(report.validations, "validation-list--compact")}
    </section>
  `;
}

export function renderValidationList(validations, modifier = "") {
  return `
    <ul class="validation-list${modifier ? ` ${modifier}` : ""}">
      ${validations.map(renderValidationItem).join("")}
    </ul>
  `;
}

export function renderValidationItem(validation) {
  return `
    <li class="validation-item validation-item--${escapeHtml(validation.status)}">
      <strong>${escapeHtml(validation.label)}</strong>
      <span>${escapeHtml(validation.detail)}</span>
    </li>
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

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
