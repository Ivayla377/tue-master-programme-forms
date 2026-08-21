// Builds ES-specific academic validation results from calculated programme data.
import { formatCredits } from "../../shared/credit-utils.js";

export function buildEsValidations(values) {
  const { rules } = values;
  const externalCourseCodes = values.externalCourseDisplayCodes.join(", ");
  const validations = [
    {
      label: "Common mandatory courses",
      status: values.flags.commonMandatoryComplete ? "success" : "error",
      detail: values.flags.commonMandatoryComplete
        ? `The ${values.commonMandatoryCount} fixed common courses total ${formatCredits(rules.commonMandatoryCredits)}.`
        : `The fixed common courses must total ${formatCredits(rules.commonMandatoryCredits)}.`,
    },
    {
      label: "Stream selection",
      status: values.flags.hasExactlyOneStream ? "success" : "error",
      detail: values.flags.hasExactlyOneStream
        ? `One stream selected: ${values.stream.label}.`
        : `Please select one of the ${values.streamCount} ES streams.`,
    },
    {
      label: "Stream mandatory courses",
      status: values.flags.streamMandatoryComplete ? "success" : "error",
      detail: `${formatCredits(values.streamMandatory)} / exactly ${formatCredits(rules.streamMandatoryCredits)} derived from the selected stream.`,
    },
    {
      label: "Stream electives",
      status: values.flags.streamElectiveTargetMet ? "success" : "error",
      detail: values.streamElectivesExcess > 0
        ? `${formatCredits(rules.streamElectiveTarget)} fills the stream-elective requirement; the additional ${formatCredits(values.streamElectivesExcess)} counts in free-elective space.`
        : `${formatCredits(values.streamElectivesSelected)} / ${formatCredits(rules.streamElectiveTarget)} from the selected stream's electives list.`,
    },
    targetWithOverWarning(
      "Free elective space",
      values.freeElectiveSpace,
      rules.freeElectiveSpaceTarget,
      `Additional stream electives, other free electives, homologation and internship together fill ${formatCredits(rules.freeElectiveSpaceTarget)}.`,
    ),
    {
      label: "Preparation project",
      status: values.flags.preparationProjectValid ? "success" : "error",
      detail: values.flags.preparationProjectValid
        ? `${values.graduation.preparationProject.displayCode} contributes ${formatCredits(values.graduation.preparationProject.credits)}.`
        : values.graduation.preparationDetail,
    },
    {
      label: "Graduation project",
      status: values.flags.graduationProjectValid ? "success" : "error",
      detail: values.flags.graduationProjectValid
        ? `${values.graduation.graduationProject.displayCode} contributes ${formatCredits(values.graduation.graduationProject.credits)}.`
        : values.graduation.graduationDetail,
    },
    {
      label: "Graduation phase",
      status: values.flags.graduationPhaseComplete ? "success" : "error",
      detail: `${formatCredits(values.graduationPhase)} / exactly ${formatCredits(rules.graduationPhaseCredits)}.`,
    },
    targetWithOverWarning(
      "Total credits",
      values.total,
      rules.programmeTarget,
      `The program totals exactly ${formatCredits(rules.programmeTarget)}.`,
    ),
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
      detail: `${formatCredits(values.homologationCredits)} / maximum ${formatCredits(rules.homologationMaximum)} of bachelor/homologation courses.`,
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
      detail: `${values.selfChosenCount} / maximum ${rules.selfChosenHomologationMaximumCount} self-chosen bachelor courses.`,
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
      status: values.internshipAnswered ? "success" : "error",
      detail: !values.internshipAnswered
        ? "Indicate whether an internship is included."
        : values.internship.selected
        ? `The internship contributes ${formatCredits(values.internship.credits)} inside free-elective space.`
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
          ? `${externalCourseCodes} requires an external-course declaration and all supporting information.`
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
        .join(", ")} excluded because it is not on the selected stream's current PER list.`,
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

  if (values.streamElectiveCourses.some((item) =>
    values.externalCourseCodes.has(item.code))) {
    validations.push({
      label: "University of Twente secondary enrollment",
      status: "warning",
      detail: `${externalCourseCodes} is offered by the University of Twente and requires secondary enrollment there.`,
    });
  }

  const seminars = values.streamElectiveCourses.filter((item) =>
    values.seminarCodes.has(item.code));
  if (seminars.length > 0) {
    validations.push({
      label: "Seminar scheduling",
      status: "warning",
      detail: `${seminars.map((item) => item.displayCode).join(", ")} may not be taken earlier than quarter 4 of the program.`,
    });
  }

  if (values.internship.selected) {
    validations.push({
      label: "Internship supervision constraint",
      status: "warning",
      detail: "Keep in mind that an external internship requires an internal graduation project; Or after an internal internship, graduation project may not use the same supervisor.",
    });
  }

  validations.push({
    label: "Program coherence review",
    status: "warning",
    detail: "Substantive course overlap, academic level and overall program coherence require Examination Committee review and were not verified automatically.",
  });

  return validations;
}


function targetWithOverWarning(label, value, target, successDetail) {
  if (value < target) {
    return { label, status: "error", detail: `${formatCredits(value)} / ${formatCredits(target)}` };
  }
  if (value > target) {
    return {
      label,
      status: "warning",
      detail: `${formatCredits(value)} selected; ${formatCredits(target)} is the normal target and the excess requires review.`,
    };
  }
  return { label, status: "success", detail: successDetail };
}
