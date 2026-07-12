import { formatCredits } from "./credit-utils.js";

export function exactCreditValidation(label, value, target, successDetail) {
  return {
    label,
    status: value === target ? "success" : "error",
    detail: value === target ? successDetail : `${formatCredits(value)} / exactly ${formatCredits(target)}`,
  };
}

export function targetCreditValidation(label, value, target, successDetail, warnWhenOver = false) {
  if (value < target) {
    return { label, status: "error", detail: `${formatCredits(value)} / ${formatCredits(target)}` };
  }
  if (warnWhenOver && value > target) {
    return { label, status: "warning", detail: `${formatCredits(value)} selected; ${formatCredits(target)} is required.` };
  }
  if (!warnWhenOver && value !== target) {
    return { label, status: "error", detail: `${formatCredits(value)} / ${formatCredits(target)}` };
  }
  return { label, status: "success", detail: successDetail };
}

export function minimumCreditValidation(label, value, target, successDetail, warnWhenOver = false) {
  if (value < target) {
    return { label, status: "error", detail: `${formatCredits(value)} / ${formatCredits(target)}` };
  }
  if (warnWhenOver && value > target) {
    return { label, status: "warning", detail: `${formatCredits(value)} selected; ${formatCredits(target)} is required.` };
  }
  return { label, status: "success", detail: successDetail };
}
