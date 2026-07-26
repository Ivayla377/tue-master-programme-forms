export const COURSE_CHOICE_CREDITS_PROPERTY = "credits";

export function registerCourseChoiceMetadata(Serializer) {
  if (
    !Serializer
    || typeof Serializer.findProperty !== "function"
    || typeof Serializer.addProperty !== "function"
  ) {
    return;
  }

  if (
    Serializer.findProperty(
      "itemvalue",
      COURSE_CHOICE_CREDITS_PROPERTY,
    )
  ) {
    return;
  }

  Serializer.addProperty("itemvalue", {
    name: `${COURSE_CHOICE_CREDITS_PROPERTY}:number`,
    displayName: "ECTS",
    minValue: 0,
    locationInTable: "both",
  });
}
