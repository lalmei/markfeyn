const LATEX_SYMBOLS = new Map(Object.entries({
  alpha: "\u03b1",
  beta: "\u03b2",
  gamma: "\u03b3",
  delta: "\u03b4",
  epsilon: "\u03b5",
  varepsilon: "\u03b5",
  zeta: "\u03b6",
  eta: "\u03b7",
  theta: "\u03b8",
  vartheta: "\u03d1",
  iota: "\u03b9",
  kappa: "\u03ba",
  lambda: "\u03bb",
  mu: "\u03bc",
  nu: "\u03bd",
  xi: "\u03be",
  pi: "\u03c0",
  varpi: "\u03d6",
  rho: "\u03c1",
  varrho: "\u03f1",
  sigma: "\u03c3",
  varsigma: "\u03c2",
  tau: "\u03c4",
  upsilon: "\u03c5",
  phi: "\u03c6",
  varphi: "\u03d5",
  chi: "\u03c7",
  psi: "\u03c8",
  omega: "\u03c9",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039b",
  Xi: "\u039e",
  Pi: "\u03a0",
  Sigma: "\u03a3",
  Upsilon: "\u03a5",
  Phi: "\u03a6",
  Psi: "\u03a8",
  Omega: "\u03a9",
  ell: "\u2113",
  hbar: "\u210f",
  pm: "\u00b1",
  mp: "\u2213",
  times: "\u00d7",
  cdot: "\u00b7",
  to: "\u2192",
  rightarrow: "\u2192",
  leftarrow: "\u2190",
  leftrightarrow: "\u2194",
  infty: "\u221e",
  partial: "\u2202",
}));
const LATEX_ESCAPES = new Map([
  ["\\", "\\"],
  ["^", "^"],
  ["_", "_"],
  ["{", "{"],
  ["}", "}"],
]);
const UNICODE_SUPERSCRIPTS = new Map([
  ["⁺", "+"],
  ["⁻", "-"],
  ["⁰", "0"],
  ["¹", "1"],
  ["²", "2"],
  ["³", "3"],
  ["⁴", "4"],
  ["⁵", "5"],
  ["⁶", "6"],
  ["⁷", "7"],
  ["⁸", "8"],
  ["⁹", "9"],
]);
const UNICODE_SUBSCRIPTS = new Map([
  ["₊", "+"],
  ["₋", "-"],
  ["₀", "0"],
  ["₁", "1"],
  ["₂", "2"],
  ["₃", "3"],
  ["₄", "4"],
  ["₅", "5"],
  ["₆", "6"],
  ["₇", "7"],
  ["₈", "8"],
  ["₉", "9"],
]);
const MATHJAX_COMPLEX_COMMANDS = /\\(frac|sqrt|sum|prod|int|oint|text|mathbf|mathrm|mathcal|mathbb|hat|tilde|vec|begin)\b/;

export function labelNeedsMathJax(source) {
  const input = String(source ?? "");

  if (!input.includes("\\")) {
    return false;
  }

  if (MATHJAX_COMPLEX_COMMANDS.test(input)) {
    return true;
  }

  let index = 0;

  while (index < input.length) {
    if (input[index] === "_" || input[index] === "^") {
      const script = rawScriptArgument(input, index + 1);

      if (script && script.text.includes("\\")) {
        const commands = script.text.match(/\\[A-Za-z]+/g) || [];
        const plain = script.text.replace(/\\[A-Za-z]+/g, "").trim();

        if (commands.length > 1 || (commands.length === 1 && plain.length > 0)) {
          return true;
        }

        if (commands.length === 1 && !LATEX_SYMBOLS.has(commands[0].slice(1))) {
          return true;
        }
      }

      index = script ? script.next : index + 1;
      continue;
    }

    if (input[index] === "\\") {
      const command = readLatexCommand(input, index);
      const nameMatch = input.slice(index + 1, command.next).match(/^[A-Za-z]+/);

      if (nameMatch && !LATEX_SYMBOLS.has(nameMatch[0]) && nameMatch[0] !== "overline" && nameMatch[0] !== "bar") {
        return true;
      }

      index = command.next;
      continue;
    }

    index += 1;
  }

  return false;
}

export function labelSegmentText(segment) {
  if (segment.kind === "normal") {
    return segment.text;
  }

  return segment.text.replace(/-/g, "−");
}

export function parseLabelMarkup(source) {
  const input = String(source ?? "");
  const segments = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (!buffer) {
      return;
    }

    pushLabelSegment(segments, "normal", buffer);
    buffer = "";
  };

  while (index < input.length) {
    const character = input[index];

    if (character === "\\") {
      const overline = readOverlineCommand(input, index);

      if (overline) {
        flush();
        pushLabelSegment(segments, "normal", labelMarkupToText(overline.text), { overline: true });
        index = overline.next;
        continue;
      }

      const command = readLatexCommand(input, index);
      buffer += command.text;
      index = command.next;
      continue;
    }

    if (UNICODE_SUPERSCRIPTS.has(character)) {
      flush();
      pushLabelSegment(segments, "sup", UNICODE_SUPERSCRIPTS.get(character));
      index += 1;
      continue;
    }

    if (UNICODE_SUBSCRIPTS.has(character)) {
      flush();
      pushLabelSegment(segments, "sub", UNICODE_SUBSCRIPTS.get(character));
      index += 1;
      continue;
    }

    if (character === "^" || character === "_") {
      const script = readScriptArgument(input, index + 1);

      if (!script) {
        buffer += character;
        index += 1;
        continue;
      }

      flush();
      pushLabelSegment(
        segments,
        character === "^" ? "sup" : "sub",
        labelMarkupToText(script.text)
      );
      index = script.next;
      continue;
    }

    buffer += character;
    index += 1;
  }

  flush();
  return segments;
}

export function labelMarkupToText(source) {
  return parseLabelMarkup(source).map((segment) => segment.text).join("");
}

function pushLabelSegment(segments, kind, text, options = {}) {
  if (!text) {
    return;
  }

  const previous = segments[segments.length - 1];
  if (
    previous
    && previous.kind === kind
    && Boolean(previous.overline) === Boolean(options.overline)
  ) {
    previous.text += text;
    return;
  }

  segments.push({ kind, text, ...options });
}

function readOverlineCommand(input, start) {
  if (!input.startsWith("\\overline", start) && !input.startsWith("\\bar", start)) {
    return null;
  }

  const commandLength = input.startsWith("\\overline", start) ? "\\overline".length : "\\bar".length;
  const argument = readScriptArgument(input, start + commandLength);

  if (!argument) {
    return null;
  }

  return argument;
}

function readLatexCommand(input, start) {
  let index = start + 1;

  if (index >= input.length) {
    return { text: "\\", next: index };
  }

  if (/[A-Za-z]/.test(input[index])) {
    while (index < input.length && /[A-Za-z]/.test(input[index])) {
      index += 1;
    }

    const command = input.slice(start + 1, index);
    return {
      text: LATEX_SYMBOLS.get(command) ?? `\\${command}`,
      next: index,
    };
  }

  const escaped = LATEX_ESCAPES.get(input[index]);
  return {
    text: escaped ?? input[index],
    next: index + 1,
  };
}

function readScriptArgument(input, start) {
  if (start >= input.length) {
    return null;
  }

  if (input[start] === "{") {
    return readBracedScriptArgument(input, start);
  }

  if (input[start] === "\\") {
    const command = readLatexCommand(input, start);
    return {
      text: command.text,
      next: command.next,
    };
  }

  return {
    text: input[start],
    next: start + 1,
  };
}

function rawScriptArgument(input, start) {
  if (start >= input.length) {
    return null;
  }

  if (input[start] === "{") {
    return readRawBracedScriptArgument(input, start);
  }

  if (input[start] === "\\") {
    const command = readLatexCommand(input, start);
    return {
      text: input.slice(start, command.next),
      next: command.next,
    };
  }

  return {
    text: input[start],
    next: start + 1,
  };
}

function readRawBracedScriptArgument(input, start) {
  let depth = 0;
  let text = "";

  for (let index = start; index < input.length; index += 1) {
    const character = input[index];

    if (character === "{") {
      depth += 1;

      if (depth > 1) {
        text += character;
      }

      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          text,
          next: index + 1,
        };
      }

      text += character;
      continue;
    }

    text += character;
  }

  return null;
}

function readBracedScriptArgument(input, start) {
  let depth = 0;
  let text = "";

  for (let index = start; index < input.length; index += 1) {
    const character = input[index];

    if (character === "\\") {
      const command = readLatexCommand(input, index);
      text += command.text;
      index = command.next - 1;
      continue;
    }

    if (character === "{") {
      depth += 1;

      if (depth > 1) {
        text += character;
      }

      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          text,
          next: index + 1,
        };
      }

      text += character;
      continue;
    }

    text += character;
  }

  return null;
}
