import { renderBraces } from "./braces.js";
import { createDefinitions } from "./definitions.js";
import { createSvg } from "./dom.js";
import {
  isOverlayEdge,
  renderEdges,
  renderJunctionCaps,
} from "./edges.js";
import { labelMarkupToText } from "./label-markup.js";
import { renderLabels } from "./labels.js";
import { materializePendingMathLabels } from "./mathjax.js";
import { injectStyles } from "./styles.js";
import { renderVertex } from "./vertices.js";

const EDGE_TYPE_LABELS = {
  plain: "propagator",
  fermion: "fermion propagator",
  photon: "photon propagator",
  gluon: "gluon propagator",
  scalar: "scalar propagator",
  ghost: "ghost propagator",
  dashed: "dashed propagator",
  dashdot: "dash-dotted propagator",
  triangle: "propagator",
  square: "propagator",
  double: "propagator",
};

function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || `${singular}s`);
}

function vertexDisplayLabel(diagram, node) {
  const rawLabel = diagram.labels?.[node];

  return rawLabel ? labelMarkupToText(rawLabel) : node;
}

function computeDiagramTitle(diagram) {
  if (diagram.title) {
    return diagram.title;
  }

  const incomingLabels = (diagram.incoming || []).map((node) => vertexDisplayLabel(diagram, node));
  const outgoingLabels = (diagram.outgoing || []).map((node) => vertexDisplayLabel(diagram, node));

  if (!incomingLabels.length && !outgoingLabels.length) {
    return "Feynman diagram";
  }

  const parts = [incomingLabels.join(" "), outgoingLabels.join(" ")].filter(Boolean);

  return `Feynman diagram: ${parts.join(" → ")}`;
}

function summarizeDiagram(diagram, layout) {
  const vertexCount = Object.keys(layout.positions || {}).length;
  const counts = new Map();

  (diagram.edges || []).forEach((edge) => {
    if (edge.type === "invisible") {
      return;
    }

    const label = EDGE_TYPE_LABELS[edge.type] || `${edge.type} propagator`;

    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const parts = [`${vertexCount} ${pluralize(vertexCount, "vertex", "vertices")}`];

  counts.forEach((count, label) => {
    parts.push(`${count} ${pluralize(count, label)}`);
  });

  return parts.join(", ");
}

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export class SvgRenderer {
  constructor({ parseFeynman, layoutFeynman }) {
    this.parseFeynman = parseFeynman;
    this.layoutFeynman = layoutFeynman;
    this.diagramSerial = 0;
  }

  async renderFeynmanElement(source, index) {
    const diagram = this.parseFeynman(source);
    const layout = await this.layoutFeynman(diagram);

    if (!Object.keys(layout.positions || {}).length) {
      return this.renderEmptyFigure(diagram, index);
    }

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
    const desc = createSvg("desc", {});

    title.textContent = computeDiagramTitle(diagram);
    desc.textContent = summarizeDiagram(diagram, layout);
    figure.className = "feynman-diagram";
    figure.dataset.feynmanDiagram = "true";

    const fallbackDiagnostic = (layout.diagnostics || [])
      .find((diagnostic) => diagnostic.stage === "layout-fallback");

    if (fallbackDiagnostic) {
      figure.dataset.feynmanFallback = "true";
    }

    svg.appendChild(title);
    svg.appendChild(desc);
    svg.appendChild(createDefinitions(index));

    renderEdges(diagram, layout, index, (edge) => !isOverlayEdge(edge)).forEach((edge) => {
      svg.appendChild(edge);
    });

    renderJunctionCaps(diagram, layout).forEach((cap) => {
      svg.appendChild(cap);
    });

    Object.entries(layout.positions).forEach(([node, position]) => {
      const vertex = renderVertex(node, position, diagram, index);

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

    await materializePendingMathLabels(svg);

    figure.appendChild(svg);

    const layoutErrorMessages = (layout.diagnostics || [])
      .filter((diagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => diagnostic.message);
    const allErrors = dedupe([...diagram.errors, ...layoutErrorMessages]);

    if (allErrors.length) {
      const errors = document.createElement("figcaption");
      errors.className = "feynman-diagram__errors";
      errors.textContent = allErrors.join("; ");
      figure.appendChild(errors);
    }

    if (fallbackDiagnostic) {
      const warnings = document.createElement("figcaption");
      warnings.className = "feynman-diagram__warnings";
      warnings.textContent = fallbackDiagnostic.message;
      figure.appendChild(warnings);
    }

    return figure;
  }

  renderEmptyFigure(diagram, index) {
    const figure = document.createElement("figure");
    const caption = document.createElement("figcaption");

    figure.className = "feynman-diagram feynman-diagram--empty";
    figure.dataset.feynmanDiagram = "true";
    figure.dataset.feynmanEmpty = "true";
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-labelledby", `feynman-empty-${index}`);
    caption.id = `feynman-empty-${index}`;
    caption.className = "feynman-diagram__empty";
    caption.textContent = "Empty Feynman diagram: add at least one edge";
    figure.appendChild(caption);

    if (diagram.errors.length) {
      const errors = document.createElement("figcaption");
      errors.className = "feynman-diagram__errors";
      errors.textContent = dedupe(diagram.errors).join("; ");
      figure.appendChild(errors);
    }

    return figure;
  }

  renderLoadingFigure(index) {
    const figure = document.createElement("figure");

    figure.className = "feynman-diagram feynman-diagram--loading";
    figure.dataset.feynmanDiagram = "true";
    figure.setAttribute("aria-busy", "true");
    figure.setAttribute("aria-label", `Rendering Feynman diagram ${index + 1}`);

    return figure;
  }

  renderErrorFigure(error, index, source) {
    const figure = document.createElement("figure");
    const errors = document.createElement("figcaption");

    figure.className = "feynman-diagram";
    figure.dataset.feynmanDiagram = "true";
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-labelledby", `feynman-error-${index}`);
    errors.id = `feynman-error-${index}`;
    errors.className = "feynman-diagram__errors";
    errors.textContent = error?.message || String(error || "Unable to render Feynman diagram");
    figure.appendChild(errors);

    if (source) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      const pre = document.createElement("pre");
      const code = document.createElement("code");

      details.className = "feynman-diagram__source";
      summary.textContent = "Source";
      code.textContent = source;
      pre.appendChild(code);
      details.appendChild(summary);
      details.appendChild(pre);
      figure.appendChild(details);
    }

    return figure;
  }

  renderAll(root) {
    if (typeof document === "undefined") {
      return;
    }

    injectStyles();

    const scope = root && root.querySelectorAll ? root : document;
    const blocks = scope.querySelectorAll(
      "code.language-feynman, pre.language-feynman > code",
    );

    blocks.forEach((code, index) => {
      const pre = code.closest("pre");

      if (!pre || pre.dataset.feynmanProcessed === "true") {
        return;
      }

      pre.dataset.feynmanProcessed = "true";
      const renderIndex = this.diagramSerial + index;
      const placeholder = this.renderLoadingFigure(renderIndex);

      pre.replaceWith(placeholder);
      this.renderFeynmanElement(code.textContent, renderIndex)
        .then((figure) => {
          placeholder.replaceWith(figure);
        })
        .catch((error) => {
          placeholder.replaceWith(this.renderErrorFigure(error, renderIndex, code.textContent));
        });
    });

    this.diagramSerial += blocks.length;
  }

  boot() {
    if (typeof document === "undefined") {
      return;
    }

    if (window.document$ && typeof window.document$.subscribe === "function") {
      window.document$.subscribe((root) => this.renderAll(root));
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.renderAll(document));
      return;
    }

    this.renderAll(document);
  }
}
