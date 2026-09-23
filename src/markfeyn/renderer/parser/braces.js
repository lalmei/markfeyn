import { IDENTIFIER_SOURCE } from "./constants.js";

const BRACE_PATTERN = new RegExp(`^(${IDENTIFIER_SOURCE})->(${IDENTIFIER_SOURCE})(?:\\[([^\\]]*)\\])?:(?:"([^"]*)"|'([^']*)'|(.+))$`);

export function parseBrace(source, diagram, lineNumber) {
  const match = String(source || "").trim().match(BRACE_PATTERN);

  if (!match) {
    diagram.errors.push(`Line ${lineNumber}: braces must use "brace from->to[side]:label"`);
    return;
  }

  const side = normalizeBraceSide(match[3] || "left");

  if (!side) {
    diagram.errors.push(`Line ${lineNumber}: unsupported brace side "${match[3]}"`);
    return;
  }

  diagram.braces.push({
    from: match[1],
    to: match[2],
    side,
    label: (match[4] ?? match[5] ?? match[6] ?? "").trim(),
  });
}

export function normalizeBraceSide(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "left" || normalized === "right") {
    return normalized;
  }

  return null;
}
