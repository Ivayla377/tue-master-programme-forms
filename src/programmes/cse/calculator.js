import { createChoiceLookup } from "../../shared/course-utils.js";
import {
  formatCredits,
  isTrue,
  sumCredits as sumSharedCredits,
} from "../../shared/credit-utils.js";
import { allocateCoursesToTarget } from "../../shared/elective-allocation.js";
import { exactCreditValidation } from "../../shared/validation-utils.js";

export const CSE_SPECIALIZATION_TARGET = 30;

export const CSE_FOCUS_AREAS = [
  { value: "algorithms", label: "Algorithms and Theory" },
  { value: "architectures", label: "Architectures and Systems" },
  { value: "software", label: "Software and Analytics" },
];

export const CSE_GRADUATION_GROUPS = [
  { value: "algorithms", label: "Algorithms" },
  { value: "formal_systems_analysis", label: "Formal Systems Analysis" },
  { value: "security", label: "Security" },
  { value: "software_engineering_technology", label: "Software Engineering and Technology" },
  { value: "iris", label: "Interconnected Resource-aware Intelligent Systems" },
  { value: "dai_databases", label: "Data and Artificial Intelligence - Databases" },
  { value: "dai_other", label: "Data and Artificial Intelligence - Other groups" },
  { value: "process_analytics", label: "Process Analytics" },
  { value: "visualization", label: "Visualization" },
  { value: "discrete_mathematics", label: "Discrete Mathematics" },
];

export const CSE_COURSE_CREDITS = {
  "2imc05": 10,
  "2imc00": 30,
  "2imc10": 15,
};

const FIXED_COURSE_LABELS = {
  "2imc05": "2IMC05 Preparation Graduation Project (10 ECTS)",
  "2imc00": "2IMC00 Master Project (30 ECTS)",
  "2imc10": "2IMC10 Internship (15 ECTS)",
};

const FOUNDATIONAL_FIELDS = [
  { focus: "algorithms", field: "foundational_algorithms" },
  { focus: "architectures", field: "foundational_architectures" },
  { focus: "software", field: "foundational_software" },
];

const SPECIALIZATION_FIELDS = [
  "specialization_algorithms",
  "specialization_architectures",
  "specialization_software",
  "specialization_additional",
];

export function createCseChoiceLookup(surveyJson) {
  const lookup = createChoiceLookup(surveyJson);
  lookup.cseCatalog = buildCourseCatalog(surveyJson);
  return lookup;
}

export function calculateCse(data = {}, choiceLookup = createCseChoiceLookup({ pages: [] })) {
  const catalog = choiceLookup.cseCatalog ?? new Map();
  const doubleCountedCourses = [];
  const claimed = new Map();
  const foundationalSelections = FOUNDATIONAL_FIELDS.map(({ focus, field }) => ({
    focus,
    field,
    code: normalizeCode(data[field]),
  })).filter((selection) => selection.code !== "");
  const foundationalCodes = uniqueCodes(foundationalSelections.map((selection) => selection.code));
  const foundationalCourses = foundationalCodes.map((code) =>
    makeCourse(code, "foundational_algorithms", choiceLookup, catalog),
  );
  for (const course of foundationalCourses) {
    course.counted = claim(course, "foundational course", claimed, doubleCountedCourses);
  }
  const foundationAssignment = new Map(
    foundationalSelections.map((selection) => [
      selection.focus,
      makeCourse(selection.code, selection.field, choiceLookup, catalog),
    ]),
  );

  const extraFocus = String(data.extra_focus_area ?? "");
  const extraField = CSE_FOCUS_AREAS.some((area) => area.value === extraFocus)
    ? `extra_${extraFocus}`
    : "extra";
  const extraCodes = uniqueCodes(data[extraField] ?? data.extra);
  const extraCandidateCourses = extraCodes.map((code) => makeCourse(code, extraField, choiceLookup, catalog));
  const extraCourses = [];
  for (const course of extraCandidateCourses) {
    if (claim(course, "extra course", claimed, doubleCountedCourses)) {
      course.counted = true;
      extraCourses.push(course);
    } else {
      course.counted = false;
    }
  }
  const extraOutsideFocus = extraCourses.filter(
    (course) => !catalog.get(course.code)?.focuses.has(extraFocus),
  );

  const legacySpecialization = selectedValues(data.specialization_courses).filter(
    (code) => normalizeCode(code) !== "2imc10",
  );
  const specializationRawCodes = [
    ...SPECIALIZATION_FIELDS.flatMap((field) => selectedValues(data[field])),
    ...legacySpecialization,
  ].map(normalizeCode).filter(Boolean);
  const duplicateSpecializationCodes = repeatedCodes(specializationRawCodes);
  const specializationCodes = uniqueCodes(specializationRawCodes);
  const specializationCandidateCourses = specializationCodes.map((code) =>
    makeCourse(code, "specialization_additional", choiceLookup, catalog),
  );
  const selectedSpecializationCourses = [];
  for (const course of specializationCandidateCourses) {
    if (claim(course, "specialization elective", claimed, doubleCountedCourses)) {
      course.counted = true;
      selectedSpecializationCourses.push(course);
    } else {
      course.counted = false;
    }
  }

  const internshipSelected = isTrue(data.internship)
    || selectedValues(data.specialization_courses).map(normalizeCode).includes("2imc10");
  const internshipCourse = internshipSelected
    ? makeCourse("2imc10", "internship", choiceLookup, catalog)
    : null;
  if (internshipCourse) {
    internshipCourse.counted = claim(internshipCourse, "internship", claimed, doubleCountedCourses);
  }
  const internshipCredits = internshipCourse?.counted ? internshipCourse.credits : 0;
  const specializationCourseTarget = Math.max(
    0,
    CSE_SPECIALIZATION_TARGET - internshipCredits,
  );
  const specializationAllocation = allocateCoursesToTarget(
    selectedSpecializationCourses,
    specializationCourseTarget,
  );
  const specializationCourses = specializationAllocation.required;
  const excessSpecializationCourses = specializationAllocation.excess;
  for (const course of excessSpecializationCourses) {
    renameClaimedComponent(
      course,
      "additional specialization elective in free-elective space",
      claimed,
    );
  }

  const duplicateSpecializationCourses = duplicateSpecializationCodes.map((code) =>
    makeCourse(code, "specialization_additional", choiceLookup, catalog),
  );

  const seminar = data.seminar
    ? makeCourse(data.seminar, "seminar", choiceLookup, catalog)
    : null;
  if (seminar) {
    seminar.counted = claim(seminar, "seminar", claimed, doubleCountedCourses);
  }

  const graduationCodes = data.graduation_courses === undefined
    ? ["2imc05", "2imc00"]
    : uniqueCodes(data.graduation_courses);
  const graduationCourses = graduationCodes.map((code) =>
    makeCourse(code, "graduation_courses", choiceLookup, catalog),
  );
  for (const course of graduationCourses) {
    course.counted = claim(course, "graduation project", claimed, doubleCountedCourses);
  }

  const homologationRows = processRows(
    isTrue(data.homologation) ? normalizeRows(data.homologation_courses) : [],
    "homologation",
    claimed,
    doubleCountedCourses,
  );
  const freeRows = processRows(
    normalizeRows(data.free_electives),
    "free elective",
    claimed,
    doubleCountedCourses,
  );
  const invalidFreeRows = freeRows.filter((row) => !row.validCredits);
  const invalidHomologationRows = homologationRows.filter((row) => !row.validCredits);
  const manualFreeCredits = sumCountedRows(freeRows);
  const specializationExcessCredits = specializationAllocation.excessCredits;
  const freeCredits = manualFreeCredits + specializationExcessCredits;
  const homologationCredits = sumCountedRows(homologationRows);
  const freeSpaceTotal = freeCredits + homologationCredits;

  const foundationalCredits = sumCountedCourses(foundationalCourses);
  const extraCredits = sumCountedCourses(extraCourses);
  const specializationCourseCredits = specializationAllocation.requiredCredits;
  const specializationCredits = specializationCourseCredits + internshipCredits;
  const seminarCredits = seminar?.counted ? seminar.credits : 0;
  const graduationCredits = sumCountedCourses(graduationCourses);
  const totalCredits =
    foundationalCredits
    + extraCredits
    + specializationCredits
    + freeSpaceTotal
    + seminarCredits
    + graduationCredits;

  const validations = buildValidations({
    foundationalSelections,
    foundationalCourses,
    extraCourses,
    extraFocus,
    extraOutsideFocus,
    specializationCourses,
    duplicateSpecializationCourses,
    doubleCountedCourses,
    specializationCredits,
    specializationExcessCredits,
    internshipSelected,
    freeSpaceTotal,
    seminarCredits,
    graduationCredits,
    totalCredits,
    freeRows,
    homologationRows,
    invalidFreeRows,
    invalidHomologationRows,
    data,
  });

  return {
    subtotals: {
      foundational: foundationalCredits,
      extra: extraCredits,
      specializationCoursesSelected: sumCountedCourses(selectedSpecializationCourses),
      specializationCourses: specializationCourseCredits,
      specializationExcess: specializationExcessCredits,
      internship: internshipCredits,
      specialization: specializationCredits,
      manualFreeElectives: manualFreeCredits,
      freeElectives: freeCredits,
      homologation: homologationCredits,
      freeSpace: freeSpaceTotal,
      seminar: seminarCredits,
      graduation: graduationCredits,
      total: totalCredits,
    },
    selected: {
      foundationalCourses,
      extraCourses,
      specializationCourses,
      allSpecializationCourses: selectedSpecializationCourses,
      excessSpecializationCourses,
      foundationAssignment,
      extraFocus,
      seminar,
      freeRows,
      homologationRows,
      graduationCourses,
      internship: {
        selected: internshipSelected,
        supervisor: data.internship_supervisor ?? "",
        credits: internshipCredits,
        course: internshipCourse,
        counted: internshipCourse?.counted ?? false,
        exclusionReason:
          internshipCourse && !internshipCourse.counted ? "Duplicate course; excluded from totals." : "",
      },
      doubleCountedCourses,
      duplicateSpecializationCourses,
    },
    validations,
    hasErrors: validations.some((validation) => validation.status === "error"),
    hasWarnings: validations.some((validation) => validation.status === "warning"),
    isValid: validations.every((validation) => validation.status !== "error"),
    isComplete: validations.every((validation) => validation.status === "success"),
  };
}

function buildValidations(values) {
  const validations = [
    {
      label: "Foundational courses",
      status:
        values.foundationalSelections.length === 3 && values.foundationalCourses.length === 3
          ? "success"
          : "error",
      detail:
        values.foundationalSelections.length === 3 && values.foundationalCourses.length === 3
          ? "One foundational course selected from each focus area."
          : `${values.foundationalCourses.length}/3 distinct foundational courses selected.`,
    },
    {
      label: "Extra courses",
      status:
        values.extraCourses.length === 3
        && values.extraFocus !== ""
        && values.extraOutsideFocus.length === 0
          ? "success"
          : "error",
      detail:
        values.extraOutsideFocus.length > 0
          ? `${values.extraOutsideFocus.map((course) => course.label).join(", ")} is outside the selected focus area.`
          : `${values.extraCourses.length}/3 selected from ${focusLabel(values.extraFocus)}.`,
    },
    targetValidation(
      "Specialization electives",
      values.specializationCredits,
      CSE_SPECIALIZATION_TARGET,
      values.specializationExcessCredits > 0
        ? `${formatCredits(CSE_SPECIALIZATION_TARGET)} allocated to specialization. Additional specialization courses (${formatCredits(values.specializationExcessCredits)}) count towards the free-elective space.`
        : "Specialization courses and the optional internship total exactly 30 ECTS.",
    ),
    targetValidation(
      "Free elective space",
      values.freeSpaceTotal,
      15,
      "Additional specialization courses, free electives and homologation courses together total 15 ECTS.",
    ),
    {
      label: "Seminar",
      status: values.seminarCredits === 5 ? "success" : "error",
      detail: values.seminarCredits === 5 ? "One 5 ECTS seminar selected." : "Select one 5 ECTS seminar.",
    },
    targetValidation(
      "Graduation project",
      values.graduationCredits,
      40,
      "Preparation Graduation Project and Master Project total 40 ECTS.",
    ),
    {
      label: "Total credits",
      status: values.totalCredits >= 120 ? "success" : "error",
      detail: `${formatCredits(values.totalCredits)} / at least 120 ECTS`,
    },
  ];


  if (values.doubleCountedCourses.length > 0) {
    validations.push({
      label: "Double counting",
      status: "error",
      detail: `Duplicate course code(s): ${values.doubleCountedCourses
        .map(formatDuplicateLabel)
        .join(", ")}. The later entry was excluded from the ECTS totals.`,
    });
  }

  if (values.duplicateSpecializationCourses.length > 0) {
    validations.push({
      label: "Repeated specialization course",
      status: "error",
      detail: `${values.duplicateSpecializationCourses.map((course) => course.label).join(", ")} is selected in more than one specialization list and is counted once.`,
    });
  }

  if (values.invalidFreeRows.length > 0) {
    validations.push({
      label: "Free elective rows",
      status: "error",
      detail: "Complete the course code, title, and a positive credit value for every free-elective row.",
    });
  }

  if (
    values.invalidHomologationRows.length > 0
    || (isTrue(values.data.homologation) && values.homologationRows.length === 0)
  ) {
    validations.push({
      label: "Homologation rows",
      status: "error",
      detail: "Complete each homologation row, or turn homologation off when none is included.",
    });
  }

  if (isTrue(values.data.external_courses) && !hasText(values.data.external_justification)) {
    validations.push({
      label: "External-course links",
      status: "error",
      detail: "Add course-description links and the required motivation for external free electives.",
    });
  }

  if (isTrue(values.data.self_chosen_homologation) && !hasText(values.data.homologation_motivation)) {
    validations.push({
      label: "Homologation motivation",
      status: "error",
      detail: "Add a motivation for self-chosen homologation courses.",
    });
  }

  if (values.internshipSelected) {
    validations.push({
      label: "Internship",
      status: "success",
      detail: "2IMC10 Internship contributes 15 ECTS to specialization electives.",
    });
  }

  return validations;
}

function targetValidation(label, value, target, successDetail) {
  return exactCreditValidation(label, value, target, successDetail);
}

function buildCourseCatalog(surveyJson) {
  const catalog = new Map();
  walkElements(surveyJson.pages ?? [], (element) => {
    if (!Array.isArray(element.choices)) return;
    const questionFocus = CSE_FOCUS_AREAS.find(
      ({ value }) => element.name?.endsWith("_" + value),
    )?.value;

    for (const choice of element.choices) {
      if (!choice || typeof choice !== "object" || choice.value === undefined) continue;
      const code = normalizeCode(choice.value);
      if (!code || !/^\d[a-z0-9]+$/i.test(code)) continue;

      const current = catalog.get(code) ?? {
        code,
        label: choice.text ?? choice.value,
        focuses: new Set(),
      };
      if (questionFocus) current.focuses.add(questionFocus);
      catalog.set(code, current);
    }
  });
  return catalog;
}


function repeatedCodes(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    const code = normalizeCode(value);
    if (seen.has(code)) repeated.add(code);
    seen.add(code);
  }
  return [...repeated];
}

function makeCourse(code, questionName, choiceLookup, catalog) {
  const normalized = normalizeCode(code);
  const lookupLabel = choiceLookup.getLabel(questionName, code);
  const isRawCode = normalizeCode(lookupLabel) === normalized;
  return {
    code: normalized,
    value: String(code),
    label:
      (!isRawCode && lookupLabel)
        ? lookupLabel
        : catalog.get(normalized)?.label ?? FIXED_COURSE_LABELS[normalized] ?? String(code),
    credits: CSE_COURSE_CREDITS[normalized] ?? 5,
  };
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      const code = String(row?.code ?? "").trim();
      const name = String(row?.name ?? "").trim();
      const rawCredits = row?.credits ?? "";
      const credits = Number(String(rawCredits).replace(",", "."));
      const validCredits = code !== "" && name !== "" && Number.isFinite(credits) && credits > 0;
      return {
        code,
        normalizedCode: normalizeCode(code),
        name,
        credits: validCredits ? credits : 0,
        rawCredits,
        validCredits,
        counted: false,
        exclusionReason: validCredits ? "" : "Incomplete row or non-positive/invalid credit value.",
        rowNumber: index + 1,
      };
    })
    .filter((row) => row.code !== "" || row.name !== "" || String(row.rawCredits) !== "");
}

function processRows(rows, component, claimed, doubleCountedCourses) {
  return rows.map((row) => {
    if (!row.validCredits) return row;
    const item = {
      code: row.normalizedCode,
      value: row.code,
      label: [row.code.toUpperCase(), row.name].filter(Boolean).join(" "),
      credits: row.credits,
    };
    const counted = claim(item, component, claimed, doubleCountedCourses);
    return {
      ...row,
      counted,
      exclusionReason: counted ? "" : "Duplicate course; excluded from totals.",
    };
  });
}

function selectedValues(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function uniqueCodes(value) {
  return [...new Set(selectedValues(value).map(normalizeCode).filter(Boolean))];
}

function sumCredits(items) {
  return sumSharedCredits(items);
}

function sumCountedCourses(items) {
  return sumCredits(items.filter((item) => item.counted !== false));
}

function sumCountedRows(rows) {
  return sumCredits(rows.filter((row) => row.validCredits && row.counted));
}

function claim(item, component, claimed, doubleCountedCourses) {
  if (!item?.code) return false;
  const prior = claimed.get(item.code);
  if (prior) {
    recordDuplicate(item, component, prior, doubleCountedCourses);
    return false;
  }
  claimed.set(item.code, { component, item });
  return true;
}

function recordDuplicate(item, component, prior, doubleCountedCourses) {
  doubleCountedCourses.push({
    ...item,
    keptComponent: prior.component,
    excludedComponent: component,
    exclusionReason: `Already counted as ${prior.component}.`,
  });
}

function renameClaimedComponent(item, component, claimed) {
  if (!item?.code || !claimed.has(item.code)) return;
  claimed.set(item.code, { component, item });
}

function formatDuplicateLabel(item) {
  const label = String(item.label ?? "").trim();
  return label || item.code?.toUpperCase?.() || item.code || "";
}

function normalizeCode(value) {
  return value === undefined || value === null ? "" : String(value).replace(/\s+/g, "").toLowerCase();
}

function focusLabel(value) {
  return CSE_FOCUS_AREAS.find((area) => area.value === value)?.label ?? "the selected focus area";
}


function hasText(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function walkElements(nodes, callback) {
  for (const node of nodes) {
    callback(node);
    if (Array.isArray(node.elements)) walkElements(node.elements, callback);
    if (Array.isArray(node.templateElements)) walkElements(node.templateElements, callback);
  }
}
