import { VISUAL_DEFAULTS } from "./visual-defaults.js";

export function injectStyles() {
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

      .feynman-diagram__edge--dashed {
        stroke-dasharray: 10 7;
      }

      .feynman-diagram__edge--dashdot {
        stroke-dasharray: 11 6 1 6;
      }

      .feynman-diagram__edge--double {
        stroke-width: ${VISUAL_DEFAULTS.gluonStrokeWidth};
      }

      .feynman-diagram__junction-cap {
        fill: currentColor;
        stroke: none;
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
        stroke-width: ${VISUAL_DEFAULTS.blobStrokeWidth};
      }

      .feynman-diagram__vertex--blob-shaded {
        fill: currentColor;
        fill-opacity: 0.14;
      }

      .feynman-diagram__vertex--blob-hatched {
        fill-opacity: 1;
      }

      .feynman-diagram__hatch-fill {
        fill: currentColor;
        fill-opacity: 0.08;
        stroke: none;
      }

      .feynman-diagram__hatch-line {
        fill: none;
        stroke: currentColor;
        stroke-linecap: square;
        stroke-opacity: 0.55;
        stroke-width: 1.35;
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

      .feynman-diagram__label--fallback {
        opacity: 0.92;
      }

      .feynman-diagram__label--mathjax {
        fill: currentColor;
      }

      .feynman-diagram__errors {
        color: var(--md-code-hl-special-color, #b00020);
        font-size: 0.75rem;
        margin-top: 0.25rem;
      }

      .feynman-diagram--loading {
        min-height: 9rem;
      }
    `;

  document.head.appendChild(style);
}
