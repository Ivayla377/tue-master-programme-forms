// Calculates normalized DS&AI selections, credit totals, and validation inputs.
import {
  courseFromValue,
  defaultCourseCodes,
  normalizeCourseCode,
  selectedCodes,
  selectedValues,
} from "../../shared/course-catalog.js";
import {
  normalizeManualCourseRows,
  sumCourses,
} from "../../shared/course-selection.js";
import { isTrue } from "../../shared/credit-utils.js";
import { readNumericValue } from "../../shared/survey-rules.js";
import { validationState } from "../../shared/validation-utils.js";
import {
  CORE_MANDATORY_CODES,
  PROJECT_COURSE_CODES,
  QUESTION_NAMES,
  TRAJECTORIES,
  createChoiceLookup,
  resolveDsaiRules,
} from "./form-config.js";
import {
  buildDsaiValidations,
  classifyTrajectories,
  getBlockedSpecializationByField,
} from "./rules.js";

export {
  CORE_MANDATORY_CODES,
  DEFAULT_CREDITS,
  DSAI_SURVEY_SOURCE,
  PROJECT_COURSE_CODES,
  TRAJECTORIES,
  createChoiceLookup,
} from "./form-config.js";

export function calculateEcts(
  data = {},
  choiceLookup = createChoiceLookup(),
) {
  const rules = resolveDsaiRules(data);

  function readCourse(questionName) {
    return (value) =>
      courseFromValue(
        value,
        choiceLookup,
        questionName,
        rules.standardCourseCredits,
      );
  }

  const context = { data, choiceLookup, rules, readCourse };
  const core = buildCore(context);

  const specialization = buildSpecialization(context);

  const seminar = buildSeminar(context);

  const homologation = buildHomologation(context);

  const internship = buildInternship(context);

  const graduation = buildGraduation(context);

  const freeElectives = buildFreeElectives(context);
  const freeSpaceFallback =
    freeElectives.credits + homologation.credits + internship.credits;
  const freeSpaceTotal = readNumericValue(
    data,
    "credits_free_space",
    freeSpaceFallback,
  );
  const totalFallback = sumCourses([
    core,
    specialization,
    seminar,
    { credits: freeSpaceTotal },
    graduation,
  ]);
  const totalCredits = readNumericValue(
    data,
    "credits_total",
    totalFallback,
  );
  const projectCourses = findProjectCourses(
    core,
    specialization,
    choiceLookup,
  );

  const validations = buildDsaiValidations({
    rules,
    coreTotal: core.credits,
    specializationTotal: specialization.credits,
    specializationMajor: specialization.majorCredits,
    specializationMinor: specialization.minorCredits,
    majorCandidates: specialization.majorCandidates,
    majorTrajectories: specialization.majorTrajectories,
    minorTrajectories: specialization.minorTrajectories,
    majorClassificationState: specialization.majorClassificationState,
    seminarCredits: seminar.credits,
    freeRowsCredits: freeElectives.credits,
    freeSpaceTotal,
    homologationCredits: homologation.credits,
    internshipCredits: internship.credits,
    graduationCredits: graduation.credits,
    totalCredits,
    projectCourses,
    invalidFreeRows: freeElectives.invalidRows,
  });

  return {
    rules,
    subtotals: {
      core: core.credits,
      specializationMajor: specialization.majorCredits,
      specializationMinor: specialization.minorCredits,
      specializationTotal: specialization.credits,
      seminar: seminar.credits,
      freeRows: freeElectives.credits,
      homologation: homologation.credits,
      internship: internship.credits,
      freeSpace: freeSpaceTotal,
      graduation: graduation.credits,
      total: totalCredits,
    },
    selected: {
      coreCourses: core.courses,
      coreElectiveCourse: core.elective,
      trajectories: specialization.trajectories,
      majorCandidates: specialization.majorCandidates,
      majorTrajectories: specialization.majorTrajectories,
      minorTrajectories: specialization.minorTrajectories,
      trajectoryClassifications: specialization.trajectoryClassifications,
      majorClassificationState: specialization.majorClassificationState,
      seminar: seminar.course,
      freeRows: freeElectives.rows,
      homologationCourses: homologation.courses,
      internship,
      graduationCourses: graduation.courses,
      projectCourses,
    },
    validations,
    ...validationState(validations),
  };
}

function buildCore({ data, choiceLookup, readCourse }) {
  const courses = selectedOrDefaultCodes(
    data,
    choiceLookup,
    QUESTION_NAMES.core,
    CORE_MANDATORY_CODES,
  ).map(readCourse(QUESTION_NAMES.core));
  const electiveCode = normalizeCourseCode(
    data[QUESTION_NAMES.coreElective],
  );
  const elective = electiveCode
    ? readCourse(QUESTION_NAMES.coreElective)(electiveCode)
    : null;

  const credits = readNumericValue(
    data,
    "credits_core",
    sumCourses([
      ...courses,
      ...(elective ? [elective] : []),
    ]),
  );

  return {
    courses,
    elective,
    credits,
  };
}

function buildSpecialization({ data, rules, readCourse }) {
  const trajectories = TRAJECTORIES.map((trajectory) => {
    const courses = selectedCodes(data, trajectory.name)
      .map(readCourse(trajectory.name));
    const credits = readNumericValue(
      data,
      "credits_" + trajectory.name + "_electives",
      sumCourses(courses),
    );
    return {
      ...trajectory,
      courses,
      credits,
      count: courses.length,
    };
  });
  const courses = trajectories.flatMap(
    (trajectory) => trajectory.courses,
  );
  const credits = readNumericValue(
    data,
    "credits_specialization",
    sumCourses(courses),
  );
  const classification = classifyTrajectories(
    trajectories,
    selectedValues(data[QUESTION_NAMES.majorTrajectories]),
    rules,
  );

  return {
    courses,
    trajectories,
    majorCandidates: classification.majorCandidates,
    majorTrajectories: classification.majorTrajectories,
    minorTrajectories: classification.minorTrajectories,
    trajectoryClassifications: classification.trajectoryClassifications,
    majorClassificationState: classification.state,
    credits,
    majorCredits: sumCourses(classification.majorTrajectories),
    minorCredits: sumCourses(classification.minorTrajectories),
  };
}

function buildSeminar({ data, readCourse }) {
  const value = data[QUESTION_NAMES.seminar];
  const course = value
    ? readCourse(QUESTION_NAMES.seminar)(value)
    : null;
  return {
    course,
    credits: readNumericValue(
      data,
      "credits_seminar",
      course?.credits ?? 0,
    ),
  };
}

function buildHomologation({ data, readCourse }) {
  const courses = isTrue(data.homologation)
    ? selectedValues(data[QUESTION_NAMES.homologation])
        .map(readCourse(QUESTION_NAMES.homologation))
    : [];
  return {
    courses,
    credits: readNumericValue(
      data,
      "credits_homologation",
      sumCourses(courses),
    ),
  };
}

function buildInternship({ data, choiceLookup, readCourse }) {
  const selected = isTrue(data.internship);
  const code = defaultCourseCodes(
    choiceLookup,
    QUESTION_NAMES.internshipMetadata,
    [],
  )[0];
  const course = selected && code
    ? readCourse(QUESTION_NAMES.internshipMetadata)(code)
    : null;

  return {
    selected,
    supervisor: data.internship_supervisor ?? "",
    credits: readNumericValue(
      data,
      "credits_internship",
      course?.credits ?? 0,
    ),
    course,
  };
}

function buildGraduation({ data, choiceLookup, readCourse }) {
  const courses = selectedOrDefaultCodes(
    data,
    choiceLookup,
    QUESTION_NAMES.graduation,
  ).map(readCourse(QUESTION_NAMES.graduation));
  return {
    courses,
    credits: readNumericValue(
      data,
      "credits_graduation",
      sumCourses(courses),
    ),
  };
}

function buildFreeElectives({ data }) {
  const rows = normalizeManualCourseRows(data.free, {
    titleFields: ["name", "title"],
    requireCode: false,
    requireTitle: false,
    allowZeroCredits: true,
    invalidReason: "Incomplete row or invalid credit value.",
  });
  return {
    rows,
    invalidRows: rows.filter((row) => !row.validCredits),
    credits: readNumericValue(
      data,
      "credits_free_rows",
      sumCourses(rows),
    ),
  };
}

function findProjectCourses(core, specialization, choiceLookup) {
  const projectCodes = new Set(
    defaultCourseCodes(
      choiceLookup,
      QUESTION_NAMES.projectMetadata,
      [...PROJECT_COURSE_CODES],
    ).map(normalizeCourseCode),
  );
  return [
    ...core.courses,
    ...(core.elective ? [core.elective] : []),
    ...specialization.courses,
  ].filter((course) => projectCodes.has(course.code));
}

function selectedOrDefaultCodes(
  data,
  choiceLookup,
  questionName,
  fallback = [],
) {
  const codes = Object.hasOwn(data ?? {}, questionName)
    ? selectedCodes(data, questionName)
    : defaultCourseCodes(choiceLookup, questionName, fallback);
  return codes.map(normalizeCourseCode);
}

export function removeBlockedSpecializationSelections(
  survey,
  choiceLookup = createChoiceLookup(),
) {
  const coreElectiveCode = normalizeCourseCode(
    survey.getValue(QUESTION_NAMES.coreElective),
  );
  const blockedByField = getBlockedSpecializationByField(
    coreElectiveCode,
    choiceLookup,
    TRAJECTORIES,
  );
  let changed = false;

  for (const [field, blockedCodes] of blockedByField) {
    const selected = selectedCodes(survey.data, field);
    const remaining = selected.filter(
      (code) => !blockedCodes.has(code),
    );

    if (remaining.length !== selected.length) {
      survey.setValue(field, remaining);
      changed = true;
    }
  }

  return changed;
}
