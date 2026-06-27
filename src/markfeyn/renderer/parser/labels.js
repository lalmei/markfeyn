export function parseLabels(source, labels, errors, lineNumber) {
  let index = 0;
  let matched = false;

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }

    if (index >= source.length) {
      break;
    }

    const keyStart = index;

    while (index < source.length && !/[\s:]/.test(source[index])) {
      index += 1;
    }

    const key = source.slice(keyStart, index);

    if (!key) {
      errors.push(`Line ${lineNumber}: labels must use node:text pairs`);
      break;
    }

    if (source[index] !== ":") {
      errors.push(`Line ${lineNumber}: labels must use node:text pairs`);
      break;
    }

    index += 1;
    const value = readLabelValue(source, index);

    if (!value) {
      errors.push(`Line ${lineNumber}: missing label text for "${key}"`);
      break;
    }

    labels[key] = value.text;
    index = value.next;
    matched = true;
  }

  if (!matched && source) {
    errors.push(`Line ${lineNumber}: labels must use node:text pairs`);
  }
}

export function readLabelValue(source, start) {
  if (start >= source.length) {
    return null;
  }

  if (source[start] === "\"") {
    return readQuotedLabelValue(source, start, "\"");
  }

  if (source[start] === "'") {
    return readQuotedLabelValue(source, start, "'");
  }

  let index = start;
  let braceDepth = 0;

  while (index < source.length) {
    const character = source[index];

    if (character === "{") {
      braceDepth += 1;
      index += 1;
      continue;
    }

    if (character === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      index += 1;
      continue;
    }

    if (braceDepth === 0 && /\s/.test(character)) {
      break;
    }

    index += 1;
  }

  const text = source.slice(start, index);

  if (!text) {
    return null;
  }

  return {
    text,
    next: index,
  };
}

export function readQuotedLabelValue(source, start, quote) {
  let index = start + 1;
  let text = "";

  while (index < source.length) {
    const character = source[index];

    if (character === "\\" && index + 1 < source.length) {
      text += character + source[index + 1];
      index += 2;
      continue;
    }

    if (character === quote) {
      return {
        text,
        next: index + 1,
      };
    }

    text += character;
    index += 1;
  }

  return null;
}
