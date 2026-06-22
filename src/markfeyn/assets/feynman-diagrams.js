(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const EDGE_DEFINITIONS = new Map([
    ["plain", { type: "plain" }],
    ["line", { type: "plain" }],
    ["propagator", { type: "plain" }],
    ["fermion", { type: "fermion", arrow: "forward" }],
    ["anti fermion", { type: "fermion", arrow: "reverse" }],
    ["anti-fermion", { type: "fermion", arrow: "reverse" }],
    ["antifermion", { type: "fermion", arrow: "reverse" }],
    ["photon", { type: "photon" }],
    ["boson", { type: "photon" }],
    ["charged boson", { type: "photon", arrow: "forward" }],
    ["charged-boson", { type: "photon", arrow: "forward" }],
    ["anti charged boson", { type: "photon", arrow: "reverse" }],
    ["anti-charged-boson", { type: "photon", arrow: "reverse" }],
    ["gluon", { type: "gluon" }],
    ["scalar", { type: "scalar" }],
    ["charged scalar", { type: "scalar", arrow: "forward" }],
    ["charged-scalar", { type: "scalar", arrow: "forward" }],
    ["anti charged scalar", { type: "scalar", arrow: "reverse" }],
    ["anti-charged-scalar", { type: "scalar", arrow: "reverse" }],
    ["ghost", { type: "ghost" }],
    ["invisible", { type: "invisible", hidden: true }],
    ["hidden", { type: "invisible", hidden: true }],
  ]);
  const SIZE_PRESETS = {
    small: { width: 420, minHeight: 280, marginX: 70, marginY: 46, externalGap: 82 },
    medium: { width: 520, minHeight: 330, marginX: 82, marginY: 52, externalGap: 100 },
    large: { width: 760, minHeight: 480, marginX: 110, marginY: 70, externalGap: 140 },
  };
  const DEFAULT_DIAGRAM_OPTIONS = {
    layout: "spring",
    orientation: "horizontal",
    size: "medium",
  };
  const VISUAL_DEFAULTS = Object.freeze({
    edgeStrokeWidth: 2.6,
    gluonStrokeWidth: 2.1,
    vertexStrokeWidth: 2.3,
    blobStrokeWidth: 2.8,
    vertexMarkStrokeWidth: 2.4,
    labelFontSize: 32,
    edgeLabelFontSize: 26,
    labelFontFamily: "\"Latin Modern Math\", \"Latin Modern Roman\", \"Computer Modern Serif\", \"CMU Serif\", \"STIX Two Text\", \"Times New Roman\", serif",
    labelFontStyle: "italic",
    scriptFontSizePercent: 82,
    labelHorizontalOffset: 20,
    labelTopOffset: 24,
    labelBottomOffset: 30,
    edgeLabelOffset: 32,
    momentumArrowOffset: 19,
    momentumLabelGap: 20,
    momentumArrowShorten: 0.22,
    momentumArrowStrokeWidth: 1.4,
    momentumArrowHeadLength: 8,
    momentumArrowHeadWidth: 7,
    arrowMarkerWidth: 11,
    arrowMarkerHeight: 11,
    arrowMarkerRefX: 7,
    arrowMarkerRefY: 4,
    arrowPath: "M0,0 L8,4 L0,8 Z",
  });
  const TEX_BRACE_METRICS = Object.freeze({
    centerX: 4.4234125,
    topMinY: 0.009963,
    bottomMaxY: 8.956413,
    topAdvance: 8.966467,
    extenderAdvance: 2.988822,
    middleAdvance: 17.932934,
    baseHeight: 35.855814,
    targetScale: 1.45,
  });
  const BRACE_LABEL_PADDING = VISUAL_DEFAULTS.labelFontSize * 0.68;
  const BRACE_SIDE_GAP = VISUAL_DEFAULTS.labelHorizontalOffset + 34;
  const TEX_BRACE_PATHS = Object.freeze({
    left: {
      top: "M5.021171 4.513076C5.021171 3.696139 5.240349 1.793275 7.013699 .537983C7.143213 .438356 7.153176 .428394 7.153176 .249066C7.153176 .019925 7.143213 .009963 6.894147 .009963H6.734745C4.592777 1.165629 3.825654 3.048568 3.825654 4.513076V8.797011C3.825654 9.05604 3.835616 9.066002 4.104608 9.066002H4.742217C5.011208 9.066002 5.021171 9.05604 5.021171 8.797011V4.513076Z",
      middle: "M3.825654 17.763387C3.825654 18.022416 3.835616 18.032379 4.104608 18.032379H4.742217C5.011208 18.032379 5.021171 18.022416 5.021171 17.763387V13.559153C5.021171 12.353674 4.513076 10.321295 2.281445 8.966376C4.533001 7.601494 5.021171 5.549191 5.021171 4.373599V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.383562C3.825654 5.220423 3.646326 7.292653 1.8132 8.687422C1.703611 8.777086 1.693649 8.787049 1.693649 8.966376S1.703611 9.155666 1.8132 9.24533C2.072229 9.444583 2.759651 9.972603 3.237858 10.978829C3.626401 11.775841 3.825654 12.662516 3.825654 13.549191V17.763387Z",
      bottom: "M6.894147 8.956413C7.143213 8.956413 7.153176 8.946451 7.153176 8.71731C7.153176 8.537983 7.143213 8.52802 7.103362 8.498132C6.794521 8.268991 6.07721 7.760897 5.608966 6.844334C5.220423 6.087173 5.021171 5.32005 5.021171 4.4533V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.4533C3.825654 5.927771 4.592777 7.81071 6.734745 8.956413H6.894147Z",
    },
    right: {
      top: "M3.825654 8.797011C3.825654 9.05604 3.835616 9.066002 4.104608 9.066002H4.742217C5.011208 9.066002 5.021171 9.05604 5.021171 8.797011V4.513076C5.021171 3.048568 4.254047 1.165629 2.11208 .009963H1.96264C1.703611 .009963 1.693649 .019925 1.693649 .249066C1.693649 .428394 1.703611 .438356 1.743462 .468244C2.052304 .697385 2.769614 1.205479 3.237858 2.122042C3.506849 2.660025 3.825654 3.437111 3.825654 4.513076V8.797011Z",
      middle: "M5.021171 13.549191C5.021171 12.712329 5.200498 10.6401 7.033624 9.24533C7.143213 9.155666 7.153176 9.145704 7.153176 8.966376S7.143213 8.777086 7.033624 8.687422C6.774595 8.488169 6.087173 7.960149 5.608966 6.953923C5.220423 6.156912 5.021171 5.270237 5.021171 4.383562V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.373599C3.825654 5.579078 4.333748 7.611457 6.56538 8.966376C4.313823 10.331258 3.825654 12.383562 3.825654 13.559153V17.763387C3.825654 18.022416 3.835616 18.032379 4.104608 18.032379H4.742217C5.011208 18.032379 5.021171 18.022416 5.021171 17.763387V13.549191Z",
      bottom: "M3.825654 4.4533C3.825654 5.32005 3.58655 7.193026 1.833126 8.428394C1.703611 8.52802 1.693649 8.537983 1.693649 8.71731C1.693649 8.946451 1.703611 8.956413 1.96264 8.956413H2.11208C4.26401 7.800747 5.021171 5.917808 5.021171 4.4533V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.4533Z",
    },
    extender: "M5.021171 .169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V2.819427C3.825654 3.078456 3.835616 3.088418 4.104608 3.088418H4.742217C5.011208 3.088418 5.021171 3.078456 5.021171 2.819427V.169365Z",
  });
  const VERTEX_SHAPES = new Map([
    ["dot", "dot"],
    ["square dot", "square-dot"],
    ["square-dot", "square-dot"],
    ["square", "square-dot"],
    ["empty dot", "empty-dot"],
    ["empty-dot", "empty-dot"],
    ["crossed dot", "crossed-dot"],
    ["crossed-dot", "crossed-dot"],
    ["cross dot", "crossed-dot"],
    ["cross-dot", "crossed-dot"],
    ["cross", "cross"],
    ["blob", "blob"],
    ["disk", "disk"],
    ["large blob", "disk"],
    ["large-blob", "disk"],
  ]);
  const LATEX_SYMBOLS = new Map(Object.entries({
    alpha: "\u03b1",
    beta: "\u03b2",
    gamma: "\u03b3",
    delta: "\u03b4",
    epsilon: "\u03b5",
    varepsilon: "\u03f5",
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
    rho: "\u03c1",
    sigma: "\u03c3",
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
    partial: "\u2202",
    nabla: "\u2207",
    infty: "\u221e",
    pm: "\u00b1",
    mp: "\u2213",
    times: "\u00d7",
    cdot: "\u22c5",
    to: "\u2192",
    rightarrow: "\u2192",
    leftarrow: "\u2190",
    le: "\u2264",
    ge: "\u2265",
    neq: "\u2260",
    prime: "\u2032",
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
  let diagramSerial = 0;

  function parseFeynman(source) {
    const diagram = {
      incoming: [],
      outgoing: [],
      edges: [],
      labels: {},
      braces: [],
      manualPositions: {},
      vertices: {},
      options: { ...DEFAULT_DIAGRAM_OPTIONS },
      errors: [],
    };

    String(source || "")
      .split(/\r?\n/)
      .forEach((rawLine, index) => {
        const lineNumber = index + 1;
        const line = rawLine.trim();

        if (!line || line.startsWith("#")) {
          return;
        }

        const parts = line.split(/\s+/);
        const command = parts[0];
        const rest = parts.slice(1);

        if (command === "incoming") {
          diagram.incoming.push(...rest);
          return;
        }

        if (command === "outgoing") {
          diagram.outgoing.push(...rest);
          return;
        }

        if (command === "layout") {
          setDiagramOption(diagram, "layout", rest.join(" "), lineNumber);
          return;
        }

        if (command === "orientation" || command === "orient") {
          setDiagramOption(diagram, "orientation", rest.join(" "), lineNumber);
          return;
        }

        if (command === "size") {
          setDiagramOption(diagram, "size", rest[0], lineNumber);
          return;
        }

        if (command === "options" || command === "option") {
          parseDiagramOptions(rest, diagram, lineNumber);
          return;
        }

        if (command === "position" || command === "at") {
          parseManualPosition(rest, diagram, lineNumber);
          return;
        }

        if (command === "label") {
          parseLabels(line.slice(command.length).trim(), diagram.labels, diagram.errors, lineNumber);
          return;
        }

        if (command === "brace") {
          parseBrace(line.slice(command.length).trim(), diagram, lineNumber);
          return;
        }

        if (command === "vertex" || command === "vertices") {
          parseVertices(line.slice(command.length).trim(), diagram.vertices, diagram.errors, lineNumber);
          return;
        }

        const edgeCommand = matchEdgeCommand(parts);

        if (edgeCommand) {
          parseEdges(
            line.slice(edgeCommand.words.join(" ").length).trim(),
            edgeCommand.name,
            edgeCommand.definition,
            diagram,
            lineNumber
          );
          return;
        }

        diagram.errors.push(`Line ${lineNumber}: unknown command "${command}"`);
      });

    return diagram;
  }

  function matchEdgeCommand(parts) {
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

  function parseEdges(source, command, definition, diagram, lineNumber) {
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

  function parseEdgeSpec(spec, command, definition, errors, lineNumber) {
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

  function parseEdgeOptionSource(rest, spec, command, errors, lineNumber) {
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

  function splitEdgeSpecs(source) {
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

      if (character === "\"") {
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

  function parseEdgeOptions(source) {
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

  function parseMomentumValue(value) {
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

  function unwrapLabelValue(value) {
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

  function parseMomentumOptions(source) {
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

  function parseDistanceValue(value) {
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

  function parseFractionValue(value) {
    const text = String(value || "").trim();

    if (text.endsWith("%")) {
      return Number(text.slice(0, -1)) / 100;
    }

    return Number(text);
  }

  function splitOptionList(source) {
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

  function parseOptionItem(item) {
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

  function normalizeOptionName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function applyCurveOption(options, name, value) {
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

  function bendAmountFromValue(value) {
    const angle = Number(value);

    if (!Number.isFinite(angle) || angle <= 0) {
      return 0.35;
    }

    return clamp(angle / 90, 0.12, 0.8);
  }

  function cleanLabelValue(value) {
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

  function parseDiagramOptions(tokens, diagram, lineNumber) {
    tokens.forEach((token) => {
      const [key, ...valueParts] = token.split("=");

      if (!valueParts.length) {
        diagram.errors.push(`Line ${lineNumber}: option "${token}" must use key=value`);
        return;
      }

      setDiagramOption(diagram, key, valueParts.join("="), lineNumber);
    });
  }

  function setDiagramOption(diagram, key, value, lineNumber) {
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

  function normalizeLayoutName(value) {
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

  function normalizeOrientation(value) {
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

  function parseManualPosition(parts, diagram, lineNumber) {
    if (parts.length !== 3) {
      diagram.errors.push(`Line ${lineNumber}: position must use "position node x y"`);
      return;
    }

    const [node, rawX, rawY] = parts;
    const x = Number(rawX);
    const y = Number(rawY);

    if (!node || !Number.isFinite(x) || !Number.isFinite(y)) {
      diagram.errors.push(`Line ${lineNumber}: position coordinates must be numbers`);
      return;
    }

    diagram.manualPositions[node] = { x, y };
  }

  function parseLabels(source, labels, errors, lineNumber) {
    const pattern = /([^\s:]+):(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let match;
    let matched = false;

    while ((match = pattern.exec(source)) !== null) {
      matched = true;
      labels[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
    }

    if (!matched && source) {
      errors.push(`Line ${lineNumber}: labels must use node:text pairs`);
    }
  }

  function parseVertices(source, vertices, errors, lineNumber) {
    const pattern = /([^\s:]+):(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let match;
    let matched = false;

    while ((match = pattern.exec(source)) !== null) {
      matched = true;
      const node = match[1];
      const rawShape = match[2] ?? match[3] ?? match[4] ?? "";
      const shape = normalizeVertexShape(rawShape);

      if (!shape) {
        errors.push(`Line ${lineNumber}: unsupported vertex shape "${rawShape}"`);
        continue;
      }

      vertices[node] = shape;
    }

    if (!matched && source) {
      errors.push(`Line ${lineNumber}: vertices must use node:shape pairs`);
    }
  }

  function normalizeVertexShape(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, " ");

    return VERTEX_SHAPES.get(normalized) ?? VERTEX_SHAPES.get(normalized.replace(/\s+/g, "-")) ?? null;
  }

  function parseBrace(source, diagram, lineNumber) {
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
      label: cleanLabelValue(match[4] ?? match[5] ?? match[6] ?? ""),
    });
  }

  function normalizeBraceSide(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "left" || normalized === "right" || normalized === "top" || normalized === "bottom") {
      return normalized;
    }

    return null;
  }

  function layoutFeynman(diagram, options) {
    const layoutOptions = resolveLayoutOptions(diagram, options);

    if (layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical") {
      return layoutSpring(diagram, layoutOptions, {
        electrical: layoutOptions.layout === "spring-electrical",
      });
    }

    if (layoutOptions.layout === "tree") {
      return layoutTree(diagram, layoutOptions);
    }

    return layoutLayered(diagram, layoutOptions);
  }

  function resolveLayoutOptions(diagram, options) {
    const merged = {
      ...DEFAULT_DIAGRAM_OPTIONS,
      ...(diagram.options || {}),
      ...(options || {}),
    };
    const size = SIZE_PRESETS[merged.size] || SIZE_PRESETS.medium;
    const incomingCount = Math.max(diagram.incoming.length, 1);
    const outgoingCount = Math.max(diagram.outgoing.length, 1);
    const orientation = normalizeOrientation(merged.orientation) || DEFAULT_DIAGRAM_OPTIONS.orientation;
    const stacked = orientation.startsWith("vertical");
    const width = merged.width ?? (stacked ? size.minHeight : size.width);
    const defaultHeight = Math.max(size.minHeight, 70 + Math.max(incomingCount, outgoingCount) * size.externalGap);
    const height = merged.height ?? (stacked ? Math.max(size.width, defaultHeight) : defaultHeight);

    return {
      layout: normalizeLayoutName(merged.layout) || DEFAULT_DIAGRAM_OPTIONS.layout,
      orientation,
      width,
      height,
      marginX: merged.margin_x ?? merged.marginX ?? size.marginX,
      marginY: merged.margin_y ?? merged.marginY ?? size.marginY,
    };
  }

  function layoutLayered(diagram, layoutOptions) {
    const { width, height } = layoutOptions;
    const axes = diagramAxes(layoutOptions);
    const positions = initialFixedPositions(diagram, axes);
    const incoming = new Set(diagram.incoming);
    const outgoing = new Set(diagram.outgoing);
    const allNodes = collectNodes(diagram);

    placeExternalNodes(diagram.incoming, axes.layerStart, axes.crossStart, axes.crossEnd, "incoming", axes, positions);
    placeExternalNodes(diagram.outgoing, axes.layerEnd, axes.crossStart, axes.crossEnd, "outgoing", axes, positions);

    const internalNodes = Array.from(allNodes).filter((node) => (
      !incoming.has(node) && !outgoing.has(node) && !positions[node]
    ));
    const layerByNode = computeInternalLayers(diagram, internalNodes, incoming);
    const maxLayer = Math.max(1, ...Array.from(layerByNode.values()));
    const layers = new Map();

    internalNodes.forEach((node) => {
      const layer = layerByNode.get(node) || 1;
      const layerPosition = axes.layerStart + ((axes.layerEnd - axes.layerStart) * layer) / (maxLayer + 1);
      const cross = estimateInternalCross(node, diagram, positions, axes);

      if (!layers.has(layer)) {
        layers.set(layer, []);
      }

      layers.get(layer).push({ node, layer: layerPosition, cross });
    });

    layers.forEach((nodes) => {
      distributeLayer(nodes, axes.crossStart, axes.crossEnd).forEach(({ node, layer, cross }) => {
        positions[node] = axes.point(layer, cross, "internal");
      });
    });

    return { width, height, positions, options: layoutOptions };
  }

  function layoutTree(diagram, layoutOptions) {
    const { width, height } = layoutOptions;
    const axes = diagramAxes(layoutOptions);
    const positions = initialFixedPositions(diagram, axes);
    const allNodes = Array.from(collectNodes(diagram)).filter((node) => !positions[node]);
    const nodeSet = new Set(allNodes);
    const childrenByNode = treeChildrenByNode(diagram, nodeSet);
    const roots = treeRoots(diagram, allNodes, nodeSet);
    const depthByNode = new Map();
    const slotByNode = new Map();
    const visited = new Set();
    const visiting = new Set();
    let nextSlot = 0;

    const assignSubtree = (node, depth) => {
      if (!nodeSet.has(node)) {
        return null;
      }

      depthByNode.set(node, Math.max(depthByNode.get(node) ?? 0, depth));

      if (slotByNode.has(node)) {
        return slotByNode.get(node);
      }

      if (visiting.has(node)) {
        return null;
      }

      visiting.add(node);

      const childSlots = (childrenByNode.get(node) || [])
        .map((child) => assignSubtree(child, depth + 1))
        .filter((slot) => slot !== null);

      let slot;

      if (childSlots.length) {
        slot = childSlots.reduce((sum, childSlot) => sum + childSlot, 0) / childSlots.length;
      } else {
        slot = nextSlot;
        nextSlot += 1;
      }

      slotByNode.set(node, slot);
      visiting.delete(node);
      visited.add(node);

      return slot;
    };

    roots.forEach((root) => {
      assignSubtree(root, 0);
    });

    allNodes.forEach((node) => {
      if (!visited.has(node)) {
        assignSubtree(node, 0);
      }
    });

    allNodes.forEach((node) => {
      const maxDepth = Math.max(1, ...Array.from(depthByNode.values()));
      const depth = depthByNode.get(node) ?? 0;
      const slotCount = Math.max(nextSlot, 1);
      const kind = nodeKind(node, diagram);
      const layer = treeLayerForNode(kind, depth, maxDepth, axes);
      const cross = slotCoordinateAt(slotByNode.get(node) ?? 0, slotCount, axes.crossStart, axes.crossEnd);

      positions[node] = axes.point(layer, cross, kind);
    });

    return { width, height, positions, options: layoutOptions };
  }

  function treeLayerForNode(kind, depth, maxDepth, axes) {
    if (kind === "incoming") {
      return axes.layerStart;
    }

    if (kind === "outgoing") {
      return axes.layerEnd;
    }

    return axes.layerStart + ((axes.layerEnd - axes.layerStart) * depth) / maxDepth;
  }

  function treeChildrenByNode(diagram, nodeSet) {
    const childrenByNode = new Map();

    const addChild = (parent, child) => {
      if (!childrenByNode.has(parent)) {
        childrenByNode.set(parent, []);
      }

      const children = childrenByNode.get(parent);

      if (!children.includes(child)) {
        children.push(child);
      }
    };

    diagram.edges.forEach((edge) => {
      if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to) || edge.from === edge.to) {
        return;
      }

      const direction = treeLayoutEdgeDirection(edge, diagram);

      if (direction) {
        addChild(direction.parent, direction.child);
      }
    });

    return childrenByNode;
  }

  function treeLayoutEdgeDirection(edge, diagram) {
    const fromKind = nodeKind(edge.from, diagram);
    const toKind = nodeKind(edge.to, diagram);

    if (fromKind === "incoming" && toKind !== "incoming") {
      return { parent: edge.from, child: edge.to };
    }

    if (toKind === "incoming" && fromKind !== "incoming") {
      return { parent: edge.to, child: edge.from };
    }

    if (fromKind !== "outgoing" && toKind === "outgoing") {
      return { parent: edge.from, child: edge.to };
    }

    if (toKind !== "outgoing" && fromKind === "outgoing") {
      return { parent: edge.to, child: edge.from };
    }

    return { parent: edge.from, child: edge.to };
  }

  function treeRoots(diagram, allNodes, nodeSet) {
    const declaredRoots = diagram.incoming.filter((node) => nodeSet.has(node));

    if (declaredRoots.length) {
      return declaredRoots;
    }

    return nodesWithoutIncomingEdges(diagram, allNodes);
  }

  function slotCoordinateAt(slot, count, crossStart, crossEnd) {
    if (count <= 1) {
      return (crossStart + crossEnd) / 2;
    }

    return crossStart + ((crossEnd - crossStart) * slot) / (count - 1);
  }

  function layoutSpring(diagram, layoutOptions, springOptions = {}) {
    const { width, height, marginX, marginY } = layoutOptions;
    const axes = diagramAxes(layoutOptions);
    const base = layoutLayered(diagram, { ...layoutOptions, layout: "layered" });
    const positions = { ...base.positions };
    const allNodes = Array.from(collectNodes(diagram));
    const pinned = new Set([
      ...diagram.incoming,
      ...diagram.outgoing,
      ...Object.keys(diagram.manualPositions || {}),
    ]);
    const crossLocks = axes.stackInternals ? new Map() : terminalCrossLocks(diagram, positions, axes, pinned);
    const targetLength = Math.max(70, Math.min(width, height) / 3);
    const repulsion = targetLength * targetLength * (springOptions.electrical ? 0.16 : 0.08);
    const stiffness = 0.025;

    allNodes.forEach((node, index) => {
      if (positions[node]) {
        return;
      }

      const angle = (Math.PI * 2 * index) / Math.max(allNodes.length, 1);
      positions[node] = {
        x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.25,
        y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.25,
        kind: nodeKind(node, diagram),
        labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
      };
    });
    applyCrossLocks(positions, crossLocks, axes);

    for (let iteration = 0; iteration < 90; iteration += 1) {
      const forces = new Map(allNodes.map((node) => [node, { x: 0, y: 0 }]));

      for (let first = 0; first < allNodes.length; first += 1) {
        for (let second = first + 1; second < allNodes.length; second += 1) {
          const a = allNodes[first];
          const b = allNodes[second];
          const delta = safeDelta(positions[a], positions[b]);
          const force = repulsion / Math.max(delta.distance * delta.distance, 1);
          const fx = delta.ux * force;
          const fy = delta.uy * force;

          forces.get(a).x -= fx;
          forces.get(a).y -= fy;
          forces.get(b).x += fx;
          forces.get(b).y += fy;
        }
      }

      diagram.edges.forEach((edge) => {
        const from = positions[edge.from];
        const to = positions[edge.to];

        if (!from || !to) {
          return;
        }

        const delta = safeDelta(from, to);
        const force = (delta.distance - targetLength) * stiffness;
        const fx = delta.ux * force;
        const fy = delta.uy * force;

        forces.get(edge.from).x += fx;
        forces.get(edge.from).y += fy;
        forces.get(edge.to).x -= fx;
        forces.get(edge.to).y -= fy;
      });

      allNodes.forEach((node) => {
        if (pinned.has(node)) {
          return;
        }

        const force = forces.get(node);
        positions[node] = clampSpringPosition(
          positions[node],
          force,
          layoutOptions,
          axes,
          diagram
        );
        applyCrossLock(positions[node], crossLocks.get(node), axes);
      });
    }

    return { width, height, positions, options: layoutOptions };
  }

  function clampSpringPosition(position, force, layoutOptions, axes, diagram) {
    const { width, height, marginX, marginY } = layoutOptions;
    const next = {
      ...position,
      x: clamp(position.x + force.x, marginX, width - marginX),
      y: clamp(position.y + force.y, marginY, height - marginY),
    };

    if (
      position.kind !== "internal"
      || (!diagram.incoming.length && !diagram.outgoing.length)
    ) {
      return next;
    }

    const layerMin = Math.min(axes.layerStart, axes.layerEnd);
    const layerMax = Math.max(axes.layerStart, axes.layerEnd);
    const terminalGap = Math.min(72, Math.max(42, (layerMax - layerMin) * 0.18));

    if (layerMax - layerMin > 2 * terminalGap) {
      next.x = clamp(next.x, layerMin + terminalGap, layerMax - terminalGap);
    }

    return next;
  }

  function terminalCrossLocks(diagram, positions, axes, pinned) {
    const externalKinds = new Set(["incoming", "outgoing"]);
    const constraints = new Map();

    const addConstraint = (node, cross) => {
      if (pinned.has(node)) {
        return;
      }

      if (!constraints.has(node)) {
        constraints.set(node, []);
      }

      constraints.get(node).push(cross);
    };

    diagram.edges.forEach((edge) => {
      if (edge.hidden) {
        return;
      }

      const from = positions[edge.from];
      const to = positions[edge.to];

      if (!from || !to) {
        return;
      }

      const fromExternal = externalKinds.has(from.kind);
      const toExternal = externalKinds.has(to.kind);

      if (fromExternal && !toExternal) {
        addConstraint(edge.to, axes.crossOf(from));
      }

      if (toExternal && !fromExternal) {
        addConstraint(edge.from, axes.crossOf(to));
      }
    });

    const locks = new Map();

    constraints.forEach((crosses, node) => {
      const min = Math.min(...crosses);
      const max = Math.max(...crosses);

      if (max - min <= 1) {
        locks.set(node, crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length);
      }
    });

    return locks;
  }

  function applyCrossLocks(positions, crossLocks, axes) {
    crossLocks.forEach((cross, node) => {
      if (positions[node]) {
        applyCrossLock(positions[node], cross, axes);
      }
    });
  }

  function applyCrossLock(position, cross, axes) {
    if (cross === undefined) {
      return;
    }

    axes.setCross(position, cross);
  }

  function diagramAxes({ width, height, marginX, marginY, orientation }) {
    const reverse = orientation.endsWith("reverse");

    return {
      orientation,
      stackInternals: orientation.startsWith("vertical"),
      layerStart: reverse ? width - marginX : marginX,
      layerEnd: reverse ? marginX : width - marginX,
      crossStart: marginY,
      crossEnd: height - marginY,
      crossOf: (position) => position.y,
      setCross: (position, cross) => {
        position.y = cross;
      },
      point: (layer, cross, kind) => ({
        x: layer,
        y: cross,
        kind,
        labelSide: labelSideForKind(kind, orientation),
      }),
    };
  }

  function initialFixedPositions(diagram, axes) {
    const positions = {};

    Object.entries(diagram.manualPositions || {}).forEach(([node, position]) => {
      const kind = nodeKind(node, diagram);

      positions[node] = {
        x: position.x,
        y: position.y,
        kind,
        labelSide: labelSideForKind(kind, axes.orientation || "horizontal"),
      };
    });

    return positions;
  }

  function nodeKind(node, diagram) {
    if (diagram.incoming.includes(node)) {
      return "incoming";
    }

    if (diagram.outgoing.includes(node)) {
      return "outgoing";
    }

    return "internal";
  }

  function labelSideForKind(kind, orientation) {
    const reverse = orientation.endsWith("reverse");

    if (kind === "incoming") {
      return reverse ? "right" : "left";
    }

    if (kind === "outgoing") {
      return reverse ? "left" : "right";
    }

    return "top";
  }

  function nodesWithoutIncomingEdges(diagram, nodes) {
    const targets = new Set(diagram.edges.map((edge) => edge.to));
    const roots = nodes.filter((node) => !targets.has(node));

    return roots.length ? roots : nodes.slice(0, 1);
  }

  function computeTreeDepths(diagram, nodes, roots) {
    const nodeSet = new Set(nodes);
    const depthByNode = new Map();

    roots.forEach((root) => {
      depthByNode.set(root, 0);
    });

    for (let pass = 0; pass < nodes.length + diagram.edges.length + 1; pass += 1) {
      let changed = false;

      diagram.edges.forEach((edge) => {
        if (!depthByNode.has(edge.from) || !nodeSet.has(edge.to)) {
          return;
        }

        const depth = depthByNode.get(edge.from) + 1;

        if (!depthByNode.has(edge.to) || depth < depthByNode.get(edge.to)) {
          depthByNode.set(edge.to, depth);
          changed = true;
        }
      });

      if (!changed) {
        break;
      }
    }

    nodes.forEach((node) => {
      if (!depthByNode.has(node)) {
        depthByNode.set(node, 0);
      }
    });

    return depthByNode;
  }

  function safeDelta(from, to) {
    const dx = to.x - from.x || 0.01;
    const dy = to.y - from.y || 0.01;
    const distance = Math.hypot(dx, dy) || 1;

    return {
      dx,
      dy,
      distance,
      ux: dx / distance,
      uy: dy / distance,
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function collectNodes(diagram) {
    const nodes = new Set([...diagram.incoming, ...diagram.outgoing]);

    diagram.edges.forEach((edge) => {
      nodes.add(edge.from);
      nodes.add(edge.to);
    });

    Object.keys(diagram.labels).forEach((labelTarget) => {
      if (!labelTarget.includes("->")) {
        nodes.add(labelTarget);
      }
    });

    (diagram.braces || []).forEach((brace) => {
      nodes.add(brace.from);
      nodes.add(brace.to);
    });

    Object.keys(diagram.manualPositions || {}).forEach((node) => {
      nodes.add(node);
    });

    Object.keys(diagram.vertices || {}).forEach((node) => {
      nodes.add(node);
    });

    return nodes;
  }

  function placeExternalNodes(nodes, layer, crossStart, crossEnd, kind, axes, positions) {
    const count = Math.max(nodes.length, 1);

    nodes.forEach((node, index) => {
      if (!positions[node]) {
        positions[node] = axes.point(
          layer,
          crossCoordinateAt(index, count, crossStart, crossEnd),
          kind
        );
      }
    });
  }

  function crossCoordinateAt(index, count, crossStart, crossEnd) {
    if (count <= 1) {
      return (crossStart + crossEnd) / 2;
    }

    return crossStart + ((crossEnd - crossStart) * index) / (count - 1);
  }

  function computeInternalLayers(diagram, internalNodes, incoming) {
    const layers = new Map(internalNodes.map((node) => [node, 1]));
    const knownSources = new Set(incoming);

    const maxUsefulLayer = Math.max(1, internalNodes.length);

    for (let pass = 0; pass < internalNodes.length + diagram.edges.length + 1; pass += 1) {
      let changed = false;

      diagram.edges.forEach((edge) => {
        if (!layers.has(edge.to)) {
          return;
        }

        const sourceLayer = layers.get(edge.from) ?? (knownSources.has(edge.from) ? 0 : 1);
        const nextLayer = Math.max(layers.get(edge.to), Math.min(sourceLayer + 1, maxUsefulLayer));

        if (nextLayer !== layers.get(edge.to)) {
          layers.set(edge.to, nextLayer);
          changed = true;
        }
      });

      if (!changed) {
        break;
      }
    }

    return layers;
  }

  function estimateInternalCross(node, diagram, fixedPositions, axes) {
    const singleIncomingCross = axes.stackInternals
      ? null
      : directSingleIncomingCross(node, diagram, fixedPositions, axes);

    if (singleIncomingCross !== null) {
      return singleIncomingCross;
    }

    const neighborCrosses = [];

    diagram.edges.forEach((edge) => {
      if (edge.from === node && fixedPositions[edge.to]) {
        neighborCrosses.push(axes.crossOf(fixedPositions[edge.to]));
      }

      if (edge.to === node && fixedPositions[edge.from]) {
        neighborCrosses.push(axes.crossOf(fixedPositions[edge.from]));
      }
    });

    if (!neighborCrosses.length) {
      return (axes.crossStart + axes.crossEnd) / 2;
    }

    const average = neighborCrosses.reduce((sum, cross) => sum + cross, 0) / neighborCrosses.length;

    if (axes.stackInternals) {
      return pullCrossTowardCenter(average, axes);
    }

    return average;
  }

  function pullCrossTowardCenter(cross, axes) {
    const center = (axes.crossStart + axes.crossEnd) / 2;

    return center + (cross - center) * 0.5;
  }

  function directSingleIncomingCross(node, diagram, fixedPositions, axes) {
    if (diagram.incoming.length !== 1) {
      return null;
    }

    const incoming = diagram.incoming[0];

    if (!fixedPositions[incoming]) {
      return null;
    }

    const connected = diagram.edges.some((edge) => (
      !edge.hidden
      && (
        (edge.from === incoming && edge.to === node)
        || (edge.to === incoming && edge.from === node)
      )
    ));

    return connected ? axes.crossOf(fixedPositions[incoming]) : null;
  }

  function distributeLayer(nodes, minCross, maxCross) {
    const minGap = 42;
    const sorted = [...nodes].sort((a, b) => a.cross - b.cross || a.node.localeCompare(b.node));

    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].cross - sorted[index - 1].cross < minGap) {
        sorted[index].cross = sorted[index - 1].cross + minGap;
      }
    }

    const overflow = sorted.length ? sorted[sorted.length - 1].cross - maxCross : 0;
    if (overflow > 0) {
      sorted.forEach((item) => {
        item.cross -= overflow;
      });
    }

    for (let index = sorted.length - 2; index >= 0; index -= 1) {
      if (sorted[index + 1].cross - sorted[index].cross < minGap) {
        sorted[index].cross = sorted[index + 1].cross - minGap;
      }
    }

    const underflow = sorted.length ? minCross - sorted[0].cross : 0;
    if (underflow > 0) {
      sorted.forEach((item) => {
        item.cross += underflow;
      });
    }

    return sorted.map((item) => ({
      ...item,
      cross: Math.max(minCross, Math.min(maxCross, item.cross)),
    }));
  }

  function renderFeynmanElement(source, index) {
    const diagram = parseFeynman(source);
    const layout = layoutFeynman(diagram);
    const figure = document.createElement("figure");
    const svg = createSvg("svg", {
      class: "feynman-diagram__svg",
      role: "img",
      width: layout.width,
      height: layout.height,
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      "aria-labelledby": `feynman-title-${index}`,
      style: `--feynman-diagram-width: ${layout.width}px;`,
    });
    const title = createSvg("title", { id: `feynman-title-${index}` });

    title.textContent = "Feynman diagram";
    figure.className = "feynman-diagram";
    figure.dataset.feynmanDiagram = "true";
    svg.appendChild(title);
    svg.appendChild(createDefinitions(index));

    renderEdges(diagram, layout, index, (edge) => !isOverlayEdge(edge)).forEach((edge) => {
      svg.appendChild(edge);
    });

    Object.entries(layout.positions).forEach(([node, position]) => {
      const vertex = renderVertex(node, position, diagram);

      if (vertex) {
        svg.appendChild(vertex);
      }
    });

    renderEdges(diagram, layout, index, isOverlayEdge).forEach((edge) => {
      svg.appendChild(edge);
    });

    renderBraces(diagram, layout).forEach((brace) => {
      svg.appendChild(brace);
    });

    renderLabels(diagram, layout).forEach((label) => {
      svg.appendChild(label);
    });

    figure.appendChild(svg);

    if (diagram.errors.length) {
      const errors = document.createElement("figcaption");
      errors.className = "feynman-diagram__errors";
      errors.textContent = diagram.errors.join("; ");
      figure.appendChild(errors);
    }

    return figure;
  }

  function renderEdges(diagram, layout, index, includeEdge) {
    return diagram.edges
      .filter(includeEdge)
      .map((edge) => {
        const from = layout.positions[edge.from];
        const to = layout.positions[edge.to];

        if (!from || !to) {
          return null;
        }

        return renderEdge(edge, from, to, index);
      })
      .filter(Boolean);
  }

  function isOverlayEdge(edge) {
    return edge.type === "ghost";
  }

  function createDefinitions(index) {
    const defs = createSvg("defs");
    const marker = createSvg("marker", {
      id: `feynman-arrow-${index}`,
      markerWidth: VISUAL_DEFAULTS.arrowMarkerWidth,
      markerHeight: VISUAL_DEFAULTS.arrowMarkerHeight,
      refX: VISUAL_DEFAULTS.arrowMarkerRefX,
      refY: VISUAL_DEFAULTS.arrowMarkerRefY,
      orient: "auto",
      markerUnits: "strokeWidth",
    });

    marker.appendChild(createSvg("path", {
      d: VISUAL_DEFAULTS.arrowPath,
      class: "feynman-diagram__arrow",
    }));
    defs.appendChild(marker);

    return defs;
  }

  function renderEdge(edge, from, to, index) {
    if (edge.hidden) {
      return null;
    }

    if (edge.type === "fermion") {
      return renderDirectedEdge(edge, from, to, "feynman-diagram__edge feynman-diagram__edge--fermion");
    }

    if (edge.type === "plain") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--plain",
        d: edgePath(edge, from, to),
      });
    }

    if (edge.type === "photon") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--photon",
        d: wavePathForEdge(edge, from, to, 7, 18),
      });
    }

    if (edge.type === "gluon") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--gluon",
        d: gluonPathForEdge(edge, from, to, 5.5, 13),
      });
    }

    if (edge.type === "ghost") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--ghost",
        d: edgePath(edge, from, to),
      });
    }

    if (edge.arrow) {
      return renderDirectedEdge(edge, from, to, "feynman-diagram__edge feynman-diagram__edge--scalar");
    }

    return createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--scalar",
      d: edgePath(edge, from, to),
    });
  }

  function renderDirectedEdge(edge, from, to, className) {
    const group = createSvg("g", {
      class: "feynman-diagram__edge-group",
    });
    const geometry = edgeGeometry(edge, from, to);

    group.appendChild(createSvg("path", {
      class: className,
      d: geometryToPath(geometry),
    }));

    group.appendChild(renderArrowGlyphOnGeometry(geometry, edge.arrow === "reverse"));

    return group;
  }

  function renderArrowGlyphOnGeometry(geometry, reverse) {
    const sample = geometrySample(geometry, 0.5);
    const vector = normalizeVector(sample.tangent.x, sample.tangent.y);

    if (reverse) {
      vector.ux *= -1;
      vector.uy *= -1;
    }

    return renderArrowGlyphAt(sample.point, vector);
  }

  function renderArrowGlyph(from, to) {
    const vector = lineVector(from, to);
    const center = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
    };

    return renderArrowGlyphAt(center, vector);
  }

  function renderArrowGlyphAt(center, vector, options = {}) {
    const length = options.length ?? VISUAL_DEFAULTS.arrowMarkerWidth + 3;
    const width = options.width ?? VISUAL_DEFAULTS.arrowMarkerHeight;
    const tip = {
      x: center.x + vector.ux * ((2 * length) / 3),
      y: center.y + vector.uy * ((2 * length) / 3),
    };
    const tail = {
      x: center.x - vector.ux * (length / 3),
      y: center.y - vector.uy * (length / 3),
    };
    const left = {
      x: tail.x + vector.px * (width / 2),
      y: tail.y + vector.py * (width / 2),
    };
    const right = {
      x: tail.x - vector.px * (width / 2),
      y: tail.y - vector.py * (width / 2),
    };

    return createSvg("path", {
      class: options.className || "feynman-diagram__arrow",
      d: `M ${round(tip.x)} ${round(tip.y)} L ${round(left.x)} ${round(left.y)} L ${round(right.x)} ${round(right.y)} Z`,
    });
  }

  function renderVertex(node, position, diagram) {
    const shape = diagram.vertices?.[node] ?? null;

    if (!shape) {
      return null;
    }

    if (shape === "dot") {
      return createSvg("circle", {
        class: "feynman-diagram__vertex feynman-diagram__vertex--dot",
        cx: position.x,
        cy: position.y,
        r: 3.5,
      });
    }

    if (shape === "square-dot") {
      return createSvg("rect", {
        class: "feynman-diagram__vertex feynman-diagram__vertex--square-dot",
        x: position.x - 4,
        y: position.y - 4,
        width: 8,
        height: 8,
      });
    }

    if (shape === "empty-dot") {
      return createSvg("circle", {
        class: "feynman-diagram__vertex feynman-diagram__vertex--empty-dot",
        cx: position.x,
        cy: position.y,
        r: 5,
      });
    }

    if (shape === "cross" || shape === "crossed-dot") {
      const group = createSvg("g", {
        class: `feynman-diagram__vertex-group feynman-diagram__vertex-group--${shape}`,
      });
      const radius = shape === "crossed-dot" ? 6 : 7;

      if (shape === "crossed-dot") {
        group.appendChild(createSvg("circle", {
          class: "feynman-diagram__vertex feynman-diagram__vertex--empty-dot",
          cx: position.x,
          cy: position.y,
          r: radius,
        }));
      }

      group.appendChild(createSvg("line", {
        class: "feynman-diagram__vertex-mark",
        x1: position.x - radius,
        y1: position.y - radius,
        x2: position.x + radius,
        y2: position.y + radius,
      }));
      group.appendChild(createSvg("line", {
        class: "feynman-diagram__vertex-mark",
        x1: position.x - radius,
        y1: position.y + radius,
        x2: position.x + radius,
        y2: position.y - radius,
      }));

      return group;
    }

    if (shape === "blob" || shape === "disk") {
      const group = createSvg("g", {
        class: `feynman-diagram__vertex-group feynman-diagram__vertex-group--${shape}`,
      });
      const radius = shape === "disk" ? 44 : 18;

      group.appendChild(createSvg("circle", {
        class: "feynman-diagram__vertex-backdrop",
        cx: position.x,
        cy: position.y,
        r: radius + 1,
      }));
      group.appendChild(createSvg("circle", {
        class: `feynman-diagram__vertex feynman-diagram__vertex--blob feynman-diagram__vertex--${shape}`,
        cx: position.x,
        cy: position.y,
        r: radius,
      }));

      return group;
    }

    return null;
  }

  function wavePath(from, to, amplitude, wavelength) {
    return wavePathForEdge({}, from, to, amplitude, wavelength);
  }

  function wavePathForEdge(edge, from, to, amplitude, wavelength) {
    const geometry = edgeGeometry(edge, from, to);
    const length = geometryLength(geometry);
    const cycles = Math.max(2, Math.round(length / wavelength));
    const steps = cycles * 12;
    const points = [];

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const phase = t * cycles * Math.PI * 2;
      const offset = Math.sin(phase) * amplitude;
      const sample = geometrySample(geometry, t);
      const normal = perpendicularVector(sample.tangent);

      points.push({
        x: sample.point.x + normal.x * offset,
        y: sample.point.y + normal.y * offset,
      });
    }

    return pointsToPath(points);
  }

  function gluonPath(from, to, radius, loopLength) {
    return gluonPathForEdge({}, from, to, radius, loopLength);
  }

  function gluonPathForEdge(edge, from, to, radius, loopLength) {
    const geometry = edgeGeometry(edge, from, to);
    const length = geometryLength(geometry);
    const loops = Math.max(3, Math.round(length / loopLength));
    const steps = loops * 18;
    const points = [];

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const phase = t * loops * Math.PI * 2;
      const sample = geometrySample(geometry, t);
      const tangent = normalizeVector(sample.tangent.x, sample.tangent.y);
      const normal = perpendicularVector(tangent);
      const along = Math.sin(phase) * radius;
      const offset = Math.cos(phase) * radius;

      points.push({
        x: sample.point.x + tangent.ux * along + normal.x * offset,
        y: sample.point.y + tangent.uy * along + normal.y * offset,
      });
    }

    return pointsToPath(points);
  }

  function edgePath(edge, from, to) {
    return geometryToPath(edgeGeometry(edge, from, to));
  }

  function edgeGeometry(edge, from, to) {
    const outAngle = Number(edge?.outAngle);
    const inAngle = Number(edge?.inAngle);

    if (Number.isFinite(outAngle) || Number.isFinite(inAngle)) {
      return angleCurveGeometry(edge, from, to, outAngle, inAngle);
    }

    if (edge?.curve) {
      return offsetCurveGeometry(edge, from, to);
    }

    return {
      kind: "line",
      from,
      to,
    };
  }

  function offsetCurveGeometry(edge, from, to) {
    const vector = lineVector(from, to);
    const normal = leftNormalVector(vector);
    const side = edge.curve.side === "right" ? -1 : 1;
    const looseness = edge.looseness ?? 1;
    const offset = vector.length * edge.curve.amount * looseness * side;

    if (edge.curve.shape === "semicircle") {
      return {
        kind: "cubic",
        from,
        c1: {
          x: from.x + normal.x * offset,
          y: from.y + normal.y * offset,
        },
        c2: {
          x: to.x + normal.x * offset,
          y: to.y + normal.y * offset,
        },
        to,
      };
    }

    return {
      kind: "cubic",
      from,
      c1: {
        x: from.x + vector.dx * 0.33 + normal.x * offset,
        y: from.y + vector.dy * 0.33 + normal.y * offset,
      },
      c2: {
        x: from.x + vector.dx * 0.67 + normal.x * offset,
        y: from.y + vector.dy * 0.67 + normal.y * offset,
      },
      to,
    };
  }

  function angleCurveGeometry(edge, from, to, outAngle, inAngle) {
    const vector = lineVector(from, to);
    const looseness = edge?.looseness ?? 1;
    const handle = vector.length * 0.46 * looseness;
    const relativeBase = edge?.relativeAngles ? vectorAngle(vector) : 0;
    const resolvedOut = Number.isFinite(outAngle) ? relativeBase + outAngle : vectorAngle(vector);
    const resolvedIn = Number.isFinite(inAngle) ? relativeBase + inAngle : vectorAngle(vector) + 180;
    const outVector = angleUnitVector(resolvedOut);
    const inVector = angleUnitVector(resolvedIn);

    return {
      kind: "cubic",
      from,
      c1: {
        x: from.x + outVector.x * handle,
        y: from.y + outVector.y * handle,
      },
      c2: {
        x: to.x + inVector.x * handle,
        y: to.y + inVector.y * handle,
      },
      to,
    };
  }

  function geometryToPath(geometry) {
    if (geometry.kind === "cubic") {
      return [
        `M ${round(geometry.from.x)} ${round(geometry.from.y)}`,
        `C ${round(geometry.c1.x)} ${round(geometry.c1.y)}`,
        `${round(geometry.c2.x)} ${round(geometry.c2.y)}`,
        `${round(geometry.to.x)} ${round(geometry.to.y)}`,
      ].join(" ");
    }

    return `M ${round(geometry.from.x)} ${round(geometry.from.y)} L ${round(geometry.to.x)} ${round(geometry.to.y)}`;
  }

  function geometryPoint(geometry, t) {
    if (geometry.kind === "cubic") {
      return cubicPoint(geometry.from, geometry.c1, geometry.c2, geometry.to, t);
    }

    return {
      x: geometry.from.x + (geometry.to.x - geometry.from.x) * t,
      y: geometry.from.y + (geometry.to.y - geometry.from.y) * t,
    };
  }

  function geometryTangent(geometry, t) {
    if (geometry.kind === "cubic") {
      return cubicTangent(geometry.from, geometry.c1, geometry.c2, geometry.to, t);
    }

    return {
      x: geometry.to.x - geometry.from.x,
      y: geometry.to.y - geometry.from.y,
    };
  }

  function geometrySample(geometry, t) {
    return {
      point: geometryPoint(geometry, t),
      tangent: geometryTangent(geometry, t),
    };
  }

  function geometryLength(geometry) {
    const steps = geometry.kind === "cubic" ? 48 : 1;
    let length = 0;
    let previous = geometryPoint(geometry, 0);

    for (let step = 1; step <= steps; step += 1) {
      const next = geometryPoint(geometry, step / steps);

      length += Math.hypot(next.x - previous.x, next.y - previous.y);
      previous = next;
    }

    return length;
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;

    return {
      x: (mt ** 3) * p0.x + 3 * (mt ** 2) * t * p1.x + 3 * mt * (t ** 2) * p2.x + (t ** 3) * p3.x,
      y: (mt ** 3) * p0.y + 3 * (mt ** 2) * t * p1.y + 3 * mt * (t ** 2) * p2.y + (t ** 3) * p3.y,
    };
  }

  function cubicTangent(p0, p1, p2, p3, t) {
    const mt = 1 - t;

    return {
      x: 3 * (mt ** 2) * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * (t ** 2) * (p3.x - p2.x),
      y: 3 * (mt ** 2) * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * (t ** 2) * (p3.y - p2.y),
    };
  }

  function lineVector(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;

    return {
      dx,
      dy,
      length,
      ux: dx / length,
      uy: dy / length,
      px: -dy / length,
      py: dx / length,
    };
  }

  function normalizeVector(dx, dy) {
    const length = Math.hypot(dx, dy) || 1;

    return {
      ux: dx / length,
      uy: dy / length,
      px: -dy / length,
      py: dx / length,
    };
  }

  function perpendicularVector(vector) {
    const normalized = normalizeVector(vector.x ?? vector.dx ?? vector.ux, vector.y ?? vector.dy ?? vector.uy);

    return {
      x: normalized.px,
      y: normalized.py,
    };
  }

  function leftNormalVector(vector) {
    return {
      x: vector.dy / vector.length,
      y: -vector.dx / vector.length,
    };
  }

  function vectorAngle(vector) {
    return (Math.atan2(-vector.dy, vector.dx) * 180) / Math.PI;
  }

  function angleUnitVector(degrees) {
    const radians = (degrees * Math.PI) / 180;

    return {
      x: Math.cos(radians),
      y: -Math.sin(radians),
    };
  }

  function projectPoint(origin, vector, along, offset) {
    return {
      x: origin.x + vector.ux * along + vector.px * offset,
      y: origin.y + vector.uy * along + vector.py * offset,
    };
  }

  function pointsToPath(points) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`)
      .join(" ");
  }

  function renderLabels(diagram, layout) {
    const declaredLabels = Object.entries(diagram.labels)
      .map(([target, text]) => {
        if (target.includes("->")) {
          return renderEdgeLabel(target, text, diagram, layout);
        }

        return renderNodeLabel(target, text, layout.positions[target]);
      })
      .filter(Boolean);

    const inlineEdgeLabels = diagram.edges
      .filter((edge) => edge.label)
      .map((edge) => renderEdgeLabelForEdge(edge, edge.label, layout))
      .filter(Boolean);

    return [...declaredLabels, ...inlineEdgeLabels];
  }

  function renderNodeLabel(target, text, position) {
    if (!position) {
      return null;
    }

    const offset = labelOffset(position.labelSide || position.kind);
    const label = createSvg("text", {
      class: `feynman-diagram__label feynman-diagram__label--${position.kind}`,
      x: position.x + offset.x,
      y: position.y + offset.y,
      "text-anchor": offset.anchor,
      "dominant-baseline": "middle",
    });

    appendLabelMarkup(label, text || target);

    return label;
  }

  function renderEdgeLabel(target, text, diagram, layout) {
    const edge = findEdgeByLabelTarget(target, diagram.edges);

    if (!edge) {
      return null;
    }

    return renderEdgeLabelForEdge(edge, text, layout);
  }

  function renderEdgeLabelForEdge(edge, text, layout) {
    const from = layout.positions[edge.from];
    const to = layout.positions[edge.to];

    if (!from || !to) {
      return null;
    }

    const position = edgeLabelPosition(edge, from, to, edge.labelSide || "left");

    if (isMomentumEdge(edge)) {
      return renderMomentumLabelForEdge(edge, text, from, to, position);
    }

    const label = createSvg("text", {
      class: "feynman-diagram__label feynman-diagram__label--edge",
      x: position.x,
      y: position.y,
      "text-anchor": position.anchor,
      "dominant-baseline": "middle",
    });

    appendLabelMarkup(label, text);

    return label;
  }

  function renderMomentumLabelForEdge(edge, text, from, to, position) {
    const group = createSvg("g", {
      class: "feynman-diagram__momentum-label",
    });
    const arrow = momentumArrowGeometry(edge, from, to);

    group.appendChild(createSvg("path", {
      class: "feynman-diagram__momentum-arrow",
      d: arrow.path,
    }));
    group.appendChild(renderArrowGlyphAt(arrow.end, arrow.tangent, {
      className: "feynman-diagram__arrow feynman-diagram__momentum-arrowhead",
      length: VISUAL_DEFAULTS.momentumArrowHeadLength,
      width: VISUAL_DEFAULTS.momentumArrowHeadWidth,
    }));

    const label = createSvg("text", {
      class: "feynman-diagram__label feynman-diagram__label--edge feynman-diagram__label--momentum",
      x: position.x,
      y: position.y,
      "text-anchor": position.anchor,
      "dominant-baseline": "middle",
    });

    appendLabelMarkup(label, text);
    group.appendChild(label);

    return group;
  }

  function findEdgeByLabelTarget(target, edges) {
    const match = String(target || "").match(/^([A-Za-z0-9_.-]+)->([A-Za-z0-9_.-]+)(?:#([0-9]+))?$/);

    if (!match) {
      return null;
    }

    const [, from, to, rawIndex] = match;
    const matches = edges.filter((edge) => edge.from === from && edge.to === to);
    const index = rawIndex ? Number(rawIndex) - 1 : 0;

    return matches[index] || null;
  }

  function edgeLabelPosition(edge, from, to, side) {
    const sample = geometrySample(edgeGeometry(edge, from, to), 0.5);
    const tangent = normalizeVector(sample.tangent.x, sample.tangent.y);

    if (isMomentumEdge(edge)) {
      return momentumLabelPosition(edge, sample.point, tangent);
    }

    const normalSign = side === "right" ? 1 : -1;

    return {
      x: sample.point.x + tangent.px * VISUAL_DEFAULTS.edgeLabelOffset * normalSign,
      y: sample.point.y + tangent.py * VISUAL_DEFAULTS.edgeLabelOffset * normalSign,
      anchor: "middle",
    };
  }

  function momentumLabelPosition(edge, point, tangent) {
    const normal = momentumNormalForTangent(edge, tangent);
    const offset = momentumArrowDistance(edge)
      + VISUAL_DEFAULTS.momentumLabelGap
      + momentumLabelDistance(edge);

    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
      anchor: "middle",
    };
  }

  function momentumArrowGeometry(edge, from, to) {
    const geometry = edgeGeometry(edge, from, to);
    const shorten = momentumArrowShorten(edge);
    const reverse = edge.momentumDirection === "reverse";
    const start = reverse ? 1 - shorten : shorten;
    const end = reverse ? shorten : 1 - shorten;
    const steps = geometry.kind === "cubic" ? 8 : 1;
    const midpoint = geometrySample(geometry, 0.5);
    const normal = momentumNormalForTangent(
      edge,
      normalizeVector(midpoint.tangent.x, midpoint.tangent.y)
    );
    const offset = momentumArrowDistance(edge);
    const points = [];

    for (let step = 0; step <= steps; step += 1) {
      const t = start + ((end - start) * step) / steps;
      const point = geometryPoint(geometry, t);

      points.push({
        x: point.x + normal.x * offset,
        y: point.y + normal.y * offset,
      });
    }

    const endPoint = points[points.length - 1];
    const beforeEnd = points[points.length - 2] || points[0];

    return {
      path: pointsToPath(points),
      start: points[0],
      end: endPoint,
      tangent: normalizeVector(endPoint.x - beforeEnd.x, endPoint.y - beforeEnd.y),
      points,
    };
  }

  function isMomentumEdge(edge) {
    return edge.labelPlacement === "momentum" || edge.labelPlacement === "momentum-prime";
  }

  function momentumNormalForTangent(edge, tangent) {
    const normal = canonicalMomentumNormal(tangent);
    const normalSign = edge.labelPlacement === "momentum-prime" ? 1 : -1;

    return {
      x: normal.x * normalSign,
      y: normal.y * normalSign,
    };
  }

  function momentumArrowDistance(edge) {
    return edge.momentum?.arrowDistance ?? VISUAL_DEFAULTS.momentumArrowOffset;
  }

  function momentumLabelDistance(edge) {
    return edge.momentum?.labelDistance ?? 0;
  }

  function momentumArrowShorten(edge) {
    return edge.momentum?.arrowShorten ?? VISUAL_DEFAULTS.momentumArrowShorten;
  }

  function canonicalMomentumNormal(tangent) {
    let ux = tangent.ux;
    let uy = tangent.uy;

    if (Math.abs(ux) >= Math.abs(uy)) {
      if (ux < 0) {
        ux *= -1;
        uy *= -1;
      }
    } else if (uy < 0) {
      ux *= -1;
      uy *= -1;
    }

    return {
      x: -uy,
      y: ux,
    };
  }

  function renderBraces(diagram, layout) {
    return (diagram.braces || [])
      .map((brace) => renderBrace(brace, layout))
      .filter(Boolean);
  }

  function renderBrace(brace, layout) {
    const from = layout.positions[brace.from];
    const to = layout.positions[brace.to];

    if (!from || !to) {
      return null;
    }

    const group = createSvg("g", {
      class: "feynman-diagram__brace-group",
    });
    const geometry = braceGeometry(from, to, brace.side);

    if (geometry.kind === "tex-brace") {
      geometry.pieces.forEach((piece) => {
        group.appendChild(createSvg("path", {
          class: "feynman-diagram__brace feynman-diagram__brace--tex",
          d: piece.path,
          transform: piece.transform,
        }));
      });
    } else {
      group.appendChild(createSvg("path", {
        class: "feynman-diagram__brace",
        d: geometry.path,
      }));
    }

    const label = createSvg("text", {
      class: "feynman-diagram__label feynman-diagram__label--brace",
      x: geometry.label.x,
      y: geometry.label.y,
      "text-anchor": geometry.label.anchor,
      "dominant-baseline": "middle",
    });

    appendLabelMarkup(label, brace.label);
    group.appendChild(label);

    return group;
  }

  function braceGeometry(from, to, side) {
    const gap = 42;
    const curl = 14;
    const labelGap = 22;

    if (side === "left" || side === "right") {
      const sign = side === "right" ? 1 : -1;
      const x = (
        side === "right" ? Math.max(from.x, to.x) : Math.min(from.x, to.x)
      ) + sign * BRACE_SIDE_GAP;
      const y1 = Math.min(from.y, to.y);
      const y2 = Math.max(from.y, to.y);
      const mid = (y1 + y2) / 2;
      const braceY1 = y1 - BRACE_LABEL_PADDING;
      const braceY2 = y2 + BRACE_LABEL_PADDING;
      const geometry = texBraceGeometry(x, braceY1, braceY2, side);

      return {
        kind: "tex-brace",
        x: round(x),
        pieces: geometry.pieces,
        scale: geometry.scale,
        extenderRepeats: geometry.extenderRepeats,
        bounds: {
          y1: round(braceY1),
          y2: round(braceY2),
        },
        label: {
          x: round(x + sign * labelGap),
          y: mid,
          anchor: side === "right" ? "start" : "end",
        },
      };
    }

    const sign = side === "bottom" ? 1 : -1;
    const x1 = Math.min(from.x, to.x);
    const x2 = Math.max(from.x, to.x);
    const mid = (x1 + x2) / 2;
    const y = (side === "bottom" ? Math.max(from.y, to.y) : Math.min(from.y, to.y)) + sign * gap;
    const notch = Math.min(10, Math.max(5, (x2 - x1) / 8));
    const path = [
      `M ${round(x1)} ${round(y)}`,
      `C ${round(x1)} ${round(y + sign * curl)} ${round(mid - notch * 2)} ${round(y + sign * curl)} ${round(mid - notch)} ${round(y)}`,
      `C ${round(mid - notch * 0.4)} ${round(y + sign * curl * 0.45)} ${round(mid + notch * 0.4)} ${round(y + sign * curl * 0.45)} ${round(mid + notch)} ${round(y)}`,
      `C ${round(mid + notch * 2)} ${round(y + sign * curl)} ${round(x2)} ${round(y + sign * curl)} ${round(x2)} ${round(y)}`,
    ].join(" ");

    return {
      kind: "path",
      path,
      label: {
        x: mid,
        y: y + sign * labelGap,
        anchor: "middle",
      },
    };
  }

  function texBraceGeometry(x, y1, y2, side) {
    const span = Math.max(1, y2 - y1);
    const rawRepeats = (
      span / TEX_BRACE_METRICS.targetScale - TEX_BRACE_METRICS.baseHeight
    ) / (2 * TEX_BRACE_METRICS.extenderAdvance);
    const extenderRepeats = Math.max(0, Math.round(rawRepeats));
    const designHeight = TEX_BRACE_METRICS.baseHeight
      + 2 * extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
    const scale = span / designHeight;
    const topY = y1 - TEX_BRACE_METRICS.topMinY * scale;
    const sidePaths = TEX_BRACE_PATHS[side];
    const middleY = TEX_BRACE_METRICS.topAdvance
      + extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
    const bottomExtensionY = middleY + TEX_BRACE_METRICS.middleAdvance;
    const bottomY = bottomExtensionY
      + extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
    const pieces = [
      texBracePiece(sidePaths.top, x, topY, scale, 0),
    ];

    for (let index = 0; index < extenderRepeats; index += 1) {
      pieces.push(texBracePiece(
        TEX_BRACE_PATHS.extender,
        x,
        topY,
        scale,
        TEX_BRACE_METRICS.topAdvance + index * TEX_BRACE_METRICS.extenderAdvance
      ));
    }

    pieces.push(texBracePiece(sidePaths.middle, x, topY, scale, middleY));

    for (let index = 0; index < extenderRepeats; index += 1) {
      pieces.push(texBracePiece(
        TEX_BRACE_PATHS.extender,
        x,
        topY,
        scale,
        bottomExtensionY + index * TEX_BRACE_METRICS.extenderAdvance
      ));
    }

    pieces.push(texBracePiece(sidePaths.bottom, x, topY, scale, bottomY));

    return {
      pieces,
      scale: round(scale),
      extenderRepeats,
    };
  }

  function texBracePiece(path, x, y, scale, yOffset) {
    return {
      path,
      transform: [
        `matrix(${round(scale)} 0 0 ${round(scale)}`,
        `${round(x - TEX_BRACE_METRICS.centerX * scale)}`,
        `${round(y + yOffset * scale)})`,
      ].join(" "),
    };
  }

  function appendLabelMarkup(label, source) {
    const segments = parseLabelMarkup(source);

    label.setAttribute("aria-label", labelMarkupToText(source));
    segments.forEach((segment) => {
      if (!segment.text) {
        return;
      }

      const tspan = createSvg("tspan");
      tspan.textContent = labelSegmentText(segment);

      if (segment.kind !== "normal") {
        tspan.setAttribute("baseline-shift", segment.kind === "sup" ? "super" : "sub");
        tspan.setAttribute("font-size", `${VISUAL_DEFAULTS.scriptFontSizePercent}%`);
      }

      if (segment.overline) {
        tspan.setAttribute("text-decoration", "overline");
      }

      label.appendChild(tspan);
    });
  }

  function labelSegmentText(segment) {
    if (segment.kind === "normal") {
      return segment.text;
    }

    return segment.text.replace(/-/g, "−");
  }

  function parseLabelMarkup(source) {
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

  function labelMarkupToText(source) {
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

  function readBracedScriptArgument(input, start) {
    let depth = 0;
    let text = "";

    for (let index = start; index < input.length; index += 1) {
      const character = input[index];

      if (character === "\\" && index + 1 < input.length) {
        text += character + input[index + 1];
        index += 1;
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

  function labelOffset(kind) {
    if (kind === "left" || kind === "incoming") {
      return { x: -VISUAL_DEFAULTS.labelHorizontalOffset, y: 0, anchor: "end" };
    }

    if (kind === "right" || kind === "outgoing") {
      return { x: VISUAL_DEFAULTS.labelHorizontalOffset, y: 0, anchor: "start" };
    }

    if (kind === "bottom") {
      return { x: 0, y: VISUAL_DEFAULTS.labelBottomOffset, anchor: "middle" };
    }

    return { x: 0, y: -VISUAL_DEFAULTS.labelTopOffset, anchor: "middle" };
  }

  function createSvg(tagName, attributes) {
    const element = document.createElementNS(SVG_NS, tagName);

    Object.entries(attributes || {}).forEach(([name, value]) => {
      element.setAttribute(name, String(value));
    });

    return element;
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function injectStyles() {
    if (document.getElementById("feynman-diagram-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "feynman-diagram-styles";
    style.textContent = `
      .feynman-diagram {
        margin: 1.25rem 0;
        overflow-x: auto;
      }

      .feynman-diagram__svg {
        display: block;
        width: min(100%, var(--feynman-diagram-width, 46rem));
        max-width: 46rem;
        height: auto;
        color: var(--md-typeset-color, #1f2933);
      }

      .feynman-diagram__edge {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: ${VISUAL_DEFAULTS.edgeStrokeWidth};
      }

      .feynman-diagram__edge--scalar {
        stroke-dasharray: 7 6;
      }

      .feynman-diagram__edge--gluon {
        stroke-width: ${VISUAL_DEFAULTS.gluonStrokeWidth};
      }

      .feynman-diagram__edge--ghost {
        stroke-dasharray: 1 7;
      }

      .feynman-diagram__brace {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: ${VISUAL_DEFAULTS.edgeStrokeWidth};
      }

      .feynman-diagram__brace--tex {
        fill: currentColor;
        stroke: none;
      }

      .feynman-diagram__momentum-arrow {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: ${VISUAL_DEFAULTS.momentumArrowStrokeWidth};
      }

      .feynman-diagram__arrow,
      .feynman-diagram__vertex--dot,
      .feynman-diagram__vertex--square-dot {
        fill: currentColor;
      }

      .feynman-diagram__vertex {
        stroke: currentColor;
        stroke-width: ${VISUAL_DEFAULTS.vertexStrokeWidth};
      }

      .feynman-diagram__vertex--empty-dot {
        fill: var(--md-default-bg-color, #fff);
      }

      .feynman-diagram__vertex-backdrop {
        fill: var(--markfeyn-diagram-bg, var(--md-default-bg-color, #fff));
        stroke: none;
      }

      .feynman-diagram__vertex--blob {
        fill: currentColor;
        fill-opacity: 0.14;
        stroke-width: ${VISUAL_DEFAULTS.blobStrokeWidth};
      }

      .feynman-diagram__vertex-mark {
        stroke: currentColor;
        stroke-linecap: round;
        stroke-width: ${VISUAL_DEFAULTS.vertexMarkStrokeWidth};
      }

      .feynman-diagram__label {
        fill: currentColor;
        font-family: ${VISUAL_DEFAULTS.labelFontFamily};
        font-size: ${VISUAL_DEFAULTS.labelFontSize}px;
        font-style: ${VISUAL_DEFAULTS.labelFontStyle};
      }

      .feynman-diagram__label--edge {
        font-size: ${VISUAL_DEFAULTS.edgeLabelFontSize}px;
      }

      .feynman-diagram__label--brace {
        font-size: ${VISUAL_DEFAULTS.edgeLabelFontSize}px;
      }

      .feynman-diagram__errors {
        color: var(--md-code-hl-special-color, #b00020);
        font-size: 0.75rem;
        margin-top: 0.25rem;
      }
    `;

    document.head.appendChild(style);
  }

  function renderAll(root) {
    if (typeof document === "undefined") {
      return;
    }

    injectStyles();

    const scope = root && root.querySelectorAll ? root : document;
    const blocks = scope.querySelectorAll("pre code.language-feynman");

    blocks.forEach((code, index) => {
      const pre = code.closest("pre");

      if (!pre || pre.dataset.feynmanProcessed === "true") {
        return;
      }

      pre.dataset.feynmanProcessed = "true";
      pre.replaceWith(renderFeynmanElement(code.textContent, diagramSerial + index));
    });

    diagramSerial += blocks.length;
  }

  function boot() {
    if (typeof document === "undefined") {
      return;
    }

    if (window.document$ && typeof window.document$.subscribe === "function") {
      window.document$.subscribe((root) => renderAll(root));
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => renderAll(document));
      return;
    }

    renderAll(document);
  }

  const api = {
    parseFeynman,
    layoutFeynman,
    edgePath,
    wavePath,
    wavePathForEdge,
    gluonPath,
    gluonPathForEdge,
    edgeLabelPosition,
    momentumArrowGeometry,
    braceGeometry,
    parseLabelMarkup,
    labelMarkupToText,
    labelSegmentText,
    visualDefaults: VISUAL_DEFAULTS,
    renderAll,
  };

  if (typeof window !== "undefined") {
    window.FeynmanDiagrams = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  boot();
})();
