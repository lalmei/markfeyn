import {
  labelMarkupToText,
  labelNeedsMathJax,
  labelSegmentText,
  parseLabelMarkup,
} from "./label-markup.js";
import {
  edgeLabelPosition,
  isMomentumEdge,
  momentumArrowGeometry,
  renderArrowGlyphAt,
} from "./edges.js";
import { createSvg } from "./dom.js";
import { VISUAL_DEFAULTS } from "./visual-defaults.js";

export function renderLabels(diagram, layout) {
  const declaredLabels = Object.entries(diagram.labels)
    .map(([target, text]) => {
      if (target.includes("->")) {
        return renderEdgeLabel(target, text, diagram, layout);
      }

      return renderNodeLabel(target, text, layout.positions[target], layout);
    })
    .filter(Boolean);

  const inlineEdgeLabels = diagram.edges
    .map((edge, index) => (
      edge.label
        ? renderEdgeLabelForEdge(edge, edge.label, layout, {
          placementId: edgePlacementId(edge, index),
        })
        : null
    ))
    .filter(Boolean);

  return [...declaredLabels, ...inlineEdgeLabels];
}

export function createDiagramLabel({ text, x, y, anchor, className }) {
  const source = String(text ?? "");

  if (labelNeedsMathJax(source)) {
    const group = createSvg("g", {
      class: `${className} feynman-diagram__label--math-pending`.trim(),
      "data-math-tex": source,
      "data-label-x": x,
      "data-label-y": y,
      "data-label-anchor": anchor,
    });
    const fallback = createSvg("text", {
      class: "feynman-diagram__label feynman-diagram__label--fallback",
      x,
      y,
      "text-anchor": anchor,
      "dominant-baseline": "middle",
    });

    appendLabelMarkup(fallback, source);
    group.appendChild(fallback);

    return group;
  }

  const label = createSvg("text", {
    class: className,
    x,
    y,
    "text-anchor": anchor,
    "dominant-baseline": "middle",
  });

  appendLabelMarkup(label, source);

  return label;
}

function renderNodeLabel(target, text, position, layout) {
  if (!position) {
    return null;
  }

  const placement = labelPlacementEntry(layout, `node:${target}`);
  const offset = labelOffset(position.labelSide || position.kind);
  const x = placement?.x ?? position.x + offset.x;
  const y = placement?.y ?? position.y + offset.y;
  const anchor = placement?.anchor || offset.anchor;

  return createDiagramLabel({
    text: text || target,
    x,
    y,
    anchor,
    className: `feynman-diagram__label feynman-diagram__label--${position.kind}`,
  });
}

function renderEdgeLabel(target, text, diagram, layout) {
  const edge = findEdgeByLabelTarget(target, diagram.edges);

  if (!edge) {
    return null;
  }

  return renderEdgeLabelForEdge(edge, text, layout, {
    forceNormal: true,
    placementId: `declared-edge:${target}`,
  });
}

function renderEdgeLabelForEdge(edge, text, layout, options = {}) {
  const from = layout.positions[edge.from];
  const to = layout.positions[edge.to];

  if (!from || !to) {
    return null;
  }

  const placement = labelPlacementEntry(layout, options.placementId);
  const side = placement?.side || edge.labelSide || "left";
  const position = placement || edgeLabelPosition(edge, from, to, side, {
    ...options,
    sideOverride: side,
  });

  if (isMomentumEdge(edge) && !options.forceNormal) {
    return renderMomentumLabelForEdge(edge, text, from, to, position, { sideOverride: side });
  }

  return createDiagramLabel({
    text,
    x: position.x,
    y: position.y,
    anchor: position.anchor,
    className: "feynman-diagram__label feynman-diagram__label--edge",
  });
}

function renderMomentumLabelForEdge(edge, text, from, to, position, options = {}) {
  const group = createSvg("g", {
    class: "feynman-diagram__momentum-label",
  });
  const arrow = momentumArrowGeometry(edge, from, to, options);

  group.appendChild(createSvg("path", {
    class: "feynman-diagram__momentum-arrow",
    d: arrow.path,
  }));
  group.appendChild(renderArrowGlyphAt(arrow.end, arrow.tangent, {
    className: "feynman-diagram__arrow feynman-diagram__momentum-arrowhead",
    length: VISUAL_DEFAULTS.momentumArrowHeadLength,
    width: VISUAL_DEFAULTS.momentumArrowHeadWidth,
  }));

  group.appendChild(createDiagramLabel({
    text,
    x: position.x,
    y: position.y,
    anchor: position.anchor,
    className: "feynman-diagram__label feynman-diagram__label--edge feynman-diagram__label--momentum",
  }));

  return group;
}

function labelPlacementEntry(layout, id) {
  return layout?.labelPlacement?.byId?.[id] || null;
}

function edgePlacementId(edge, index) {
  return `edge:${edge.id || `${edge.from}->${edge.to}#${index + 1}`}`;
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
