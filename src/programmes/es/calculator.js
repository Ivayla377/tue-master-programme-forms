import { createChoiceLookup as createSharedChoiceLookup } from "../../shared/course-utils.js";
import { formatCredits, isTrue } from "../../shared/credit-utils.js";
import { allocateCoursesToTarget } from "../../shared/elective-allocation.js";

export const STREAM_ELECTIVE_TARGET = 15;
export const FREE_ELECTIVE_TARGET = 25;
export const PROGRAMME_TARGET = 120;
export const HOMOLOGATION_MAX_CREDITS = 15;
export const SELF_CHOSEN_HOMOLOGATION_MAX_COURSES = 3;

function course(code, title, credits = 5) {
  return Object.freeze({ code, title, credits });
}

const COURSE_LIST = [
  course("2IMF30", "System Validation"),
  course("5SIA0", "Embedded Computer Architecture"),
  course("2IMN20", "Real-Time Systems"),
  course("2IMN25", "Quantitative Evaluation of Cyber Physical Systems"),
  course("5LIB0", "Embedded Systems Laboratory"),
  course("2IMF25", "Automated Reasoning"),
  course("5LIH0", "Digital Integrated Circuit Design"),
  course("5LID0", "Systems on Silicon"),
  course("5LIM0", "Parallelization, Compilers and Platforms"),
  course("2IMP30", "System Design Engineering"),
  course("2IMN10", "Architecture of Distributed Systems"),
  course("5LIC0", "Networked Embedded Systems"),
  course("2IMN15", "Internet of Things"),
  course("5LIJ0", "Embedded Control Systems"),
  course("5LIK0", "Embedded Signal Processing Systems"),
  course("5CCA0", "Semiconductor Physics and Materials"),
  course("2IMNT1", "Embedded Computer Architectures 2"),
  course("5LIG0", "Applied Combinatorial Algorithms"),
  course("5LIL0", "Intelligent Architectures"),
  course("5LIE0", "Multiprocessors"),
  course("5SIB0", "Electronic Design Automation"),
  course("5LIA0", "Embedded Visual Control"),
  course("2IMF00", "Seminar Formal System Analysis"),
  course("2DMI20", "Software Security"),
  course("2IMP10", "Program Verification Techniques"),
  course("2IMF35", "Algorithms for Model Checking"),
  course("2IMP25", "Software Evolution"),
  course("2IMP20", "Domain Specific Language Design"),
  course("2IMN00", "Seminar Interconnected Resource-aware Intelligent Systems (IRIS)"),
  course("2IMP00", "Seminar Software Engineering and Technology"),
  course("2IMS20", "Cyberattacks, Crime and Defenses"),
  course("2IMS30", "Advanced Network Security"),
  course("2IMS15", "Verification of Security Protocols"),
  course("5CSA0", "Modeling Dynamics"),
  course("2IMC05", "Preparation Graduation Project", 10),
  course("5T514", "Preparation Graduation Project ES 'Electrical Engineering'", 10),
  course("2IMC00", "Master Project", 30),
  course("5T746", "Graduation Project ES 'Electrical Engineering'", 30),
  course("2IMC10", "Internship", 15),
  course("5L990", "Internship", 15),
  course("2IMR10", "Study & Career Orientation Program (SCOP/e)", 0),
  // Present on the source form but not on the current PER stream lists. They may
  // still be proposed as free electives.
  course("5LIF0", "Advanced Digital Circuit Design"),
  course("5LIN0", "Video Processing"),
  course("5LIV0", "Video Health Monitoring"),
  course("5LIP0", "Digital Integrated Circuits: Fundamentals"),
];

export const ES_COURSE_CATALOG = Object.freeze(
  Object.fromEntries(COURSE_LIST.map((item) => [normalizeEsCode(item.code), item])),
);
export const ES_COURSES = ES_COURSE_CATALOG;

export const COMMON_MANDATORY_CODES = Object.freeze([
  "2IMF30",
  "5SIA0",
  "2IMN20",
  "2IMN25",
  "5LIB0",
]);

export const ES_STREAMS = Object.freeze([
  Object.freeze({
    value: "systems_on_chip",
    label: "Systems on Chip",
    mandatoryCodes: Object.freeze(["2IMF25", "5LIH0", "5LID0"]),
    electiveCodes: Object.freeze([
      "5CCA0", "2IMNT1", "5LIG0", "5LIL0", "5LIE0", "5LIM0", "5SIB0",
      "5LIJ0", "5LIA0", "2IMF00",
    ]),
  }),
  Object.freeze({
    value: "embedded_software",
    label: "Embedded Software",
    mandatoryCodes: Object.freeze(["2IMF25", "5LIM0", "2IMP30"]),
    electiveCodes: Object.freeze([
      "2IMN10", "2DMI20", "2IMP10", "5LIG0", "2IMF35", "2IMP25", "5LIE0",
      "5LIJ0", "5LIL0", "2IMP20", "5LIK0", "2IMF00", "2IMN00", "2IMP00",
    ]),
  }),
  Object.freeze({
    value: "embedded_networking",
    label: "Embedded Networking",
    mandatoryCodes: Object.freeze(["2IMN10", "5LIC0", "2IMN15"]),
    electiveCodes: Object.freeze([
      "2IMF25", "5LIH0", "2IMS20", "2IMS30", "2IMS15", "5SIB0", "5LIK0",
      "5LIA0", "5LID0", "2IMP30", "2IMF00", "2IMN00",
    ]),
  }),
  Object.freeze({
    value: "cyber_physical_systems",
    label: "Cyber-Physical Systems",
    mandatoryCodes: Object.freeze(["2IMN15", "5LIJ0", "5LIK0"]),
    electiveCodes: Object.freeze([
      "2IMN10", "5CSA0", "5LIC0", "5LIG0", "2IMP25", "5LIM0", "5LIE0",
      "5LIL0", "5SIB0", "5LIA0", "2IMP30", "2IMP20",
    ]),
  }),
]);

export const GRADUATION_CONTEXTS = Object.freeze([
  Object.freeze({
    value: "mcs",
    label: "Mathematics & Computer Science",
    preparationCode: "2IMC05",
    graduationCode: "2IMC00",
  }),
  Object.freeze({
    value: "ee",
    label: "Electrical Engineering",
    preparationCode: "5T514",
    graduationCode: "5T746",
  }),
]);

export const INTERNSHIP_CODES = Object.freeze(["2IMC10", "5L990"]);
export const STALE_STREAM_ELECTIVE_CODES = Object.freeze(["5LIF0", "5LIN0", "5LIV0"]);
export const PROHIBITED_COMBINATIONS = Object.freeze([
  Object.freeze({ codes: Object.freeze(["5LIH0", "5LIP0"]), source: "M&CS Master PER 2025-2026, p. 59" }),
]);

const STREAM_BY_VALUE = new Map(ES_STREAMS.map((stream) => [stream.value, stream]));
const CONTEXT_BY_VALUE = new Map(GRADUATION_CONTEXTS.map((context) => [context.value, context]));
const STREAM_FIELDS = new Map(
  ES_STREAMS.map((stream) => [stream.value, `stream_electives_${stream.value}`]),
);
const STREAM_FIELD_ALIASES = Object.freeze({
  systems_on_chip: ["systems_on_chip_electives", "soc_electives"],
  embedded_software: ["embedded_software_electives", "software_electives"],
  embedded_networking: ["embedded_networking_electives", "networking_electives"],
  cyber_physical_systems: ["cyber_physical_systems_electives", "cps_electives"],
});
const SEMINAR_CODES = new Set(["2imf00", "2imn00", "2imp00"]);

export function createEsChoiceLookup(surveyJson) {
  return createSharedChoiceLookup(surveyJson);
}

export const createChoiceLookup = createEsChoiceLookup;

export function calculateEs(data = {}, choiceLookup = createEsChoiceLookup({ pages: [] })) {
  const duplicates = [];
  const claimed = new Map();

  const commonMandatoryCourses = COMMON_MANDATORY_CODES.map((code) =>
    makeCourse(code, choiceLookup, "common_mandatory"));
  for (const item of commonMandatoryCourses) claim(item, "common mandatory", claimed, duplicates);

  const rawStreamValues = selectedValues(data.stream).map(normalizeStreamValue).filter(Boolean);
  const streamDefinition = rawStreamValues.length === 1
    ? STREAM_BY_VALUE.get(rawStreamValues[0]) ?? null
    : null;
  const stream = streamDefinition
    ? { value: streamDefinition.value, label: streamDefinition.label }
    : null;
  const streamMandatoryCourses = streamDefinition
    ? streamDefinition.mandatoryCodes.map((code) =>
      makeCourse(code, choiceLookup, "stream_mandatory_courses"))
    : [];
  for (const item of streamMandatoryCourses) claim(item, "stream mandatory", claimed, duplicates);

  const graduation = resolveGraduation(data, choiceLookup);
  if (graduation.preparationProject) {
    claim(graduation.preparationProject, "preparation project", claimed, duplicates);
  }
  if (graduation.graduationProject) {
    claim(graduation.graduationProject, "graduation project", claimed, duplicates);
  }

  const scopeRequired = requiresScopeCourse(data.personal_info?.enrollment ?? data.enrollment);
  const scopeCourse = scopeRequired
    ? { ...makeCourse("2IMR10", choiceLookup, "scope_course"), required: true }
    : null;
  if (scopeCourse) claim(scopeCourse, "SCOP/e", claimed, duplicates);

  const activeElectiveValues = streamDefinition
    ? getStreamElectiveValues(data, streamDefinition.value)
    : [];
  const staleStreamElectiveCourses = streamDefinition
    ? getStaleStreamElectiveValues(data, streamDefinition.value)
      .map((entry) => ({
        ...makeCourse(entry.value, choiceLookup, entry.field),
        sourceField: entry.field,
        counted: false,
        exclusionReason: "Selection belongs to a non-selected stream field.",
      }))
    : getAllStreamElectiveValues(data).map((entry) => ({
      ...makeCourse(entry.value, choiceLookup, entry.field),
      sourceField: entry.field,
      counted: false,
      exclusionReason: "No single valid stream is selected.",
    }));

  const authoritativeElectiveCodes = new Set(
    (streamDefinition?.electiveCodes ?? []).map(normalizeEsCode),
  );
  const streamElectiveCourses = [];
  const invalidStreamElectiveCourses = [];
  for (const value of activeElectiveValues) {
    const item = makeCourse(value, choiceLookup, STREAM_FIELDS.get(streamDefinition.value));
    if (!authoritativeElectiveCodes.has(item.code)) {
      const duplicateOf = claimed.get(item.code);
      if (duplicateOf) recordDuplicate(item, "stream elective", duplicateOf, duplicates);
      invalidStreamElectiveCourses.push({
        ...item,
        counted: false,
        exclusionReason: duplicateOf
          ? `Already counted as ${duplicateOf.component}; it is also outside the selected stream's current PER list.`
          : "Not in the selected stream's current 2025-2026 PER elective list.",
      });
      continue;
    }

    if (claim(item, "stream elective", claimed, duplicates)) {
      streamElectiveCourses.push({ ...item, counted: true, exclusionReason: "" });
    } else {
      invalidStreamElectiveCourses.push({
        ...item,
        counted: false,
        exclusionReason: "Duplicate selection; excluded from totals.",
      });
    }
  }
  const streamElectiveAllocation = allocateCoursesToTarget(
    streamElectiveCourses,
    STREAM_ELECTIVE_TARGET,
  );
  const requiredStreamElectiveCourses = streamElectiveAllocation.required;
  const excessStreamElectiveCourses = streamElectiveAllocation.excess;
  for (const item of excessStreamElectiveCourses) {
    renameClaimedComponent(
      item,
      "additional stream elective in free-elective space",
      claimed,
    );
  }

  const internship = resolveInternship(data, choiceLookup);
  if (internship.course) {
    internship.counted = claim(internship.course, "internship", claimed, duplicates);
    internship.exclusionReason = internship.counted ? "" : "Duplicate course; excluded from totals.";
  }

  const normalizedHomologation = normalizeHomologationRows(data);
  const assignedHomologationRows = processRows(
    normalizedHomologation.assigned,
    "assigned homologation",
    claimed,
    duplicates,
  );
  const selfChosenHomologationRows = processRows(
    normalizedHomologation.selfChosen,
    "self-chosen homologation",
    claimed,
    duplicates,
  );
  const homologationRows = [...assignedHomologationRows, ...selfChosenHomologationRows];
  const freeElectiveRows = processRows(
    normalizeRows(data.free_electives),
    "free elective",
    claimed,
    duplicates,
  );

  const commonMandatory = sumCourses(commonMandatoryCourses);
  const streamMandatory = sumCourses(streamMandatoryCourses);
  const streamElectivesSelected = sumCourses(streamElectiveCourses);
  const streamElectivesRequired = streamElectiveAllocation.requiredCredits;
  const streamElectivesExcess = streamElectiveAllocation.excessCredits;
  const freeElectiveRowCredits = sumCountedRows(freeElectiveRows);
  const assignedHomologationCredits = sumCountedRows(assignedHomologationRows);
  const selfChosenHomologationCredits = sumCountedRows(selfChosenHomologationRows);
  const homologationCredits = roundCredits(
    assignedHomologationCredits + selfChosenHomologationCredits,
  );
  const internshipCredits = internship.selected && internship.valid && internship.counted
    ? internship.course.credits
    : 0;
  const freeElectiveSpace = roundCredits(freeElectiveRowCredits
    + streamElectivesExcess
    + homologationCredits
    + internshipCredits);
  const preparationProjectCredits = graduation.preparationProject?.credits ?? 0;
  const graduationProjectCredits = graduation.graduationProject?.credits ?? 0;
  const graduationPhase = roundCredits(preparationProjectCredits + graduationProjectCredits);
  const mandatoryAndGraduation = roundCredits(commonMandatory + graduationPhase);
  // Every selected course contributes exactly once. The required stream
  // allocation is capped at 15 ECTS and whole excess courses move into the
  // free-elective space.
  const total = roundCredits(commonMandatory
    + streamMandatory
    + streamElectivesSelected
    + freeElectiveRowCredits
    + homologationCredits
    + internshipCredits
    + graduationPhase);

  const countedCodes = new Set(claimed.keys());
  const incompatibleCombinations = PROHIBITED_COMBINATIONS.filter(({ codes }) =>
    codes.every((code) => countedCodes.has(normalizeEsCode(code))));
  const invalidManualRows = [
    ...freeElectiveRows,
    ...homologationRows,
  ].filter((row) => !row.validCredits);
  const validHomologationCount = homologationRows.filter(
    (row) => row.validCredits && row.counted,
  ).length;
  let selfChosenCount = selfChosenHomologationRows.filter(
    (row) => row.validCredits && row.counted,
  ).length;
  if (normalizedHomologation.usesUnifiedTable) {
    selfChosenCount = normalizedHomologation.selfChosenActive
      ? validHomologationCount
      : 0;
  }
  const homologationAnswered = hasBooleanAnswer(data.homologation);
  const selfChosenAnswered = !isAffirmative(data.homologation)
    || hasBooleanAnswer(data.self_chosen_homologation);
  const internshipAnswered = hasBooleanAnswer(data.internship);
  const externalAnswered = hasBooleanAnswer(data.external_courses);
  const externalSelected = isAffirmative(data.external_courses);
  const externalCoursePresent = [
    ...streamElectiveCourses,
    ...invalidStreamElectiveCourses,
    ...freeElectiveRows,
    ...homologationRows,
  ].some((item) => normalizeEsCode(item.normalizedCode ?? item.code) === "2imnt1");
  const externalEvidenceRequired = externalSelected || externalCoursePresent;
  const externalDeclarationConsistent = !externalCoursePresent || externalSelected;
  const externalInformationComplete = !externalEvidenceRequired || (
    hasText(data.external_course_university)
    && containsHttpUrl(data.external_course_links)
    && hasText(data.external_course_motivation)
    && hasText(data.external_course_overlap)
  );
  const homologationMotivationPresent = hasText(data.homologation_motivation);
  const flags = {
    commonMandatoryComplete: commonMandatory === 25,
    hasExactlyOneStream: Boolean(streamDefinition),
    streamMandatoryComplete: streamMandatory === 15,
    streamElectiveTargetMet: streamElectivesSelected >= STREAM_ELECTIVE_TARGET,
    streamElectiveMinimumMet: streamElectivesSelected >= STREAM_ELECTIVE_TARGET,
    freeElectiveSpaceMet: freeElectiveSpace >= FREE_ELECTIVE_TARGET,
    freeElectiveSpaceOver: freeElectiveSpace > FREE_ELECTIVE_TARGET,
    graduationContextValid: graduation.contextValid,
    preparationProjectValid: graduation.preparationValid,
    graduationProjectValid: graduation.graduationValid,
    graduationPhaseComplete: graduationPhase === 40,
    homologationWithinLimit: homologationCredits <= HOMOLOGATION_MAX_CREDITS,
    selfChosenHomologationWithinLimit:
      selfChosenCount <= SELF_CHOSEN_HOMOLOGATION_MAX_COURSES,
    homologationMotivationPresent:
      !normalizedHomologation.selfChosenActive
      || (selfChosenCount > 0 && homologationMotivationPresent),
    internshipValid: !internship.selected || (internship.valid && internship.counted),
    externalInformationComplete,
    externalCoursePresent,
    externalDeclarationConsistent,
    homologationAnswered,
    selfChosenAnswered,
    internshipAnswered,
    externalAnswered,
    externalReviewRequired: externalEvidenceRequired,
    homologationReviewRequired: homologationCredits > 0,
    hasDuplicates: duplicates.length > 0,
    hasInvalidManualRows: invalidManualRows.length > 0,
    hasInvalidStreamElectives: invalidStreamElectiveCourses.length > 0,
    hasStaleStreamSelections: staleStreamElectiveCourses.length > 0,
    hasIncompatibleCourses: incompatibleCombinations.length > 0,
    totalAtLeastTarget: total >= PROGRAMME_TARGET,
    totalOverTarget: total > PROGRAMME_TARGET,
    scopeRequired,
  };

  const validations = buildValidations({
    flags,
    rawStreamValues,
    stream,
    streamMandatory,
    streamElectivesSelected,
    streamElectivesExcess,
    invalidStreamElectiveCourses,
    staleStreamElectiveCourses,
    freeElectiveSpace,
    graduation,
    graduationPhase,
    total,
    duplicates,
    incompatibleCombinations,
    invalidManualRows,
    homologationCredits,
    selfChosenCount,
    selfChosenActive: normalizedHomologation.selfChosenActive,
    homologationActive: normalizedHomologation.homologationActive,
    validHomologationCount,
    homologationAnswered,
    selfChosenAnswered,
    homologationMotivationPresent,
    internship,
    internshipAnswered,
    externalSelected,
    externalCoursePresent,
    externalEvidenceRequired,
    externalDeclarationConsistent,
    externalAnswered,
    externalInformationComplete,
    streamElectiveCourses,
  });

  return {
    subtotals: {
      commonMandatory,
      streamMandatory,
      streamElectivesSelected,
      streamElectivesRequired,
      streamElectivesExcess,
      freeElectiveRows: freeElectiveRowCredits,
      homologation: homologationCredits,
      assignedHomologation: assignedHomologationCredits,
      selfChosenHomologation: selfChosenHomologationCredits,
      internship: internshipCredits,
      freeElectiveSpace,
      preparationProject: preparationProjectCredits,
      graduationProject: graduationProjectCredits,
      graduationPhase,
      mandatoryAndGraduation,
      total,
    },
    selected: {
      commonMandatoryCourses,
      stream,
      streamMandatoryCourses,
      streamElectiveCourses,
      requiredStreamElectiveCourses,
      excessStreamElectiveCourses,
      invalidStreamElectiveCourses,
      staleStreamElectiveCourses,
      freeElectiveRows,
      assignedHomologationRows,
      selfChosenHomologationRows,
      homologationRows,
      internship,
      preparationProject: graduation.preparationProject,
      graduationProject: graduation.graduationProject,
      scopeCourse,
      duplicates,
      incompatibleCombinations,
      invalidGraduationSelections: graduation.invalidSelections,
      graduationContext: graduation.context,
    },
    flags,
    validations,
    hasErrors: validations.some((validation) => validation.status === "error"),
    hasWarnings: validations.some((validation) => validation.status === "warning"),
    isValid: validations.every((validation) => validation.status !== "error"),
    isComplete: validations.every((validation) => validation.status === "success"),
  };
}

export const calculateEcts = calculateEs;

function buildValidations(values) {
  const validations = [
    {
      label: "Common mandatory courses",
      status: values.flags.commonMandatoryComplete ? "success" : "error",
      detail: values.flags.commonMandatoryComplete
        ? "The five fixed common courses total 25 ECTS."
        : "The fixed common courses must total 25 ECTS.",
    },
    {
      label: "Stream selection",
      status: values.flags.hasExactlyOneStream ? "success" : "error",
      detail: values.flags.hasExactlyOneStream
        ? `One stream selected: ${values.stream.label}.`
        : `Please select one of the four ES streams.`,
    },
    {
      label: "Stream mandatory courses",
      status: values.flags.streamMandatoryComplete ? "success" : "error",
      detail: `${formatCredits(values.streamMandatory)} / exactly 15 ECTS derived from the selected stream.`,
    },
    {
      label: "Stream electives",
      status: values.flags.streamElectiveTargetMet ? "success" : "error",
      detail: values.streamElectivesExcess > 0
        ? `${formatCredits(STREAM_ELECTIVE_TARGET)} / ${formatCredits(STREAM_ELECTIVE_TARGET)}. Additional stream electives (${formatCredits(values.streamElectivesExcess)}) count towards the free-elective space.`
        : `${formatCredits(values.streamElectivesSelected)} / ${formatCredits(STREAM_ELECTIVE_TARGET)} from the selected stream's electives list.`,
    },
    targetWithOverWarning(
      "Free elective space",
      values.freeElectiveSpace,
      FREE_ELECTIVE_TARGET,
      "Additional stream electives, other free electives, homologation and internship together fill 25 ECTS.",
    ),
    {
      label: "Graduation department",
      status: values.flags.graduationContextValid ? "success" : "error",
      detail: values.flags.graduationContextValid
        ? `${values.graduation.context.label} course-code alternatives applied.`
        : "Select exactly one graduation department: Mathematics & Computer Science or Electrical Engineering.",
    },
    {
      label: "Preparation project",
      status: values.flags.preparationProjectValid ? "success" : "error",
      detail: values.flags.preparationProjectValid
        ? `${values.graduation.preparationProject.displayCode} contributes 10 ECTS.`
        : values.graduation.preparationDetail,
    },
    {
      label: "Graduation project",
      status: values.flags.graduationProjectValid ? "success" : "error",
      detail: values.flags.graduationProjectValid
        ? `${values.graduation.graduationProject.displayCode} contributes 30 ECTS.`
        : values.graduation.graduationDetail,
    },
    {
      label: "Graduation phase",
      status: values.flags.graduationPhaseComplete ? "success" : "error",
      detail: `${formatCredits(values.graduationPhase)} / exactly 40 ECTS.`,
    },
    targetWithOverWarning(
      "Total credits",
      values.total,
      PROGRAMME_TARGET,
      "The programme totals exactly 120 ECTS.",
    ),
    {
      label: "Double counting",
      status: values.duplicates.length === 0 ? "success" : "error",
      detail: values.duplicates.length === 0
        ? "No repeated course codes were found across counted components."
        : `Repeated course code(s): ${values.duplicates.map((item) => item.displayCode).join(", ")}. The duplicate entry was removed.`,
    },
    {
      label: "Course incompatibilities",
      status: values.incompatibleCombinations.length === 0 ? "success" : "error",
      detail: values.incompatibleCombinations.length === 0
        ? "No currently prohibited course-code combination was found."
        : values.incompatibleCombinations
          .map(({ codes }) => `${codes[0]} and ${codes[1]} may not both be included.`)
          .join(" "),
    },
    {
      label: "Manual elective rows",
      status: values.invalidManualRows.length === 0 ? "success" : "error",
      detail: values.invalidManualRows.length === 0
        ? "Every entered manual row has a code, title and finite positive credit value."
        : `${values.invalidManualRows.length} incomplete or invalid row(s) are retained for review but counted as 0 ECTS.`,
    },
    {
      label: "Homologation choice",
      status: values.homologationAnswered ? "success" : "error",
      detail: values.homologationAnswered
        ? "The homologation yes/no question was answered."
        : "Indicate whether homologation courses are included.",
    },
    {
      label: "Homologation courses",
      status: !values.homologationActive || values.validHomologationCount > 0 ? "success" : "error",
      detail: values.homologationActive
        ? values.validHomologationCount > 0
          ? `${values.validHomologationCount} valid homologation course row(s) entered.`
          : "Homologation is enabled; enter at least one complete assigned or self-chosen course row."
        : "Homologation is not enabled.",
    },
    {
      label: "Homologation maximum",
      status: values.flags.homologationWithinLimit ? "success" : "error",
      detail: `${formatCredits(values.homologationCredits)} / maximum 15 ECTS of bachelor/homologation courses.`,
    },
    {
      label: "Self-chosen homologation choice",
      status: values.selfChosenAnswered ? "success" : "error",
      detail: values.selfChosenAnswered
        ? "The self-chosen homologation yes/no question was answered when applicable."
        : "Indicate whether self-chosen bachelor courses are included.",
    },
    {
      label: "Self-chosen homologation maximum",
      status: values.flags.selfChosenHomologationWithinLimit ? "success" : "error",
      detail: `${values.selfChosenCount} / maximum ${SELF_CHOSEN_HOMOLOGATION_MAX_COURSES} self-chosen bachelor courses.`,
    },
    {
      label: "Self-chosen homologation motivation",
      status: values.selfChosenActive
        && (values.selfChosenCount === 0 || !values.homologationMotivationPresent)
        ? "error"
        : "success",
      detail: values.selfChosenActive
        ? values.selfChosenCount === 0
          ? "Enter at least one complete self-chosen bachelor course row."
          : values.homologationMotivationPresent
          ? "A motivation was provided."
          : "Provide a motivation for the self-chosen bachelor courses."
        : "No self-chosen homologation courses are active.",
    },
    {
      label: "Internship selection",
      status: values.internshipAnswered
        && (!values.internship.selected || (values.internship.valid && values.internship.counted))
        ? "success"
        : "error",
      detail: !values.internshipAnswered
        ? "Indicate whether an internship is included."
        : values.internship.selected
        ? values.internship.valid
          ? values.internship.counted
            ? `${values.internship.course.displayCode} contributes 15 ECTS inside free-elective space.`
            : `${values.internship.course.displayCode} was excluded as a duplicate and contributes 0 ECTS.`
          : "Select exactly one current internship code (2IMC10 or 5L990) and an internal/external internship type."
        : "No internship selected.",
    },
    {
      label: "External course information",
      status: values.externalAnswered
        && values.externalDeclarationConsistent
        && values.externalInformationComplete
        ? "success"
        : "error",
      detail: !values.externalAnswered
        ? "Indicate whether external-university courses are included."
        : !values.externalDeclarationConsistent
          ? "2IMNT1 is an external University of Twente course; declare external courses and provide all supporting information."
        : values.externalEvidenceRequired
        ? values.externalInformationComplete
          ? "A university, course-description link, selection motivation and non-overlap explanation were provided."
          : "External courses require the university, a course-description link, selection motivation and non-overlap explanation."
        : "No external-university courses declared.",
    },
  ];

  if (values.invalidStreamElectiveCourses.length > 0) {
    validations.push({
      label: "Stream-elective eligibility",
      status: "error",
      detail: `${values.invalidStreamElectiveCourses
        .map((item) => item.displayCode)
        .join(", ")} excluded because the selection is duplicated or is not on the selected stream's current PER list.`,
    });
  }

  if (values.staleStreamElectiveCourses.length > 0) {
    validations.push({
      label: "Stale stream selections",
      status: "warning",
      detail: `${values.staleStreamElectiveCourses.length} selection(s) from hidden/non-selected stream fields were ignored.`,
    });
  }

  if (values.homologationCredits > 0) {
    validations.push({
      label: "Homologation academic review",
      status: "warning",
      detail: "The application checked only the numeric caps; necessity, level and deficiency compensation require academic review.",
    });
  }

  if (values.externalEvidenceRequired) {
    validations.push({
      label: "External course academic review",
      status: "warning",
      detail: "External courses included - Examination Committee review required for course level and overlap.",
    });
  }

  if (values.streamElectiveCourses.some((item) => item.code === "2imnt1")) {
    validations.push({
      label: "University of Twente secondary enrollment",
      status: "warning",
      detail: "2IMNT1 is offered by the University of Twente and requires secondary enrollment there.",
    });
  }

  const seminars = values.streamElectiveCourses.filter((item) => SEMINAR_CODES.has(item.code));
  if (seminars.length > 0) {
    validations.push({
      label: "Seminar scheduling",
      status: "warning",
      detail: `${seminars.map((item) => item.displayCode).join(", ")} may not be taken earlier than quarter 4 of the programme.`,
    });
  }

  if (values.internship.selected && values.internship.valid) {
    validations.push({
      label: "Internship supervision constraint",
      status: "warning",
      detail: "Keep in mind that an external internship requires an internal graduation project; Or after an internal internship, graduation project may not use the same supervisor.",
    });
  }

  // if (values.flags.scopeRequired) {
  //   validations.push({
  //     label: "SCOP/e requirement",
  //     status: "warning",
  //     detail: "For this enrollment cohort, 2IMR10 is compulsory within the preparation project; completion cannot be verified by this form.",
  //   });
  // }

  validations.push({
    label: "Programme coherence review",
    status: "warning",
    detail: "Substantive course overlap, academic level and overall programme coherence require Examination Committee review and were not verified automatically.",
  });

  return validations;
}

function resolveGraduation(data, choiceLookup) {
  const rawContexts = selectedValues(data.graduation_context)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  const contextDefinition = rawContexts.length === 1
    ? CONTEXT_BY_VALUE.get(rawContexts[0]) ?? null
    : null;
  const context = contextDefinition
    ? { value: contextDefinition.value, label: contextDefinition.label }
    : null;
  const preparationProject = contextDefinition
    ? makeCourse(contextDefinition.preparationCode, choiceLookup, "preparation_project")
    : null;
  const graduationProject = contextDefinition
    ? makeCourse(contextDefinition.graduationCode, choiceLookup, "master_project")
    : null;
  const preparationStatus = validateExplicitAlternative(
    data,
    "preparation_project",
    contextDefinition?.preparationCode,
  );
  const graduationStatus = validateExplicitAlternative(
    data,
    "master_project",
    contextDefinition?.graduationCode,
  );

  return {
    context,
    contextValid: Boolean(contextDefinition),
    preparationProject,
    graduationProject,
    preparationValid: Boolean(contextDefinition) && preparationStatus.valid,
    graduationValid: Boolean(contextDefinition) && graduationStatus.valid,
    preparationDetail: contextDefinition
      ? preparationStatus.detail
      : "A preparation-project code can be derived only after one valid graduation department is selected.",
    graduationDetail: contextDefinition
      ? graduationStatus.detail
      : "A graduation-project code can be derived only after one valid graduation department is selected.",
    invalidSelections: [
      ...(preparationStatus.valid ? [] : preparationStatus.values.map((value) => ({ pair: "preparation", value }))),
      ...(graduationStatus.valid ? [] : graduationStatus.values.map((value) => ({ pair: "graduation", value }))),
    ],
  };
}

function validateExplicitAlternative(data, field, expectedCode) {
  if (!hasOwn(data, field)) return { valid: true, values: [], detail: "" };
  const values = selectedValues(data[field]);
  const valid = Boolean(expectedCode)
    && values.length === 1
    && normalizeEsCode(values[0]) === normalizeEsCode(expectedCode);
  return {
    valid,
    values,
    detail: valid
      ? ""
      : `Malformed ${field.replaceAll("_", " ")} data was ignored; exactly the department-mapped alternative is allowed.`,
  };
}

function resolveInternship(data, choiceLookup) {
  const selected = isAffirmative(data.internship);
  const values = selected ? selectedValues(data.internship_code) : [];
  const internshipType = String(data.internship_type ?? "").trim().toLowerCase();
  const valid = selected
    ? values.length === 1
      && INTERNSHIP_CODES.map(normalizeEsCode).includes(normalizeEsCode(values[0]))
      && ["internal", "external"].includes(internshipType)
    : true;
  const item = selected && valid
    ? makeCourse(values[0], choiceLookup, "internship_code")
    : null;
  return {
    selected,
    valid,
    code: item?.code ?? "",
    course: item,
    credits: item?.credits ?? 0,
    type: internshipType,
    supervisor: data.internship_supervisor ?? "",
    counted: false,
    exclusionReason: "",
    invalidValues: valid ? [] : values,
  };
}

function normalizeHomologationRows(data) {
  const homologationActive = isAffirmative(data.homologation);
  const selfChosenActive = homologationActive && isAffirmative(data.self_chosen_homologation);
  if (!homologationActive) {
    return {
      assigned: [],
      selfChosen: [],
      selfChosenActive: false,
      homologationActive: false,
      usesUnifiedTable: false,
    };
  }

  const genericRows = Array.isArray(data.homologation_courses) ? data.homologation_courses : [];
  const genericAssigned = genericRows.filter((row) => !isSelfChosenRow(row));
  const genericSelfChosen = genericRows.filter(isSelfChosenRow);
  const assignedSource = [
    ...(Array.isArray(data.assigned_homologation_courses)
      ? data.assigned_homologation_courses
      : []),
    ...genericAssigned,
  ];
  const selfChosenSource = [
    ...(Array.isArray(data.self_chosen_homologation_courses)
      ? data.self_chosen_homologation_courses
      : []),
    ...genericSelfChosen,
  ];

  return {
    assigned: normalizeRows(assignedSource),
    selfChosen: selfChosenActive ? normalizeRows(selfChosenSource) : [],
    selfChosenActive,
    homologationActive,
    usesUnifiedTable: genericRows.length > 0,
  };
}

function isSelfChosenRow(row) {
  const kind = String(row?.kind ?? row?.source ?? row?.type ?? "").trim().toLowerCase();
  return kind === "self_chosen" || kind === "self-chosen" || kind === "self chosen";
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      const displayCode = String(row?.code ?? "").trim();
      const normalizedCode = normalizeEsCode(displayCode);
      const title = String(row?.title ?? row?.name ?? "").trim();
      const rawCredits = row?.credits ?? "";
      const parsedCredits = parseCredits(rawCredits);
      const validCredits = normalizedCode !== "" && title !== "" && parsedCredits.valid;
      return {
        code: displayCode,
        displayCode: displayCode || normalizedCode.toUpperCase(),
        normalizedCode,
        title,
        name: title,
        credits: validCredits ? parsedCredits.value : 0,
        rawCredits,
        validCredits,
        counted: false,
        exclusionReason: validCredits ? "" : "Incomplete row or non-positive/invalid credit value.",
        rowNumber: index + 1,
      };
    })
    .filter((row) =>
      row.normalizedCode !== "" || row.title !== "" || String(row.rawCredits).trim() !== "");
}

function processRows(rows, component, claimed, duplicates) {
  return rows.map((row) => {
    if (!row.validCredits) return row;
    const item = {
      code: row.normalizedCode,
      displayCode: row.displayCode || row.normalizedCode.toUpperCase(),
      title: row.title,
      label: `${row.displayCode || row.normalizedCode.toUpperCase()} ${row.title}`,
      credits: row.credits,
    };
    const counted = claim(item, component, claimed, duplicates);
    return {
      ...row,
      counted,
      exclusionReason: counted ? "" : "Duplicate course; excluded from totals.",
    };
  });
}

function claim(item, component, claimed, duplicates) {
  if (!item?.code) return false;
  const prior = claimed.get(item.code);
  if (prior) {
    recordDuplicate(item, component, prior, duplicates);
    return false;
  }
  claimed.set(item.code, { component, item });
  return true;
}

function recordDuplicate(item, component, prior, duplicates) {
  duplicates.push({
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

function getStreamElectiveValues(data, streamValue) {
  const primary = STREAM_FIELDS.get(streamValue);
  const fields = [
    primary,
    ...(STREAM_FIELD_ALIASES[streamValue] ?? []),
    "stream_electives",
    "stream_elective_courses",
  ];
  return fields.flatMap((field) => selectedValues(data[field]));
}

function getStaleStreamElectiveValues(data, activeStream) {
  const values = [];
  for (const stream of ES_STREAMS) {
    if (stream.value === activeStream) continue;
    for (const field of [STREAM_FIELDS.get(stream.value), ...(STREAM_FIELD_ALIASES[stream.value] ?? [])]) {
      for (const value of selectedValues(data[field])) values.push({ field, value });
    }
  }
  return values;
}

function getAllStreamElectiveValues(data) {
  const values = [];
  for (const stream of ES_STREAMS) {
    for (const field of [STREAM_FIELDS.get(stream.value), ...(STREAM_FIELD_ALIASES[stream.value] ?? [])]) {
      for (const value of selectedValues(data[field])) values.push({ field, value });
    }
  }
  for (const field of ["stream_electives", "stream_elective_courses"]) {
    for (const value of selectedValues(data[field])) values.push({ field, value });
  }
  return values;
}

function makeCourse(value, choiceLookup, questionName) {
  const code = normalizeEsCode(value);
  const metadata = ES_COURSE_CATALOG[code];
  const displayCode = metadata?.code ?? String(value ?? "").replace(/\s+/g, "").toUpperCase();
  const lookupLabel = choiceLookup?.getLabel?.(questionName, value);
  const title = metadata?.title
    ?? stripCourseCode(lookupLabel, displayCode)
    ?? "Course title not available";
  return {
    value: displayCode,
    code,
    displayCode,
    title,
    label: `${displayCode} ${title}`.trim(),
    credits: metadata?.credits ?? 5,
  };
}

function stripCourseCode(label, displayCode) {
  const text = String(label ?? "").trim();
  if (!text || normalizeEsCode(text) === normalizeEsCode(displayCode)) return "";
  const escaped = displayCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`^${escaped}\\s*[-:]?\\s*`, "i"), "").trim();
}

function targetWithOverWarning(label, value, target, successDetail) {
  if (value < target) {
    return { label, status: "error", detail: `${formatCredits(value)} / ${formatCredits(target)}` };
  }
  if (value > target) {
    return {
      label,
      status: "warning",
      detail: `${formatCredits(value)} selected; ${formatCredits(target)} is the normal programme allocation and the excess requires review.`,
    };
  }
  return { label, status: "success", detail: successDetail };
}

function parseCredits(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { value: 0, valid: false };
  }
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0
    ? { value: parsed, valid: true }
    : { value: 0, valid: false };
}

function selectedValues(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null && String(item) !== "");
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function normalizeStreamValue(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeEsCode(value) {
  return value === undefined || value === null
    ? ""
    : String(value).replace(/\s+/g, "").toLowerCase();
}

export const normalizeCode = normalizeEsCode;

function sumCourses(items) {
  return roundCredits(items.reduce((total, item) => total + (Number(item?.credits) || 0), 0));
}

function sumCountedRows(rows) {
  return roundCredits(rows.reduce(
    (total, row) => total + (row.validCredits && row.counted ? row.credits : 0),
    0,
  ));
}

function roundCredits(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function hasText(value) {
  if (Array.isArray(value)) return value.some(hasText);
  if (value && typeof value === "object") return Object.values(value).some(hasText);
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function containsHttpUrl(value) {
  if (Array.isArray(value)) return value.some(containsHttpUrl);
  if (value && typeof value === "object") return Object.values(value).some(containsHttpUrl);
  return /https?:\/\/[^\s]+/i.test(String(value ?? ""));
}

function hasBooleanAnswer(value) {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return value === 0 || value === 1;
  return ["yes", "no", "true", "false", "1", "0"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function isAffirmative(value) {
  return isTrue(value) || String(value ?? "").trim().toLowerCase() === "yes";
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

export function requiresScopeCourse(enrollment) {
  const text = String(enrollment ?? "").trim();
  const yearMonth = text.match(/^((?:19|20)\d{2})[-/](0?[1-9]|1[0-2])$/);
  if (yearMonth) {
    const calendarYear = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    const academicYearStart = month >= 9 ? calendarYear : calendarYear - 1;
    return academicYearStart >= 2023;
  }
  const match = text.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return match ? Number(match[1]) >= 2023 : false;
}

/**
 * Clears hidden/stale SurveyJS state before calculation. The calculator still
 * independently excludes the same values when called directly with malformed data.
 */
export function cleanupEsSurveyState(survey) {
  if (!survey || typeof survey.getValue !== "function" || typeof survey.setValue !== "function") {
    return false;
  }
  let changed = false;
  const setIfChanged = (field, nextValue) => {
    const current = survey.getValue(field);
    if (JSON.stringify(current ?? null) === JSON.stringify(nextValue ?? null)) return;
    survey.setValue(field, nextValue);
    changed = true;
  };

  const rawStreams = selectedValues(survey.getValue("stream"))
    .map(normalizeStreamValue)
    .filter(Boolean);
  const activeStream = rawStreams.length === 1 && STREAM_BY_VALUE.has(rawStreams[0])
    ? rawStreams[0]
    : null;

  const activeAllowed = new Set(
    (STREAM_BY_VALUE.get(activeStream)?.electiveCodes ?? []).map(normalizeEsCode),
  );
  const activeSeen = new Set();
  const filterActiveField = (field) => {
    const current = selectedValues(survey.getValue(field));
    const filtered = current.filter((value) => {
      const code = normalizeEsCode(value);
      if (!activeAllowed.has(code) || activeSeen.has(code)) return false;
      activeSeen.add(code);
      return true;
    });
    if (JSON.stringify(filtered) !== JSON.stringify(current)) setIfChanged(field, filtered);
  };

  for (const stream of ES_STREAMS) {
    const fields = [STREAM_FIELDS.get(stream.value), ...(STREAM_FIELD_ALIASES[stream.value] ?? [])];
    for (const field of fields) {
      if (stream.value === activeStream) {
        filterActiveField(field);
      } else if (selectedValues(survey.getValue(field)).length > 0) {
        setIfChanged(field, []);
      }
    }
  }
  for (const field of ["stream_electives", "stream_elective_courses"]) {
    if (activeStream) filterActiveField(field);
    else if (selectedValues(survey.getValue(field)).length > 0) setIfChanged(field, []);
  }

  if (!isAffirmative(survey.getValue("homologation"))) {
    setIfChanged("assigned_homologation_courses", []);
    setIfChanged("self_chosen_homologation_courses", []);
    setIfChanged("homologation_courses", []);
    if (survey.getValue("self_chosen_homologation") !== undefined) {
      setIfChanged("self_chosen_homologation", false);
    }
    if (hasText(survey.getValue("homologation_motivation"))) {
      setIfChanged("homologation_motivation", "");
    }
  } else if (!isAffirmative(survey.getValue("self_chosen_homologation"))) {
    setIfChanged("self_chosen_homologation_courses", []);
    if (hasText(survey.getValue("homologation_motivation"))) {
      setIfChanged("homologation_motivation", "");
    }
  }

  if (!isAffirmative(survey.getValue("internship"))) {
    for (const field of ["internship_code", "internship_type", "internship_supervisor"]) {
      if (hasText(survey.getValue(field))) setIfChanged(field, "");
    }
  }

  if (!isAffirmative(survey.getValue("external_courses")) && !activeSeen.has("2imnt1")) {
    for (const field of [
      "external_course_university",
      "external_course_links",
      "external_course_motivation",
      "external_course_overlap",
    ]) {
      if (hasText(survey.getValue(field))) setIfChanged(field, "");
    }
  }

  return changed;
}

export const beforeCalculateEs = cleanupEsSurveyState;
export const beforeCalculate = cleanupEsSurveyState;
export const synchronizeEsSurvey = cleanupEsSurveyState;
