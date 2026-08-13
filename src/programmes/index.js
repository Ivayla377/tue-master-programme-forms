// Re-exports every programme configuration from one registry module.
export { dsaiFormConfig } from "./dsai/index.js";
export { cseFormConfig } from "./cse/index.js";
export { esFormConfig } from "./es/index.js";
export { iamFormConfig } from "./iam/index.js";
export { cybrFormConfig } from "./cybr/index.js";

export const PROGRAMME_SLUGS = ["dsai", "cse", "es", "iam", "cybr"];
