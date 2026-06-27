import { renderBraces } from "./braces.js";
import { createDefinitions } from "./definitions.js";
import { createSvg } from "./dom.js";
import {
  isOverlayEdge,
  renderEdges,
  renderJunctionCaps,
} from "./edges.js";
import { renderLabels } from "./labels.js";
import { materializePendingMathLabels } from "./mathjax.js";
import { injectStyles } from "./styles.js";
import { renderVertex } from "./vertices.js";

export class SvgRenderer {
  constructor({ parseFeynman, layoutFeynman }) {
    this.parseFeynman = parseFeynman;
    this.layoutFeynman = layoutFeynman;
    this.diagramSerial = 0;
  }

  async renderFeynmanElement(source, index) {
    const diagram = this.parseFeynman(source);
    const layout = await this.layoutFeynman(diagram);
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

    if (diagram.errors.length) {
      const errors = document.createElement("figcaption");
      errors.className = "feynman-diagram__errors";
      errors.textContent = diagram.errors.join("; ");
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

  renderErrorFigure(error, index) {
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
          placeholder.replaceWith(this.renderErrorFigure(error, renderIndex));
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
