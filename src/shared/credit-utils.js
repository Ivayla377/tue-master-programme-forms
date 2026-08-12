// Provides shared credit formatting, summing, and boolean helpers.
export const DEFAULT_CREDITS = 5;

export function formatCredits(value) {
  const number = Number(value) || 0;
  const display = Number.isInteger(number) ? String(number) : number.toFixed(1);
  return `${display} ECTS`;
}

export function sumCredits(items) {
  return items.reduce((sum, item) => sum + (Number(item.credits) || 0), 0);
}

export function isTrue(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}
