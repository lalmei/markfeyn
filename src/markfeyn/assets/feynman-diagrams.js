(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PARTICLE_TYPES = new Set(["fermion", "photon", "gluon", "scalar"]);
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
  let diagramSerial = 0;

  function parseFeynman(source) {
    const diagram = {
      incoming: [],
      outgoing: [],
      edges: [],
      labels: {},
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

        const [command, ...rest] = line.split(/\s+/);

        if (command === "incoming") {
          diagram.incoming.push(...rest);
          return;
        }

        if (command === "outgoing") {
          diagram.outgoing.push(...rest);
          return;
        }

        if (command === "label") {
          parseLabels(line.slice(command.length).trim(), diagram.labels, diagram.errors, lineNumber);
          return;
        }

        if (PARTICLE_TYPES.has(command)) {
          rest.forEach((spec) => {
            const match = spec.match(/^([A-Za-z0-9_.-]+)->([A-Za-z0-9_.-]+)$/);

            if (!match) {
              diagram.errors.push(`Line ${lineNumber}: invalid ${command} edge "${spec}"`);
              return;
            }

            diagram.edges.push({
              type: command,
              from: match[1],
              to: match[2],
            });
          });
          return;
        }

        diagram.errors.push(`Line ${lineNumber}: unknown command "${command}"`);
      });

    return diagram;
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

  function layoutFeynman(diagram, options) {
    const width = options?.width ?? 720;
    const incomingCount = Math.max(diagram.incoming.length, 1);
    const outgoingCount = Math.max(diagram.outgoing.length, 1);
    const height = options?.height ?? Math.max(260, 70 + Math.max(incomingCount, outgoingCount) * 80);
    const marginX = options?.marginX ?? 72;
    const marginY = options?.marginY ?? 58;
    const positions = {};
    const incoming = new Set(diagram.incoming);
    const outgoing = new Set(diagram.outgoing);
    const allNodes = collectNodes(diagram);

    placeExternalNodes(diagram.incoming, marginX, marginY, height - marginY, "incoming", positions);
    placeExternalNodes(diagram.outgoing, width - marginX, marginY, height - marginY, "outgoing", positions);

    const internalNodes = Array.from(allNodes).filter((node) => !incoming.has(node) && !outgoing.has(node));
    const layerByNode = computeInternalLayers(diagram, internalNodes, incoming);
    const maxLayer = Math.max(1, ...Array.from(layerByNode.values()));
    const layers = new Map();

    internalNodes.forEach((node) => {
      const layer = layerByNode.get(node) || 1;
      const x = marginX + ((width - 2 * marginX) * layer) / (maxLayer + 1);
      const y = estimateInternalY(node, diagram, positions, height);

      if (!layers.has(layer)) {
        layers.set(layer, []);
      }

      layers.get(layer).push({ node, x, y });
    });

    layers.forEach((nodes) => {
      distributeLayer(nodes, marginY, height - marginY).forEach(({ node, x, y }) => {
        positions[node] = { x, y, kind: "internal" };
      });
    });

    return { width, height, positions };
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

    return nodes;
  }

  function placeExternalNodes(nodes, x, top, bottom, kind, positions) {
    const count = Math.max(nodes.length, 1);

    nodes.forEach((node, index) => {
      positions[node] = {
        x,
        y: top + ((bottom - top) * (index + 1)) / (count + 1),
        kind,
      };
    });
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

  function estimateInternalY(node, diagram, fixedPositions, height) {
    const neighborYs = [];

    diagram.edges.forEach((edge) => {
      if (edge.from === node && fixedPositions[edge.to]) {
        neighborYs.push(fixedPositions[edge.to].y);
      }

      if (edge.to === node && fixedPositions[edge.from]) {
        neighborYs.push(fixedPositions[edge.from].y);
      }
    });

    if (!neighborYs.length) {
      return height / 2;
    }

    return neighborYs.reduce((sum, y) => sum + y, 0) / neighborYs.length;
  }

  function distributeLayer(nodes, minY, maxY) {
    const minGap = 42;
    const sorted = [...nodes].sort((a, b) => a.y - b.y || a.node.localeCompare(b.node));

    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].y - sorted[index - 1].y < minGap) {
        sorted[index].y = sorted[index - 1].y + minGap;
      }
    }

    const overflow = sorted.length ? sorted[sorted.length - 1].y - maxY : 0;
    if (overflow > 0) {
      sorted.forEach((item) => {
        item.y -= overflow;
      });
    }

    for (let index = sorted.length - 2; index >= 0; index -= 1) {
      if (sorted[index + 1].y - sorted[index].y < minGap) {
        sorted[index].y = sorted[index + 1].y - minGap;
      }
    }

    const underflow = sorted.length ? minY - sorted[0].y : 0;
    if (underflow > 0) {
      sorted.forEach((item) => {
        item.y += underflow;
      });
    }

    return sorted.map((item) => ({
      ...item,
      y: Math.max(minY, Math.min(maxY, item.y)),
    }));
  }

  function renderFeynmanElement(source, index) {
    const diagram = parseFeynman(source);
    const layout = layoutFeynman(diagram);
    const figure = document.createElement("figure");
    const svg = createSvg("svg", {
      class: "feynman-diagram__svg",
      role: "img",
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      "aria-labelledby": `feynman-title-${index}`,
    });
    const title = createSvg("title", { id: `feynman-title-${index}` });

    title.textContent = "Feynman diagram";
    figure.className = "feynman-diagram";
    figure.dataset.feynmanDiagram = "true";
    svg.appendChild(title);
    svg.appendChild(createDefinitions(index));

    diagram.edges.forEach((edge) => {
      const from = layout.positions[edge.from];
      const to = layout.positions[edge.to];

      if (!from || !to) {
        return;
      }

      svg.appendChild(renderEdge(edge, from, to, index));
    });

    renderLabels(diagram, layout).forEach((label) => {
      svg.appendChild(label);
    });

    Object.entries(layout.positions).forEach(([, position]) => {
      if (position.kind === "internal") {
        svg.appendChild(createSvg("circle", {
          class: "feynman-diagram__vertex",
          cx: position.x,
          cy: position.y,
          r: 3.5,
        }));
      }
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

  function createDefinitions(index) {
    const defs = createSvg("defs");
    const marker = createSvg("marker", {
      id: `feynman-arrow-${index}`,
      markerWidth: 8,
      markerHeight: 8,
      refX: 5,
      refY: 3,
      orient: "auto",
      markerUnits: "strokeWidth",
    });

    marker.appendChild(createSvg("path", {
      d: "M0,0 L6,3 L0,6 Z",
      class: "feynman-diagram__arrow",
    }));
    defs.appendChild(marker);

    return defs;
  }

  function renderEdge(edge, from, to, index) {
    if (edge.type === "fermion") {
      return createSvg("polyline", {
        class: "feynman-diagram__edge feynman-diagram__edge--fermion",
        points: `${from.x},${from.y} ${(from.x + to.x) / 2},${(from.y + to.y) / 2} ${to.x},${to.y}`,
        "marker-mid": `url(#feynman-arrow-${index})`,
      });
    }

    if (edge.type === "photon") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--photon",
        d: wavePath(from, to, 7, 18),
      });
    }

    if (edge.type === "gluon") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--gluon",
        d: gluonPath(from, to, 5.5, 13),
      });
    }

    return createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--scalar",
      d: `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`,
    });
  }

  function wavePath(from, to, amplitude, wavelength) {
    const vector = lineVector(from, to);
    const cycles = Math.max(2, Math.round(vector.length / wavelength));
    const steps = cycles * 12;
    const points = [];

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const phase = t * cycles * Math.PI * 2;
      const offset = Math.sin(phase) * amplitude;

      points.push(projectPoint(from, vector, t * vector.length, offset));
    }

    return pointsToPath(points);
  }

  function gluonPath(from, to, radius, loopLength) {
    const vector = lineVector(from, to);
    const loops = Math.max(3, Math.round(vector.length / loopLength));
    const steps = loops * 18;
    const points = [];

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const phase = t * loops * Math.PI * 2;
      const along = t * vector.length + Math.sin(phase) * radius;
      const offset = Math.cos(phase) * radius;

      points.push(projectPoint(from, vector, along, offset));
    }

    return pointsToPath(points);
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
    return Object.entries(diagram.labels)
      .map(([target, text]) => {
        if (target.includes("->")) {
          return renderEdgeLabel(target, text, diagram, layout);
        }

        return renderNodeLabel(target, text, layout.positions[target]);
      })
      .filter(Boolean);
  }

  function renderNodeLabel(target, text, position) {
    if (!position) {
      return null;
    }

    const offset = labelOffset(position.kind);
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
    const [fromId, toId] = target.split("->");
    const hasEdge = diagram.edges.some((edge) => edge.from === fromId && edge.to === toId);
    const from = layout.positions[fromId];
    const to = layout.positions[toId];

    if (!hasEdge || !from || !to) {
      return null;
    }

    const label = createSvg("text", {
      class: "feynman-diagram__label feynman-diagram__label--edge",
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 12,
      "text-anchor": "middle",
    });

    appendLabelMarkup(label, text);

    return label;
  }

  function appendLabelMarkup(label, source) {
    const segments = parseLabelMarkup(source);

    label.setAttribute("aria-label", labelMarkupToText(source));
    segments.forEach((segment) => {
      if (!segment.text) {
        return;
      }

      const tspan = createSvg("tspan");
      tspan.textContent = segment.text;

      if (segment.kind !== "normal") {
        tspan.setAttribute("baseline-shift", segment.kind === "sup" ? "super" : "sub");
        tspan.setAttribute("font-size", "70%");
      }

      label.appendChild(tspan);
    });
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
        const command = readLatexCommand(input, index);
        buffer += command.text;
        index = command.next;
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

  function pushLabelSegment(segments, kind, text) {
    if (!text) {
      return;
    }

    const previous = segments[segments.length - 1];
    if (previous && previous.kind === kind) {
      previous.text += text;
      return;
    }

    segments.push({ kind, text });
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
    if (kind === "incoming") {
      return { x: -14, y: 0, anchor: "end" };
    }

    if (kind === "outgoing") {
      return { x: 14, y: 0, anchor: "start" };
    }

    return { x: 0, y: -16, anchor: "middle" };
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
        width: min(100%, 46rem);
        height: auto;
        color: var(--md-typeset-color, #1f2933);
      }

      .feynman-diagram__edge {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2.1;
      }

      .feynman-diagram__edge--scalar {
        stroke-dasharray: 7 6;
      }

      .feynman-diagram__edge--gluon {
        stroke-width: 1.7;
      }

      .feynman-diagram__arrow,
      .feynman-diagram__vertex {
        fill: currentColor;
      }

      .feynman-diagram__label {
        fill: currentColor;
        font-family: var(--md-text-font-family, system-ui, sans-serif);
        font-size: 20px;
      }

      .feynman-diagram__label--edge {
        font-size: 15px;
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
    wavePath,
    gluonPath,
    parseLabelMarkup,
    labelMarkupToText,
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
