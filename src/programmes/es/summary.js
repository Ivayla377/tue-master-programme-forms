// Renders ES credit panels and printable programme summaries.
import { formatCredits } from "../../shared/credit-utils.js";
import {
  asArray,
  asRecord,
  booleanValue,
  coalesce,
  coalesceNonBlank,
  displayText,
  escapeHtml,
  escapeRegExp,
  formatCurrentDate,
  formatReportCell,
  formatText,
  graduationClusterDetails,
  hasText,
  numericCredits,
  parseCreditValue,
  renderDetailsTable,
  renderEctsPanel as renderSharedEctsPanel,
  renderNotes,
  renderReportTable,
  renderValidationList,
  validationStatus,
} from "../../shared/summary-rendering.js";
import { DEFAULT_ES_CONFIG } from "./form-config.js";

const PANEL_SUBTOTAL_ROWS = [
  ["commonMandatory", "Common mandatory courses"],
  ["streamMandatory", "Stream mandatory courses"],
  ["streamElectivesRequired", "Stream electives (required)"],
  ["freeElectiveRows", "Entered free electives"],
  ["homologation", "Homologation"],
  ["internship", "Internship"],
  ["freeElectiveSpace", "Free-elective space total"],
  ["graduationPhase", "Graduation phase"],
  ["total", "Total credits"],
];

const SUMMARY_SUBTOTAL_ROWS = [
  ["commonMandatory", "Common mandatory courses"],
  ["streamMandatory", "Selected-stream mandatory courses"],
  ["streamElectivesRequired", "Stream electives (required)"],
  ["streamElectivesExcess", "Additional stream electives in free space"],
  ["freeElectiveRows", "Entered free electives"],
  ["homologation", "Homologation courses"],
  ["internship", "Internship"],
  ["preparationProject", "Preparation graduation project"],
  ["graduationProject", "Graduation project"],
  ["total", "Overall programme total"],
];

const SUBTOTAL_ALIASES = {
  commonMandatory: ["commonMandatory", "common", "commonMandatoryCredits"],
  streamMandatory: ["streamMandatory", "streamMandatoryCredits"],
  streamElectivesSelected: [
    "streamElectivesSelected",
    "selectedStreamElectiveCredits",
    "streamElectiveCredits",
  ],
  streamElectivesRequired: [
    "streamElectivesRequired",
    "requiredStreamElectiveCredits",
  ],
  streamElectivesExcess: [
    "streamElectivesExcess",
    "excessStreamElectiveCredits",
  ],
  freeElectiveRows: ["freeElectiveRows", "manualFreeElectiveCredits", "freeRows"],
  assignedHomologation: ["assignedHomologation", "assignedHomologationCredits"],
  selfChosenHomologation: ["selfChosenHomologation", "selfChosenHomologationCredits"],
  homologation: ["homologation", "homologationCredits"],
  internship: ["internship", "internshipCredits"],
  freeElectiveSpace: ["freeElectiveSpace", "freeElectiveSpaceCredits", "freeSpace"],
  preparationProject: ["preparationProject", "preparationProjectCredits"],
  graduationProject: ["graduationProject", "graduationProjectCredits"],
  graduationPhase: ["graduationPhase", "graduationPhaseCredits"],
  mandatoryAndGraduation: ["mandatoryAndGraduation", "mandatoryAndGraduationCredits"],
  total: ["total", "totalCredits"],
};

const STREAM_LABELS = Object.fromEntries(
  DEFAULT_ES_CONFIG.streams.map(({ value, label }) => [value, label]),
);

const GRADUATION_CONTEXT_LABELS = Object.fromEntries(
  DEFAULT_ES_CONFIG.graduationContexts.map(
    ({ value, label }) => [value, label],
  ),
);

const INTERNSHIP_TYPE_LABELS = Object.fromEntries(
  DEFAULT_ES_CONFIG.internshipTypeOptions.map(
    ({ value, label }) => [value, label],
  ),
);

export function renderEsEctsPanel(report) {
  const safeReport = normalizeReport(report);
  const validations = selectEsSidebarValidations(safeReport.validations);
  return renderSharedEctsPanel(
    {
      ...safeReport,
      validations,
      hasWarnings: validations.some((validation) => validationStatus(validation) === "warning"),
    },
    visibleSubtotalRows(PANEL_SUBTOTAL_ROWS, safeReport),
  );
}

const SIDEBAR_ALWAYS_VISIBLE = new Set([
  "Stream selection",
  "Stream electives",
  "Free elective space",
  "Total credits",
]);

const SIDEBAR_ERROR_ONLY = new Set([
  "Course incompatibilities",
  "Stream-elective eligibility",
]);

const SIDEBAR_EXCEPTION_ONLY = new Set([
  "Stale stream selections",
  "University of Twente secondary enrollment",
  "Seminar scheduling",
]);

export function selectEsSidebarValidations(validations) {
  const items = asArray(validations);
  const homologationErrors = items.filter((validation) => {
    const label = String(asRecord(validation).label ?? "");
    return validationStatus(validation) === "error"
      && !label.endsWith("choice")
      && (label.startsWith("Homologation") || label.startsWith("Self-chosen homologation"));
  });

  const visible = items.filter((validation) => {
    const label = String(asRecord(validation).label ?? "");
    if (label.startsWith("Homologation") || label.startsWith("Self-chosen homologation")) {
      return false;
    }
    if (SIDEBAR_ALWAYS_VISIBLE.has(label)) return true;
    if (SIDEBAR_ERROR_ONLY.has(label)) return validationStatus(validation) === "error";
    return SIDEBAR_EXCEPTION_ONLY.has(label);
  });

  if (homologationErrors.length > 0) {
    visible.push({
      label: "Homologation",
      status: "error",
      detail: [...new Set(homologationErrors.map((validation) =>
        String(asRecord(validation).detail ?? "").trim()).filter(Boolean))].join(" "),
    });
  }

  return visible;
}

export function renderEsSummary(report, data, choiceLookup, labels = {}) {
  const config = choiceLookup?.esConfig ?? DEFAULT_ES_CONFIG;
  const safeReport = normalizeReport(report);
  const safeData = asRecord(data);
  const selected = safeReport.selected;
  const personalInfo = asRecord(safeData.personal_info);
  const summaryEyebrow = labels.summaryEyebrow ?? "ES Program of Examinations";
  const summaryTitle = labels.summaryTitle ?? "Form 1: ES Program of Examinations";
  const generatedOn = formatCurrentDate();

  const streamSelection = selected.stream ?? safeData.stream;
  const graduationContext = selected.graduationContext ?? safeData.graduation_context;
  const streamLabel = choiceLabel(
    choiceLookup,
    "stream",
    streamSelection,
    STREAM_LABELS,
    "Not selected",
  );
  const graduationContextLabel = choiceLabel(
    choiceLookup,
    "graduation_context",
    graduationContext,
    GRADUATION_CONTEXT_LABELS,
    "Not selected",
  );
  const streamElectiveRows = [
    ...selected.requiredStreamElectiveCourses.map((course) => ({
      cells: [courseCode(course), courseTitle(course), courseCredits(course)],
    })),
    ...selected.invalidStreamElectiveCourses.map((course) => ({
      cells: [courseCode(course), courseTitle(course), courseCredits(course)],
      className: "summary-row--not-counted",
    })),
    ...selected.staleStreamElectiveCourses.map((course) => ({
      cells: [courseCode(course), courseTitle(course), courseCredits(course)],
      className: "summary-row--not-counted",
    })),
  ];

  const homologationState = booleanValue(safeData.homologation);
  const selfChosenState = booleanValue(safeData.self_chosen_homologation);
  const freeElectiveRows = reportRowsOrEnteredRows(
    selected.freeElectiveRows,
    safeData.free_electives,
  );
  const homologationRows = homologationState === false
    ? []
    : reportRowsOrEnteredRows(
      selected.homologationRows,
      safeData.homologation_courses,
    );
  const freeSpaceRows = [
    ...selected.excessStreamElectiveCourses.map((course) => ({
      cells: [
        "Additional stream elective",
        courseCode(course),
        courseTitle(course),
        courseCredits(course),
      ],
    })),
    ...manualSummaryRows("Free elective", freeElectiveRows),
    ...manualSummaryRows("Homologation", homologationRows),
  ];
  const hasHomologationCourses = homologationRows.length > 0;
  const hasSelfChosenHomologationCourses = selfChosenState === true
    && homologationRows.length > 0;

  const internship = asRecord(selected.internship);
  const internshipSelected = booleanValue(coalesce(internship.selected, safeData.internship));
  const internshipCourse = internshipSelected === false
    ? null
    : internship.course ?? internshipCourseFromData(internship, safeData, config);
  const internshipType = choiceLabel(
    choiceLookup,
    "internship_type",
    coalesce(internship.type, safeData.internship_type),
    INTERNSHIP_TYPE_LABELS,
  );
  const internshipSupervisor = coalesce(internship.supervisor, safeData.internship_supervisor);

  const preparationCourses = courseArray(selected.preparationProject);
  const graduationCourses = courseArray(selected.graduationProject);
  const contextValue = choiceValue(graduationContext);
  if (preparationCourses.length === 0) {
    preparationCourses.push(...fallbackProjectCourses(
      contextValue,
      "preparation",
      config,
    ));
  }
  if (graduationCourses.length === 0) {
    graduationCourses.push(...fallbackProjectCourses(
      contextValue,
      "graduation",
      config,
    ));
  }
  const previousState = booleanValue(safeData.previous);
  const externalState = booleanValue(safeData.external_courses);
  const selectedExternalCourse = selected.streamElectiveCourses.some(
    (course) => config.externalCourseCodes.has(normalizeCourseCode(course)),
  );
  const externalCourseDisplayCodes =
    config.externalCourseDisplayCodes.join(", ");
  const externalDetailsEntered = hasAnyText([
    safeData.external_course_university,
    safeData.external_course_links,
    safeData.external_course_motivation,
    safeData.external_course_overlap,
  ]);
  const externalDetailsActive = externalState === true
    || selectedExternalCourse
    || (externalState === null && externalDetailsEntered);
  const selfChosenDetailsActive = selfChosenState === true;
  const updateDetailsActive = previousState === true
    || (previousState === null && hasText(safeData.changes));
  return `
    <article class="summary-report summary-report--es">
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
        <h3>Student and graduation information</h3>
        ${renderDetailsTable([
          ["Name", personalInfo.name],
          ["Student ID", personalInfo.id],
          ["Enrollment", personalInfo.enrollment],
          ...graduationClusterDetails(safeData, choiceLookup),
          ["Updates a previously approved programme", yesNo(safeData.previous)],
          ["Graduation department", graduationContextLabel],
        ])}
      </section>

      <section class="summary-section">
        <h3>Common mandatory courses</h3>
        ${renderCourseTable(selected.commonMandatoryCourses, "No common mandatory courses were reported.")}
      </section>

      <section class="summary-section">
        <h3>Selected stream and mandatory courses</h3>
        <p class="summary-inline-detail"><strong>Selected stream:</strong> ${formatText(streamLabel)}</p>
        ${renderCourseTable(selected.streamMandatoryCourses, "No stream mandatory courses were reported.")}
      </section>

      <section class="summary-section summary-section--allow-break">
        <h3>Stream electives</h3>
        <p class="summary-inline-detail">
          <strong>Allocated:</strong> ${escapeHtml(formatCredits(safeReport.subtotals.streamElectivesRequired))} / ${escapeHtml(formatCredits(config.rules.streamElectiveTarget))}
        </p>
        ${renderReportTable(
          ["Course code", "Course title", "Credits"],
          streamElectiveRows,
          "No stream electives selected.",
          "summary-table--course-data summary-table--three-course",
        )}
      </section>

      <section class="summary-section summary-section--allow-break">
        <h3>Free electives and homologation</h3>
        ${renderDetailsTable([
          ["Homologation included", yesNo(safeData.homologation)],
          ...(homologationState === true
            ? [["Self-chosen homologation included", yesNo(safeData.self_chosen_homologation)]]
            : []),
        ])}
        ${renderReportTable(
          ["Type", "Course code", "Course title", "Credits"],
          freeSpaceRows,
          "No free-elective or homologation rows entered.",
          "summary-table--course-data summary-table--es-free-space",
        )}
      </section>

      <section class="summary-section">
        <h3>Internship</h3>
        ${renderDetailsTable([
          ["Included", yesNo(coalesce(internship.selected, safeData.internship))],
          ...(internshipSelected === true
            ? [
                ["Internship type", internshipType],
                ["Supervisor (if known)", internshipSupervisor],
              ]
            : []),
        ])}
        ${internshipCourse
          ? renderCourseTable([internshipCourse], "", "summary-table--three-course")
          : internshipSelected === true
            ? '<p class="summary-footnote">No valid internship course code was reported.</p>'
            : ""}
      </section>

      <section class="summary-section">
        <h3>Preparation and graduation projects</h3>
        <p class="summary-inline-detail"><strong>Graduation department:</strong> ${formatText(graduationContextLabel)}</p>
        ${renderReportTable(
          ["Component", "Course code", "Course title", "Credits"],
          [
            ...preparationCourses.map((course) => ({ cells: ["Preparation graduation project", courseCode(course), courseTitle(course), courseCredits(course)] })),
            ...graduationCourses.map((course) => ({ cells: ["Graduation project", courseCode(course), courseTitle(course), courseCredits(course)] })),
          ],
          "No valid graduation-department course alternatives were reported.",
          "summary-table--course-data summary-table--completion",
        )}
        ${renderInvalidGraduationSelections(selected.invalidGraduationSelections)}
      </section>

      <section class="summary-section">
        <h3>External university courses</h3>
        ${renderDetailsTable([
          ["External university courses declared", yesNo(safeData.external_courses)],
          ...(selectedExternalCourse
            ? [[`External-course evidence required by selected ${externalCourseDisplayCodes}`, "Yes"]]
            : []),
          ...(externalDetailsActive
            ? [
                ["University / institution", safeData.external_course_university],
                ["Course-description links", safeData.external_course_links],
                ["Motivation for selection", safeData.external_course_motivation],
                ["Explanation of non-overlap", safeData.external_course_overlap],
              ]
            : []),
        ])}
      </section>

      <section class="summary-section">
        <h3>Changes, motivations and notes</h3>
        ${renderNotes([
          ...(updateDetailsActive ? [["Changes to the previously approved programme", safeData.changes]] : []),
          ...(selfChosenDetailsActive ? [["Motivation for self-chosen homologation courses", safeData.homologation_motivation]] : []),
          ["Additional notes for the Examination Committee", safeData.committee_notes],
        ])}
      </section>

      <section class="summary-section">
        <h3>ECTS subtotals</h3>
        ${renderSubtotalsTable(safeReport)}
      </section>

      <section class="summary-section summary-section--allow-break">
        <h3>Validation results</h3>
        ${renderValidationList(compactEsSummaryValidations(safeReport.validations, {
          graduationDepartment: graduationContextLabel,
          hasHomologation: hasHomologationCourses,
          hasSelfChosenHomologation: hasSelfChosenHomologationCourses,
          hasExternalCourses: externalDetailsActive,
          graduationCredits: config.rules.graduationPhaseCredits,
          homologationMaximum: config.rules.homologationMaximum,
        }), "No validation results were reported.")}
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

export function compactEsSummaryValidations(validations, options = {}) {
  const items = asArray(validations);
  const ordinary = [];
  const homologation = [];
  const selfChosen = [];
  const graduation = [];

  for (const validation of items) {
    const label = String(asRecord(validation).label ?? "");
    if (label.startsWith("Self-chosen homologation")) {
      selfChosen.push(validation);
    } else if (label.startsWith("Homologation")) {
      homologation.push(validation);
    } else if ([
      "Graduation department",
      "Graduation context",
      "Preparation project",
      "Graduation project",
      "Graduation phase",
    ].includes(label)) {
      graduation.push(validation);
    } else if ([
      "Stream mandatory courses",
      "Manual elective rows",
      "Internship selection",
      "Programme coherence review",
    ].includes(label)) {
      continue;
    } else if (label === "Course incompatibilities"
      && validationStatus(validation) !== "error") {
      continue;
    } else if (label === "External course information"
      && !options.hasExternalCourses
      && validationStatus(validation) !== "error") {
      continue;
    } else {
      ordinary.push(validation);
    }
  }

  if (graduation.length > 0) {
    const graduationValidation = compactGraduationValidation(
      graduation,
      options.graduationDepartment,
      options.graduationCredits,
    );
    const totalIndex = ordinary.findIndex((validation) =>
      String(asRecord(validation).label ?? "") === "Total credits");
    ordinary.splice(totalIndex < 0 ? ordinary.length : totalIndex, 0, graduationValidation);
  }
  if (options.hasHomologation && homologation.length > 0) {
    ordinary.push(compactValidationGroup(
      "Homologation",
      homologation,
      `Selection, course entries and the ${formatCredits(
        options.homologationMaximum
          ?? DEFAULT_ES_CONFIG.rules.homologationMaximum,
      )} limit are valid.`,
    ));
  }
  if (options.hasSelfChosenHomologation && selfChosen.length > 0) {
    ordinary.push(compactValidationGroup(
      "Self-chosen homologation",
      selfChosen,
      "Selection, course entries, motivation and course-count limit are valid.",
    ));
  }

  return ordinary;
}

function compactGraduationValidation(
  validations,
  department,
  graduationCredits = DEFAULT_ES_CONFIG.rules.graduationPhaseCredits,
) {
  const compact = compactValidationGroup(
    "Graduation phase",
    validations,
    `${displayText(department || "Department not selected")} (${formatCredits(
      graduationCredits,
    )}).`,
  );
  if (compact.status !== "success" && hasText(department)) {
    compact.detail = `${displayText(department)}. ${compact.detail}`;
  }
  return compact;
}

function compactValidationGroup(label, validations, successDetail) {
  const statuses = validations.map(validationStatus);
  const status = statuses.includes("error")
    ? "error"
    : statuses.includes("warning")
      ? "warning"
      : "success";
  const relevant = validations.filter((validation) => validationStatus(validation) === status);
  const detail = status === "success"
    ? successDetail
    : [...new Set(relevant.map((validation) =>
      String(asRecord(validation).detail ?? "").trim()).filter(Boolean))].join(" ");
  return { label, status, detail };
}

function normalizeReport(report) {
  const source = asRecord(report);
  const sourceSubtotals = asRecord(source.subtotals);
  const subtotals = Object.fromEntries(
    Object.entries(SUBTOTAL_ALIASES).map(([key, aliases]) => [
      key,
      numericCredits(coalesce(...aliases.map((alias) => sourceSubtotals[alias]))),
    ]),
  );
  const sourceSelected = asRecord(source.selected);
  const validations = asArray(source.validations);
  const hasErrors = typeof source.hasErrors === "boolean"
    ? source.hasErrors
    : validations.some((validation) => validationStatus(validation) === "error");
  const hasWarnings = typeof source.hasWarnings === "boolean"
    ? source.hasWarnings
    : validations.some((validation) => validationStatus(validation) === "warning");

  return {
    ...source,
    subtotals,
    selected: {
      ...sourceSelected,
      commonMandatoryCourses: arrayFromAliases(sourceSelected, ["commonMandatoryCourses", "commonCourses", "coreCourses"]),
      stream: coalesce(sourceSelected.stream, sourceSelected.selectedStream),
      streamMandatoryCourses: arrayFromAliases(sourceSelected, ["streamMandatoryCourses", "mandatoryStreamCourses"]),
      streamElectiveCourses: arrayFromAliases(sourceSelected, ["streamElectiveCourses", "streamElectives"]),
      requiredStreamElectiveCourses: arrayFromAliases(
        sourceSelected,
        ["requiredStreamElectiveCourses", "streamElectiveCourses", "streamElectives"],
      ),
      excessStreamElectiveCourses: arrayFromAliases(
        sourceSelected,
        ["excessStreamElectiveCourses", "additionalStreamElectiveCourses"],
      ),
      invalidStreamElectiveCourses: arrayFromAliases(sourceSelected, ["invalidStreamElectiveCourses", "invalidStreamElectives"]),
      staleStreamElectiveCourses: arrayFromAliases(sourceSelected, ["staleStreamElectiveCourses", "ignoredStreamElectiveCourses"]),
      freeElectiveRows: arrayFromAliases(sourceSelected, ["freeElectiveRows", "freeRows"]),
      assignedHomologationRows: arrayFromAliases(sourceSelected, ["assignedHomologationRows", "assignedHomologationCourses"]),
      selfChosenHomologationRows: arrayFromAliases(sourceSelected, ["selfChosenHomologationRows", "selfChosenHomologationCourses"]),
      homologationRows: arrayFromAliases(sourceSelected, ["homologationRows", "homologationCourses"]),
      internship: coalesce(sourceSelected.internship, {}),
      preparationProject: coalesce(sourceSelected.preparationProject, sourceSelected.preparationCourse),
      graduationProject: coalesce(sourceSelected.graduationProject, sourceSelected.masterProject),
      invalidGraduationSelections: arrayFromAliases(sourceSelected, ["invalidGraduationSelections"]),
      graduationContext: coalesce(sourceSelected.graduationContext, sourceSelected.context),
    },
    validations,
    hasErrors,
    hasWarnings,
  };
}

function renderSubtotalsTable(report) {
  return `
    <table class="summary-table summary-table--subtotals">
      <tbody>
        ${visibleSubtotalRows(SUMMARY_SUBTOTAL_ROWS, report).map(([key, label]) => `
          <tr${key === "total" ? ' class="summary-row--group"' : ""}>
            <th scope="row">${escapeHtml(label)}</th>
            <td>${escapeHtml(formatCredits(report.subtotals[key]))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function visibleSubtotalRows(rows, report) {
  return rows.filter(
    ([key]) => key !== "streamElectivesExcess"
      || report.subtotals.streamElectivesExcess > 0,
  );
}

function renderCourseTable(courses, emptyText, modifier = "summary-table--three-course") {
  return renderReportTable(
    ["Course code", "Course title", "Credits"],
    asArray(courses).map((course) => ({
      cells: [courseCode(course), courseTitle(course), courseCredits(course)],
    })),
    emptyText,
    `summary-table--course-data ${modifier}`,
  );
}

function manualSummaryRows(type, rows) {
  return asArray(rows).map((row) => ({
    cells: [type, courseCode(row), courseTitle(row, "Not entered"), manualCredits(row)],
    className: manualRowIsValid(row) ? "" : "summary-row--not-counted",
  }));
}

function reportRowsOrEnteredRows(reportRows, enteredRows) {
  const reported = asArray(reportRows);
  if (reported.length > 0) return reported;
  return asArray(enteredRows)
    .filter(hasEnteredManualRow)
    .map((row) => ({ ...asRecord(row), summaryOnly: true }));
}

function hasEnteredManualRow(row) {
  const item = asRecord(row);
  return hasAnyText([item.code, item.title, item.name, item.credits]);
}

function manualRowIsValid(row) {
  const item = asRecord(row);
  if (
    item.validCredits === false
    || item.valid === false
    || item.isValid === false
    || item.complete === false
  ) return false;
  return true;
}

function manualCredits(row) {
  const item = asRecord(row);
  const rawValue = coalesceNonBlank(item.rawCredits, item.enteredCredits, item.credits);
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

function internshipCourseFromData(internship, data, config) {
  const code = coalesceNonBlank(internship.code, data.internship_code);
  if (code === undefined) return null;
  const metadata = config.courseCatalog[normalizeChoiceValue(code)];
  return {
    code: metadata?.code ?? code,
    title: metadata?.title ?? "Internship",
    credits: coalesceNonBlank(
      internship.credits,
      metadata?.credits,
      config.rules.internshipCredits,
    ),
  };
}

function fallbackProjectCourses(context, component, config) {
  const definition = config.graduationContexts.find(
    ({ value }) => value === normalizeChoiceValue(context),
  );
  const code = component === "preparation"
    ? definition?.preparationCode
    : definition?.graduationCode;
  const metadata = config.courseCatalog[normalizeChoiceValue(code)];
  return metadata ? [{
    code: metadata.code,
    title: metadata.title,
    credits: metadata.credits,
  }] : [];
}

function normalizeCourseCode(course) {
  return courseCode(course).replace(/\s+/g, "").toLowerCase();
}

function renderInvalidGraduationSelections(selections) {
  const items = asArray(selections);
  if (items.length === 0) return "";
  const detail = items.map((selection) => {
    const item = asRecord(selection);
    const component = coalesce(item.pair, item.component, "project");
    const value = coalesce(item.value, item.code, selection);
    return `${displayText(component)}: ${displayText(value)}`;
  }).join("; ");
  return `<p class="summary-footnote"><strong>Ignored malformed project selections:</strong> ${escapeHtml(detail)}</p>`;
}

function choiceLabel(choiceLookup, questionName, value, fallbackLabels = {}, emptyLabel = "Not answered") {
  if (Array.isArray(value)) {
    if (value.length === 0) return emptyLabel;
    return value.map((entry) => choiceLabel(choiceLookup, questionName, entry, fallbackLabels, emptyLabel)).join(", ");
  }
  const item = asRecord(value);
  if (hasText(item.label)) return displayText(item.label);
  const rawValue = choiceValue(value);
  if (!hasText(rawValue)) return emptyLabel;
  const fallback = fallbackLabels[normalizeChoiceValue(rawValue)];
  if (fallback) return fallback;
  try {
    return choiceLookup?.getLabel?.(questionName, rawValue) ?? displayText(rawValue);
  } catch {
    return displayText(rawValue);
  }
}

function choiceValue(value) {
  if (Array.isArray(value)) return value;
  const item = asRecord(value);
  return coalesce(item.value, item.code, value);
}

function normalizeChoiceValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function yesNo(value) {
  const state = booleanValue(value);
  if (state === true) return "Yes";
  if (state === false) return "No";
  return hasText(value) ? displayText(value) : "Not answered";
}

function arrayFromAliases(record, aliases) {
  for (const alias of aliases) {
    if (Array.isArray(record[alias])) return record[alias];
  }
  return [];
}

function courseArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? [...value] : [value];
}

function hasAnyText(values) {
  return values.some(hasText);
}
