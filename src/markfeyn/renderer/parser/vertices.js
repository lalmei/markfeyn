import {
  BLOB_HATCHES,
  BLOB_VERTEX_SIZE_PRESETS,
  VERTEX_SHAPES,
} from "./constants.js";
import { splitEdgeSpecs } from "./edges.js";
import {
  normalizeOptionName,
  parseDistanceValue,
  parseOptionItem,
  splitOptionList,
  unwrapLabelValue,
} from "./options.js";

export function parseVertices(source, vertices, errors, lineNumber) {
  const specs = splitEdgeSpecs(source);

  if (!specs.length && source) {
    errors.push(`Line ${lineNumber}: vertices must use node:shape pairs`);
    return;
  }

  specs.forEach((spec) => {
    const parsed = parseVertexSpec(spec, errors, lineNumber);

    if (parsed) {
      vertices[parsed.node] = parsed.definition;
    }
  });
}

export function parseVertexSpec(spec, errors, lineNumber) {
  const separator = spec.indexOf(":");

  if (separator <= 0 || separator === spec.length - 1) {
    errors.push(`Line ${lineNumber}: vertices must use node:shape pairs`);
    return null;
  }

  const node = spec.slice(0, separator).trim();
  const rawDefinition = spec.slice(separator + 1).trim();

  if (!node || /\s/.test(node)) {
    errors.push(`Line ${lineNumber}: invalid vertex node "${node}"`);
    return null;
  }

  const definition = parseVertexDefinition(rawDefinition, errors, lineNumber);

  if (!definition) {
    return null;
  }

  return { node, definition };
}

export function parseVertexDefinition(rawDefinition, errors, lineNumber) {
  const parsed = splitVertexShapeAndOptions(rawDefinition);
  const rawShape = unwrapLabelValue(parsed.shape);
  const shape = normalizeVertexShape(rawShape);

  if (!shape) {
    errors.push(`Line ${lineNumber}: unsupported vertex shape "${rawShape}"`);
    return null;
  }

  const options = parseVertexOptions(parsed.options, errors, lineNumber);

  if (!options) {
    return null;
  }

  if (Object.keys(options).length && shape !== "blob" && shape !== "disk") {
    errors.push(`Line ${lineNumber}: vertex options are only supported for blob and disk vertices`);
    return null;
  }

  if (!Object.keys(options).length) {
    return shape;
  }

  return { shape, ...options };
}

export function splitVertexShapeAndOptions(rawDefinition) {
  const source = String(rawDefinition || "").trim();

  if (!source.endsWith("]")) {
    return { shape: source, options: "" };
  }

  let quote = null;
  let bracketDepth = 0;
  let optionStart = -1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }

    if (character === "[") {
      if (bracketDepth === 0) {
        optionStart = index;
      }

      bracketDepth += 1;
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);

      if (bracketDepth === 0 && index !== source.length - 1) {
        optionStart = -1;
      }
    }
  }

  if (optionStart === -1 || bracketDepth !== 0) {
    return { shape: source, options: "" };
  }

  return {
    shape: source.slice(0, optionStart).trim(),
    options: source.slice(optionStart + 1, -1),
  };
}

export function parseVertexOptions(source, errors, lineNumber) {
  const options = {};
  let valid = true;

  splitOptionList(source)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const parsed = parseOptionItem(item);
      const name = normalizeOptionName(parsed.name);

      if (name === "hatch" || name === "hatched" || name === "pattern") {
        const hatch = normalizeBlobHatch(parsed.value || "diagonal");

        if (!hatch) {
          errors.push(`Line ${lineNumber}: unsupported blob hatch "${parsed.value}"`);
          valid = false;
          return;
        }

        options.hatch = hatch;
        return;
      }

      if (name === "fill") {
        const normalizedValue = normalizeOptionName(unwrapLabelValue(parsed.value || "hatched"));

        if (normalizedValue === "shaded" || normalizedValue === "solid" || normalizedValue === "none") {
          return;
        }

        const hatch = normalizeBlobHatch(parsed.value || "diagonal");

        if (!hatch) {
          errors.push(`Line ${lineNumber}: unsupported blob fill "${parsed.value}"`);
          valid = false;
          return;
        }

        options.hatch = hatch;
        return;
      }

      if (name === "size" || name === "radius") {
        const size = parseBlobVertexSize(parsed.value);

        if (!Number.isFinite(size) || size <= 0) {
          errors.push(`Line ${lineNumber}: blob vertex size must be a positive number or preset`);
          valid = false;
          return;
        }

        options.size = size;
        return;
      }

      if (name === "diameter") {
        const diameter = parseBlobVertexSize(parsed.value);

        if (!Number.isFinite(diameter) || diameter <= 0) {
          errors.push(`Line ${lineNumber}: blob vertex diameter must be a positive number or preset`);
          valid = false;
          return;
        }

        options.size = diameter / 2;
        return;
      }

      if (name === "rx" || name === "x radius" || name === "radius x" || name === "horizontal radius") {
        const radius = parseBlobVertexSize(parsed.value);

        if (!Number.isFinite(radius) || radius <= 0) {
          errors.push(`Line ${lineNumber}: blob vertex x radius must be a positive number or preset`);
          valid = false;
          return;
        }

        options.rx = radius;
        return;
      }

      if (name === "ry" || name === "y radius" || name === "radius y" || name === "vertical radius") {
        const radius = parseBlobVertexSize(parsed.value);

        if (!Number.isFinite(radius) || radius <= 0) {
          errors.push(`Line ${lineNumber}: blob vertex y radius must be a positive number or preset`);
          valid = false;
          return;
        }

        options.ry = radius;
        return;
      }

      if (name === "width" || name === "minimum width" || name === "min width" || name === "x diameter" || name === "horizontal diameter") {
        const width = parseBlobVertexSize(parsed.value);

        if (!Number.isFinite(width) || width <= 0) {
          errors.push(`Line ${lineNumber}: blob vertex width must be a positive number or preset`);
          valid = false;
          return;
        }

        options.rx = width / 2;
        return;
      }

      if (name === "height" || name === "minimum height" || name === "min height" || name === "y diameter" || name === "vertical diameter") {
        const height = parseBlobVertexSize(parsed.value);

        if (!Number.isFinite(height) || height <= 0) {
          errors.push(`Line ${lineNumber}: blob vertex height must be a positive number or preset`);
          valid = false;
          return;
        }

        options.ry = height / 2;
        return;
      }

      errors.push(`Line ${lineNumber}: unknown vertex option "${parsed.name}"`);
      valid = false;
    });

  return valid ? options : null;
}

export function normalizeBlobHatch(value) {
  const normalized = normalizeOptionName(unwrapLabelValue(value));

  return BLOB_HATCHES.get(normalized) ?? null;
}

export function parseBlobVertexSize(value) {
  const normalized = normalizeOptionName(unwrapLabelValue(value));
  const preset = BLOB_VERTEX_SIZE_PRESETS.get(normalized);

  if (preset) {
    return preset;
  }

  return parseDistanceValue(unwrapLabelValue(value));
}

export function normalizeVertexShape(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");

  return VERTEX_SHAPES.get(normalized) ?? VERTEX_SHAPES.get(normalized.replace(/\s+/g, "-")) ?? null;
}
