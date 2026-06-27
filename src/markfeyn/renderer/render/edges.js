import {
  doubleLinePathForEdge,
  edgeGeometry,
  edgePath,
  geometryPoint,
  geometrySample,
  geometryToPath,
  gluonPathForEdge,
  lineVector,
  normalizeVector,
  pointsToPath,
  squarePathForEdge,
  trianglePathForEdge,
  wavePathForEdge,
} from "./paths.js";
import { createSvg, round } from "./dom.js";
import {
  GLUON_JUNCTION_CAP_RADIUS,
  VISUAL_DEFAULTS,
} from "./visual-defaults.js";

export function renderEdges(diagram, layout, index, includeEdge) {
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

export function isOverlayEdge(edge) {
  return edge.type === "ghost" || edge.overlay;
}

export function renderJunctionCaps(diagram, layout) {
  return junctionCapNodes(diagram, layout).map((cap) => createSvg("circle", {
    class: "feynman-diagram__junction-cap",
    cx: cap.position.x,
    cy: cap.position.y,
    r: GLUON_JUNCTION_CAP_RADIUS,
    "aria-hidden": "true",
  }));
}

export function junctionCapNodes(diagram, layout) {
  const incident = new Map();

  diagram.edges
    .filter(isVisibleJunctionEdge)
    .forEach((edge) => {
      markIncidentEdge(incident, edge.from, edge);
      markIncidentEdge(incident, edge.to, edge);
    });

  return Object.entries(layout.positions)
    .filter(([node, position]) => (
      position.kind === "internal"
      && !diagram.vertices?.[node]
      && (incident.get(node)?.count ?? 0) > 1
      && incident.get(node)?.hasGluon
    ))
    .map(([node, position]) => ({ node, position }));
}

export function renderEdge(edge, from, to, index) {
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

  if (edge.type === "dashed") {
    return createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--dashed",
      d: edgePath(edge, from, to),
    });
  }

  if (edge.type === "dashdot") {
    return createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--dashdot",
      d: edgePath(edge, from, to),
    });
  }

  if (edge.type === "triangle") {
    return createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--triangle",
      d: trianglePathForEdge(edge, from, to, 7, 16),
    });
  }

  if (edge.type === "square") {
    return createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--square",
      d: squarePathForEdge(edge, from, to, 6, 18),
    });
  }

  if (edge.type === "double") {
    return renderDoubleEdge(edge, from, to);
  }

  if (edge.arrow) {
    return renderDirectedEdge(edge, from, to, "feynman-diagram__edge feynman-diagram__edge--scalar");
  }

  return createSvg("path", {
    class: "feynman-diagram__edge feynman-diagram__edge--scalar",
    d: edgePath(edge, from, to),
  });
}

export function edgeLabelPosition(edge, from, to, side, options = {}) {
  const sample = geometrySample(edgeGeometry(edge, from, to), 0.5);
  const tangent = normalizeVector(sample.tangent.x, sample.tangent.y);
  const resolvedSide = options.sideOverride || side;

  if (isMomentumEdge(edge)) {
    if (!options.forceNormal) {
      return momentumLabelPosition(edge, sample.point, tangent, resolvedSide);
    }

    const momentumNormal = momentumNormalForTangent(edge, tangent, resolvedSide);

    return {
      x: sample.point.x - momentumNormal.x * VISUAL_DEFAULTS.edgeLabelOffset,
      y: sample.point.y - momentumNormal.y * VISUAL_DEFAULTS.edgeLabelOffset,
      anchor: "middle",
    };
  }

  const normalSign = resolvedSide === "right" ? 1 : -1;

  return {
    x: sample.point.x + tangent.px * VISUAL_DEFAULTS.edgeLabelOffset * normalSign,
    y: sample.point.y + tangent.py * VISUAL_DEFAULTS.edgeLabelOffset * normalSign,
    anchor: "middle",
  };
}

export function momentumArrowGeometry(edge, from, to, options = {}) {
  const geometry = edgeGeometry(edge, from, to);
  const shorten = momentumArrowShorten(edge);
  const reverse = edge.momentumDirection === "reverse";
  const start = reverse ? 1 - shorten : shorten;
  const end = reverse ? shorten : 1 - shorten;
  const steps = geometry.kind === "cubic" ? 8 : 1;
  const midpoint = geometrySample(geometry, 0.5);
  const normal = momentumNormalForTangent(
    edge,
    normalizeVector(midpoint.tangent.x, midpoint.tangent.y),
    options.sideOverride
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

export function renderArrowGlyphAt(center, vector, options = {}) {
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

export function isMomentumEdge(edge) {
  return edge.labelPlacement === "momentum" || edge.labelPlacement === "momentum-prime";
}

function isVisibleJunctionEdge(edge) {
  return !edge.hidden;
}

function markIncidentEdge(incident, node, edge) {
  const current = incident.get(node) || { count: 0, hasGluon: false };

  current.count += 1;
  current.hasGluon = current.hasGluon || edge.type === "gluon";
  incident.set(node, current);
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

function renderDoubleEdge(edge, from, to) {
  const path = createSvg("path", {
    class: "feynman-diagram__edge feynman-diagram__edge--double",
    d: doubleLinePathForEdge(edge, from, to, 4.6),
  });

  if (!edge.arrow) {
    return path;
  }

  const group = createSvg("g", {
    class: "feynman-diagram__edge-group",
  });
  const geometry = edgeGeometry(edge, from, to);

  group.appendChild(path);
  group.appendChild(renderArrowGlyphOnGeometry(geometry, edge.arrow === "reverse"));

  return group;
}

function momentumLabelPosition(edge, point, tangent, sideOverride) {
  const normal = momentumNormalForTangent(edge, tangent, sideOverride);
  const offset = momentumArrowDistance(edge)
    + VISUAL_DEFAULTS.momentumLabelGap
    + momentumLabelDistance(edge);

  return {
    x: point.x + normal.x * offset,
    y: point.y + normal.y * offset,
    anchor: "middle",
  };
}

function momentumNormalForTangent(edge, tangent, sideOverride) {
  const normal = canonicalMomentumNormal(tangent);
  const normalSign = (sideOverride || (edge.labelPlacement === "momentum-prime" ? "right" : "left")) === "right" ? 1 : -1;

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
