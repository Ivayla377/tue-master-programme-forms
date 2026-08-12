// Provides reusable value formatting and HTML helpers for printable programme summaries.
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
