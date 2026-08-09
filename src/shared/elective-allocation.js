/**
 * Allocates whole courses to a credit requirement in selection order.
 *
 * Programme elective lists currently contain 5 ECTS courses and their targets
 * are multiples of 5, so courses never need splitting between sections.
 */
export function allocateCoursesToTarget(courses, targetCredits) {
  const required = [];
  const excess = [];
  let allocatedCredits = 0;

  for (const course of courses) {
    const credits = Number(course?.credits) || 0;
    if (allocatedCredits + credits <= targetCredits) {
      required.push(course);
      allocatedCredits += credits;
    } else {
      excess.push(course);
    }
  }

  return {
    required,
    excess,
    requiredCredits: allocatedCredits,
    excessCredits: sumCourseCredits(excess),
  };
}

function sumCourseCredits(courses) {
  return courses.reduce(
    (total, course) => total + (Number(course?.credits) || 0),
    0,
  );
}
