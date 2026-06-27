import { createSvg } from "./dom.js";
import { blobHatchPatternId } from "./vertex-shapes.js";
import {
  BLOB_HATCH_PATTERNS,
  VISUAL_DEFAULTS,
} from "./visual-defaults.js";

export function createDefinitions(index) {
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

  Object.entries(BLOB_HATCH_PATTERNS).forEach(([hatch, pattern]) => {
    defs.appendChild(createBlobHatchPattern(index, hatch, pattern));
  });

  return defs;
}

function createBlobHatchPattern(index, hatch, pattern) {
  const patternElement = createSvg("pattern", {
    id: blobHatchPatternId(index, hatch),
    patternUnits: "userSpaceOnUse",
    width: pattern.size,
    height: pattern.size,
  });

  patternElement.appendChild(createSvg("rect", {
    class: "feynman-diagram__hatch-fill",
    x: 0,
    y: 0,
    width: pattern.size,
    height: pattern.size,
  }));

  pattern.paths.forEach((path) => {
    patternElement.appendChild(createSvg("path", {
      class: "feynman-diagram__hatch-line",
      d: path,
    }));
  });

  return patternElement;
}
