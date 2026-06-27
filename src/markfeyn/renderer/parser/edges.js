import { EDGE_DEFINITIONS } from "./constants.js";
import { parseEdgeOptions } from "./options.js";

export function matchEdgeCommand(parts) {
  const maxWords = Math.min(3, parts.length);

  for (let wordCount = maxWords; wordCount > 0; wordCount -= 1) {
    const name = parts.slice(0, wordCount).join(" ");
    const definition = EDGE_DEFINITIONS.get(name);

    if (definition) {
      return {
        name,
        words: parts.slice(0, wordCount),
        definition,
      };
    }
  }

  return null;
}

export function parseEdges(source, command, definition, diagram, lineNumber) {
  const specs = splitEdgeSpecs(source);

  if (!specs.length) {
    diagram.errors.push(`Line ${lineNumber}: ${command} requires at least one edge`);
    return;
  }

  specs.forEach((spec) => {
    const edge = parseEdgeSpec(spec, command, definition, diagram.errors, lineNumber);

    if (edge) {
      diagram.edges.push(edge);
    }
  });
}

export function parseEdgeSpec(spec, command, definition, errors, lineNumber) {
  const match = spec.match(/^([A-Za-z0-9_.-]+)->([A-Za-z0-9_.-]+)(.*)$/);

  if (!match) {
    errors.push(`Line ${lineNumber}: invalid ${command} edge "${spec}"`);
    return null;
  }

  const optionSource = parseEdgeOptionSource(match[3], spec, command, errors, lineNumber);

  if (optionSource === null) {
    return null;
  }

  return {
    ...definition,
    from: match[1],
    to: match[2],
    ...parseEdgeOptions(optionSource),
  };
}

export function parseEdgeOptionSource(rest, spec, command, errors, lineNumber) {
  const source = String(rest || "").trim();

  if (!source) {
    return "";
  }

  if (!source.startsWith("[") || !source.endsWith("]")) {
    errors.push(`Line ${lineNumber}: invalid ${command} edge "${spec}"`);
    return null;
  }

  return source.slice(1, -1);
}

export function splitEdgeSpecs(source) {
  const specs = [];
  let buffer = "";
  let bracketDepth = 0;
  let quote = null;

  for (const character of String(source || "")) {
    if (quote) {
      buffer += character;

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
      buffer += character;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
      buffer += character;
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      buffer += character;
      continue;
    }

    if (/\s/.test(character) && bracketDepth === 0) {
      if (buffer.trim()) {
        specs.push(buffer.trim());
        buffer = "";
      }

      continue;
    }

    buffer += character;
  }

  if (buffer.trim()) {
    specs.push(buffer.trim());
  }

  return specs;
}
