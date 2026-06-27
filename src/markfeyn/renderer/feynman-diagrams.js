import { createLayoutEngine } from "./layout-engine.js";
import { parseFeynman } from "./parser/index.js";
import { braceGeometry } from "./render/braces.js";
import {
  edgeLabelPosition,
  junctionCapNodes,
  momentumArrowGeometry,
} from "./render/edges.js";
import {
  labelMarkupToText,
  labelNeedsMathJax,
  labelSegmentText,
  parseLabelMarkup,
} from "./render/label-markup.js";
import {
  materializePendingMathLabels,
  mathJaxDisplayFontSize,
  parseMathJaxSvgLength,
} from "./render/mathjax.js";
import {
  doubleLinePath,
  doubleLinePathForEdge,
  edgePath,
  gluonPath,
  gluonPathForEdge,
  squarePath,
  squarePathForEdge,
  trianglePath,
  trianglePathForEdge,
  wavePath,
  wavePathForEdge,
} from "./render/paths.js";
import { SvgRenderer } from "./render/svg-renderer.js";
import { VISUAL_DEFAULTS } from "./render/visual-defaults.js";

(function () {
  "use strict";

  const layoutEngine = createLayoutEngine();

  async function layoutFeynman(diagram, options) {
    return layoutEngine.layoutFeynman(diagram, options);
  }

  function layoutFeynmanFallbackSync(diagram, options) {
    return layoutEngine.layoutFeynmanFallbackSync(diagram, options);
  }

  const renderer = new SvgRenderer({
    parseFeynman,
    layoutFeynman,
  });

  function renderAll(root) {
    return renderer.renderAll(root);
  }

  const api = {
    parseFeynman,
    layoutFeynman,
    layoutFeynmanFallbackSync,
    edgePath,
    wavePath,
    wavePathForEdge,
    gluonPath,
    gluonPathForEdge,
    trianglePath,
    trianglePathForEdge,
    squarePath,
    squarePathForEdge,
    doubleLinePath,
    doubleLinePathForEdge,
    edgeLabelPosition,
    momentumArrowGeometry,
    braceGeometry,
    junctionCapNodes,
    parseLabelMarkup,
    labelNeedsMathJax,
    mathJaxDisplayFontSize,
    parseMathJaxSvgLength,
    labelMarkupToText,
    labelSegmentText,
    materializePendingMathLabels,
    visualDefaults: VISUAL_DEFAULTS,
    renderAll,
  };

  if (typeof globalThis !== "undefined") {
    globalThis.FeynmanDiagrams = api;
  } else if (typeof window !== "undefined") {
    window.FeynmanDiagrams = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  renderer.boot();
})();
