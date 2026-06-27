export function parseBrace(source, diagram, lineNumber) {
  const match = String(source || "").trim().match(/^([A-Za-z0-9_.-]+)->([A-Za-z0-9_.-]+)(?:\[([^\]]*)\])?:(?:"([^"]*)"|'([^']*)'|(.+))$/);

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
