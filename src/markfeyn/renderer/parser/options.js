import { SIZE_PRESETS } from "./constants.js";

export function parseEdgeOptions(source) {
  const options = {};

  splitOptionList(source)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const parsed = parseOptionItem(item);
      const name = normalizeOptionName(parsed.name);

      if (
        name === "hidden"
        || name === "invisible"
        || (name === "draw" && parsed.value === "none")
      ) {
        options.hidden = true;
      }

      if (name === "reverse" || name === "anti") {
        options.arrow = "reverse";
      }

      if (name === "forward") {
        options.arrow = "forward";
      }

      if (name === "overlay" || name === "foreground" || name === "front") {
        options.overlay = true;
      }

      applyCurveOption(options, name, parsed.value);

      if (name === "out") {
        const outAngle = Number(parsed.value);

        if (Number.isFinite(outAngle)) {
          options.outAngle = outAngle;
        }
      }

      if (name === "in") {
        const inAngle = Number(parsed.value);

        if (Number.isFinite(inAngle)) {
          options.inAngle = inAngle;
        }
      }

      if (name === "looseness") {
        const looseness = Number(parsed.value);

        if (Number.isFinite(looseness) && looseness > 0) {
          options.looseness = looseness;
        }
      }

      if (name === "relative") {
        options.relativeAngles = parsed.value !== "false";
      }

      if (name === "edge label" || name === "label") {
        options.label = cleanLabelValue(parsed.value);
        options.labelSide = "left";
      }

      if (name === "edge label'" || name === "label'") {
        options.label = cleanLabelValue(parsed.value);
        options.labelSide = "right";
      }

      if (name === "momentum" || name === "reversed momentum" || name === "rmomentum") {
        const momentum = parseMomentumValue(parsed.value);

        options.label = momentum.label;
        options.labelSide = "left";
        options.labelPlacement = "momentum";
        options.momentumDirection = name === "momentum" ? "forward" : "reverse";
        options.momentum = momentum.options;
      }

      if (name === "momentum'" || name === "reversed momentum'" || name === "rmomentum'") {
        const momentum = parseMomentumValue(parsed.value);

        options.label = momentum.label;
        options.labelSide = "right";
        options.labelPlacement = "momentum-prime";
        options.momentumDirection = name === "momentum'" ? "forward" : "reverse";
        options.momentum = momentum.options;
      }
    });

  return options;
}

export function parseMomentumValue(value) {
  let text = unwrapLabelValue(value);
  const options = {};
  const optionMatch = text.match(/^\[([^\]]*)\]\s*/);

  if (optionMatch) {
    Object.assign(options, parseMomentumOptions(optionMatch[1]));
    text = text.slice(optionMatch[0].length).trim();
  }

  return {
    label: cleanLabelValue(text),
    options,
  };
}

export function unwrapLabelValue(value) {
  let text = String(value || "").trim();

  if (
    (text.startsWith("{") && text.endsWith("}"))
    || (text.startsWith("\"") && text.endsWith("\""))
    || (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

export function parseMomentumOptions(source) {
  const options = {};

  splitOptionList(source)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const parsed = parseOptionItem(item);
      const name = normalizeOptionName(parsed.name);

      if (name === "arrow distance") {
        const distance = parseDistanceValue(parsed.value);

        if (Number.isFinite(distance) && distance >= 0) {
          options.arrowDistance = distance;
        }
      }

      if (name === "label distance") {
        const distance = parseDistanceValue(parsed.value);

        if (Number.isFinite(distance) && distance >= 0) {
          options.labelDistance = distance;
        }
      }

      if (name === "arrow shorten") {
        const shorten = parseFractionValue(parsed.value);

        if (Number.isFinite(shorten)) {
          options.arrowShorten = clamp(shorten, 0, 0.45);
        }
      }
    });

  return options;
}

export function parseDistanceValue(value) {
  const match = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)(px|pt|mm|cm|em)?$/i);

  if (!match) {
    return NaN;
  }

  const number = Number(match[1]);
  const unit = (match[2] || "px").toLowerCase();
  const scale = {
    px: 1,
    pt: 4 / 3,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    em: 16,
  }[unit] ?? 1;

  return number * scale;
}

export function parseFractionValue(value) {
  const text = String(value || "").trim();

  if (text.endsWith("%")) {
    return Number(text.slice(0, -1)) / 100;
  }

  return Number(text);
}

export function splitOptionList(source) {
  const items = [];
  let buffer = "";
  let braceDepth = 0;
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

    if (character === "\"") {
      quote = character;
      buffer += character;
      continue;
    }

    if (character === "{") {
      braceDepth += 1;
      buffer += character;
      continue;
    }

    if (character === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
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

    if (character === "," && braceDepth === 0 && bracketDepth === 0) {
      items.push(buffer);
      buffer = "";
      continue;
    }

    buffer += character;
  }

  if (buffer) {
    items.push(buffer);
  }

  return items;
}

export function parseOptionItem(item) {
  const separator = item.indexOf("=");

  if (separator === -1) {
    return {
      name: item.trim(),
      value: "",
    };
  }

  return {
    name: item.slice(0, separator).trim(),
    value: item.slice(separator + 1).trim(),
  };
}

export function normalizeOptionName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function applyCurveOption(options, name, value) {
  const normalizedValue = String(value || "").trim();

  if (name === "half left") {
    options.curve = { side: "left", amount: 2 / 3, shape: "semicircle" };
    return;
  }

  if (name === "half right") {
    options.curve = { side: "right", amount: 2 / 3, shape: "semicircle" };
    return;
  }

  if (name === "quarter left") {
    options.curve = { side: "left", amount: 0.28 };
    return;
  }

  if (name === "quarter right") {
    options.curve = { side: "right", amount: 0.28 };
    return;
  }

  if (name === "bend left") {
    options.curve = {
      side: "left",
      amount: bendAmountFromValue(normalizedValue),
    };
    return;
  }

  if (name === "bend right") {
    options.curve = {
      side: "right",
      amount: bendAmountFromValue(normalizedValue),
    };
  }
}

export function bendAmountFromValue(value) {
  const angle = Number(value);

  if (!Number.isFinite(angle) || angle <= 0) {
    return 0.35;
  }

  return clamp(angle / 90, 0.12, 0.8);
}

export function cleanLabelValue(value) {
  let text = String(value || "").trim();

  if (
    (text.startsWith("{") && text.endsWith("}"))
    || (text.startsWith("\"") && text.endsWith("\""))
    || (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  text = text.replace(/^\[[^\]]*\]\s*/, "");

  if (text.startsWith("\\(") && text.endsWith("\\)")) {
    text = text.slice(2, -2).trim();
  }

  return text;
}

export function parseDiagramOptions(tokens, diagram, lineNumber) {
  tokens.forEach((token) => {
    const [key, ...valueParts] = token.split("=");

    if (!valueParts.length) {
      diagram.errors.push(`Line ${lineNumber}: option "${token}" must use key=value`);
      return;
    }

    setDiagramOption(diagram, key, valueParts.join("="), lineNumber);
  });
}

export function setDiagramOption(diagram, key, value, lineNumber) {
  const normalizedKey = String(key || "").trim().toLowerCase().replace(/-/g, "_");
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    diagram.errors.push(`Line ${lineNumber}: ${key} requires a value`);
    return;
  }

  if (normalizedKey === "layout") {
    const layout = normalizeLayoutName(normalizedValue);

    if (!layout) {
      diagram.errors.push(`Line ${lineNumber}: unsupported layout "${normalizedValue}"`);
      return;
    }

    diagram.options.layout = layout;
    return;
  }

  if (normalizedKey === "orientation" || normalizedKey === "orient") {
    const orientation = normalizeOrientation(normalizedValue);

    if (!orientation) {
      diagram.errors.push(`Line ${lineNumber}: unsupported orientation "${normalizedValue}"`);
      return;
    }

    diagram.options.orientation = orientation;
    return;
  }

  if (normalizedKey === "size") {
    const size = normalizedValue.toLowerCase();

    if (!SIZE_PRESETS[size]) {
      diagram.errors.push(`Line ${lineNumber}: unsupported size "${normalizedValue}"`);
      return;
    }

    diagram.options.size = size;
    return;
  }

  if (normalizedKey === "width" || normalizedKey === "height" || normalizedKey === "margin_x" || normalizedKey === "margin_y") {
    const number = Number(normalizedValue);

    if (!Number.isFinite(number) || number <= 0) {
      diagram.errors.push(`Line ${lineNumber}: ${key} must be a positive number`);
      return;
    }

    diagram.options[normalizedKey] = number;
    return;
  }

  diagram.errors.push(`Line ${lineNumber}: unknown option "${key}"`);
}

export function normalizeLayoutName(value) {
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (normalized === "layered" || normalized === "layered layout") {
    return "layered";
  }

  if (normalized === "spring" || normalized === "spring layout") {
    return "spring";
  }

  if (
    normalized === "spring electrical"
    || normalized === "spring electrical layout"
    || normalized === "electrical"
    || normalized === "electrical layout"
  ) {
    return "spring-electrical";
  }

  if (normalized === "tree" || normalized === "tree layout") {
    return "tree";
  }

  return null;
}

export function normalizeQuality(value) {
  const normalized = String(value || "balanced").toLowerCase();

  if (normalized === "fast" || normalized === "high") {
    return normalized;
  }

  return "balanced";
}

export function normalizeOrientation(value) {
  const normalized = value.toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-").trim();

  if (normalized === "horizontal") {
    return "horizontal";
  }

  if (normalized === "horizontal'" || normalized === "horizontal-reverse" || normalized === "horizontal-flipped") {
    return "horizontal-reverse";
  }

  if (normalized === "vertical") {
    return "vertical";
  }

  if (normalized === "vertical'" || normalized === "vertical-reverse" || normalized === "vertical-flipped") {
    return "vertical-reverse";
  }

  return null;
}

export function isTikzOrientationCommand(command) {
  return command === "horizontal"
    || command === "horizontal'"
    || command === "vertical"
    || command === "vertical'";
}

export function isNodeIdentifier(value) {
  return /^[A-Za-z0-9_.-]+$/.test(String(value || ""));
}

export function normalizeTikzOrientation(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const axis = value.axis === "vertical" ? "vertical" : "horizontal";
  const from = String(value.from || "").trim();
  const to = String(value.to || "").trim();

  if (!isNodeIdentifier(from) || !isNodeIdentifier(to)) {
    return null;
  }

  return {
    axis,
    from,
    to,
    flip: Boolean(value.flip),
    angle: axis === "vertical" ? 90 : 0,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
