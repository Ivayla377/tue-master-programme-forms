import { createChoiceLookup } from "../../shared/course-utils.js";
import {
  formatCredits,
  isTrue,
  sumCredits as sumSharedCredits,
} from "../../shared/credit-utils.js";
import { exactCreditValidation } from "../../shared/validation-utils.js";

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
  const foundationalSelections = FOUNDATIONAL_FIELDS.map(({ focus, field }) => ({
    focus,
    field,
    code: normalizeCode(data[field]),
  })).filter((selection) => selection.code !== "");
  const foundationalCodes = uniqueCodes(foundationalSelections.map((selection) => selection.code));
  const foundationalCourses = foundationalCodes.map((code) =>
    makeCourse(code, "foundational_algorithms", choiceLookup, catalog),
  );
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
  const extraCourses = extraCodes.map((code) => makeCourse(code, extraField, choiceLookup, catalog));
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
  const specializationCourses = specializationCodes.map((code) =>
    makeCourse(code, "specialization_additional", choiceLookup, catalog),
  );

  const internshipSelected = isTrue(data.internship)
    || selectedValues(data.specialization_courses).map(normalizeCode).includes("2imc10");
  const internshipCourse = internshipSelected
    ? makeCourse("2imc10", "internship", choiceLookup, catalog)
    : null;
  const internshipCredits = internshipCourse?.credits ?? 0;

  const doubleCountedCourses = findDoubleCountedCourses([
    foundationalCourses,
    extraCourses,
    specializationCourses,
  ]);
  const duplicateSpecializationCourses = duplicateSpecializationCodes.map((code) =>
    makeCourse(code, "specialization_additional", choiceLookup, catalog),
  );

  const freeRows = normalizeRows(data.free_electives);
  const homologationRows = isTrue(data.homologation)
    ? normalizeRows(data.homologation_courses)
    : [];
  const invalidFreeRows = freeRows.filter((row) => !row.validCredits);
  const invalidHomologationRows = homologationRows.filter((row) => !row.validCredits);
  const freeCredits = sumCredits(freeRows);
  const homologationCredits = sumCredits(homologationRows);
  const freeSpaceTotal = freeCredits + homologationCredits;

  const seminar = data.seminar
    ? {
        value: String(data.seminar),
        label: choiceLookup.getLabel("seminar", data.seminar),
        credits: 5,
      }
    : null;
  const graduationCodes = data.graduation_courses === undefined
    ? ["2imc05", "2imc00"]
    : uniqueCodes(data.graduation_courses);
  const graduationCourses = graduationCodes.map((code) =>
    makeCourse(code, "graduation_courses", choiceLookup, catalog),
  );

  const foundationalCredits = sumCredits(foundationalCourses);
  const extraCredits = sumCredits(extraCourses);
  const specializationCourseCredits = sumCredits(specializationCourses);
  const specializationCredits = specializationCourseCredits + internshipCredits;
  const seminarCredits = seminar?.credits ?? 0;
  const graduationCredits = sumCredits(graduationCourses);
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
      specializationCourses: specializationCourseCredits,
      internship: internshipCredits,
      specialization: specializationCredits,
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
      },
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
          ? "One 5 ECTS course selected from each focus area."
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
      30,
      "Specialization courses and the optional internship total exactly 30 ECTS.",
    ),
    targetValidation(
      "Free elective space",
      values.freeSpaceTotal,
      15,
      "Free electives and homologation courses together total 15 ECTS.",
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
      detail: `${values.doubleCountedCourses.map((course) => course.label).join(", ")} is selected in more than one program component.`,
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

    for (const choice of element.choices) {
      if (!choice || typeof choice !== "object" || choice.value === undefined) continue;
      const code = normalizeCode(choice.value);
      if (!code || !/^\d[a-z0-9]+$/i.test(code)) continue;

      const current = catalog.get(code) ?? {
        code,
        label: choice.text ?? choice.value,
        focuses: new Set(),
      };
      const focuses = Array.isArray(choice.focus) ? choice.focus : [choice.focus];
      for (const focus of focuses) {
        if (focus) current.focuses.add(focus);
      }
      catalog.set(code, current);
    }
  });
  return catalog;
}

function findDoubleCountedCourses(groups) {
  const seen = new Set();
  const duplicates = new Map();
  for (const group of groups) {
    for (const course of group) {
      if (seen.has(course.code)) duplicates.set(course.code, course);
      seen.add(course.code);
    }
  }
  return [...duplicates.values()];
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
        name,
        credits: validCredits ? credits : 0,
        rawCredits,
        validCredits,
        rowNumber: index + 1,
      };
    })
    .filter((row) => row.code !== "" || row.name !== "" || String(row.rawCredits) !== "");
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

function normalizeCode(value) {
  return value === undefined || value === null ? "" : String(value).trim().toLowerCase();
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
