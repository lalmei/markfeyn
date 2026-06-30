import { LABEL_METRICS as METRICS } from "../../geometry/metrics.js";

export function edgeLabelPosition(edge, from, to, side, curvePlan, options = {}) {
  const sample = geometrySample(edgeGeometry(edge, from, to, curvePlan), 0.5);
  const tangent = normalizeVector(sample.tangent.x, sample.tangent.y);
  const resolvedSide = normalizePlacementSide(options.sideOverride || side);

  if (isMomentumEdge(edge)) {
    if (!options.forceNormal) {
      return momentumLabelPosition(edge, sample.point, tangent, resolvedSide);
    }

    const momentumNormal = momentumNormalForTangent(edge, tangent, resolvedSide);

    return {
      x: sample.point.x - momentumNormal.x * METRICS.edgeLabelOffset,
      y: sample.point.y - momentumNormal.y * METRICS.edgeLabelOffset,
      anchor: "middle",
    };
  }

  const normalSign = resolvedSide === "right" ? 1 : -1;

  return {
    x: sample.point.x + tangent.px * METRICS.edgeLabelOffset * normalSign,
    y: sample.point.y + tangent.py * METRICS.edgeLabelOffset * normalSign,
    anchor: "middle",
  };
}

function momentumLabelPosition(edge, point, tangent, sideOverride) {
  const normal = momentumNormalForTangent(edge, tangent, sideOverride);
  const offset = momentumArrowDistance(edge)
    + METRICS.momentumLabelGap
    + momentumLabelDistance(edge);

  return {
    x: point.x + normal.x * offset,
    y: point.y + normal.y * offset,
    anchor: "middle",
  };
}

export function momentumArrowGeometry(edge, from, to, curvePlan, options = {}) {
  const geometry = edgeGeometry(edge, from, to, curvePlan);
  const shorten = momentumArrowShorten(edge);
  const reverse = edge.momentumDirection === "target-to-source";
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

  return { points };
}

export function edgeGeometry(edge, from, to, curvePlan) {
  const outAngle = Number(edge.metadata.outAngle);
  const inAngle = Number(edge.metadata.inAngle);

  if (samePoint(from, to)) {
    return selfLoopGeometry(edge, from, outAngle, inAngle, curvePlan);
  }

  if (Number.isFinite(outAngle) || Number.isFinite(inAngle)) {
    return angleCurveGeometry(edge, from, to, outAngle, inAngle);
  }

  const curve = edgeCurve(edge, curvePlan);

  if (curve) {
    return offsetCurveGeometry({ ...edge, curve }, from, to);
  }

  return {
    kind: "line",
    from,
    to,
  };
}

function edgeCurve(edge, curvePlan) {
  return edge.metadata.curve || curvePlan.get(edge.id) || null;
}

function selfLoopGeometry(edge, point, outAngle, inAngle, curvePlan) {
  const curve = edgeCurve(edge, curvePlan);
  const amount = clamp(curve?.amount ?? 0.72, 0.28, 1.1);
  const radius = 68 * amount;

  if (Number.isFinite(outAngle) || Number.isFinite(inAngle)) {
    const outVector = angleUnitVector(Number.isFinite(outAngle) ? outAngle : 135);
    const inVector = angleUnitVector(Number.isFinite(inAngle) ? inAngle : 45);

    return {
      kind: "cubic",
      from: point,
      c1: {
        x: point.x + outVector.x * radius * 1.65,
        y: point.y + outVector.y * radius * 1.65,
      },
      c2: {
        x: point.x + inVector.x * radius * 1.65,
        y: point.y + inVector.y * radius * 1.65,
      },
      to: point,
    };
  }

  const side = selfLoopSideVector(curve?.side);
  const tangent = { x: -side.y, y: side.x };

  return {
    kind: "cubic",
    from: point,
    c1: {
      x: point.x - tangent.x * radius + side.x * radius * 1.7,
      y: point.y - tangent.y * radius + side.y * radius * 1.7,
    },
    c2: {
      x: point.x + tangent.x * radius + side.x * radius * 1.7,
      y: point.y + tangent.y * radius + side.y * radius * 1.7,
    },
    to: point,
  };
}

function offsetCurveGeometry(edge, from, to) {
  const vector = lineVector(from, to);
  const normal = leftNormalVector(vector);
  const side = edge.curve.side === "right" ? -1 : 1;
  const looseness = edge.metadata.looseness ?? 1;
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
  const looseness = edge.metadata.looseness ?? 1;
  const handle = vector.length * 0.46 * looseness;
  const relativeBase = edge.metadata.relativeAngles ? vectorAngle(vector) : 0;
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

export function geometryPoint(geometry, t) {
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

export function geometrySample(geometry, t) {
  return {
    point: geometryPoint(geometry, t),
    tangent: geometryTangent(geometry, t),
  };
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

export function labelOffset(kind) {
  if (kind === "left" || kind === "incoming") {
    return { x: -METRICS.labelHorizontalOffset, y: 0, anchor: "end" };
  }

  if (kind === "right" || kind === "outgoing") {
    return { x: METRICS.labelHorizontalOffset, y: 0, anchor: "start" };
  }

  if (kind === "bottom") {
    return { x: 0, y: METRICS.labelBottomOffset, anchor: "middle" };
  }

  return { x: 0, y: -METRICS.labelTopOffset, anchor: "middle" };
}

export function textBounds(anchor, text, fontSize) {
  const width = estimateTextWidth(text, fontSize);
  const height = fontSize * 1.1;
  let x1 = anchor.x - width / 2;
  let x2 = anchor.x + width / 2;

  if (anchor.anchor === "start") {
    x1 = anchor.x;
    x2 = anchor.x + width;
  } else if (anchor.anchor === "end") {
    x1 = anchor.x - width;
    x2 = anchor.x;
  }

  return {
    x1,
    x2,
    y1: anchor.y - height / 2,
    y2: anchor.y + height / 2,
  };
}

function estimateTextWidth(text, fontSize) {
  const plain = plainLabelText(text);
  const chars = Array.from(plain).length;
  const narrow = (plain.match(/[.,:+\-_=]/g) || []).length;
  const wide = (plain.match(/[MWmw]/g) || []).length;
  const units = Math.max(1, chars - narrow * 0.35 + wide * 0.25);

  return units * fontSize * 0.56;
}

function plainLabelText(text) {
  return String(text || "")
    .replace(/\\overline\{([^}]*)\}/g, "$1")
    .replace(/\\([A-Za-z]+)/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/[_^]/g, "")
    .trim();
}

export function curvePlanMap(prepared, candidate) {
  const map = new Map();

  (prepared.parallelCurvePlan || []).forEach((assignment) => {
    map.set(assignment.propagator, {
      side: assignment.side,
      amount: assignment.amount,
      shape: assignment.shape,
    });
  });

  (candidate.curvePlan || []).forEach((assignment) => {
    map.set(assignment.edge, {
      side: assignment.side,
      amount: assignment.amount,
      shape: assignment.shape,
    });
  });

  return map;
}

export function boundsCenter(bounds) {
  return {
    x: (bounds.x1 + bounds.x2) / 2,
    y: (bounds.y1 + bounds.y2) / 2,
  };
}

export function boundsCorners(bounds) {
  return [
    { x: bounds.x1, y: bounds.y1 },
    { x: bounds.x2, y: bounds.y1 },
    { x: bounds.x2, y: bounds.y2 },
    { x: bounds.x1, y: bounds.y2 },
  ];
}

export function pointsBounds(points) {
  return {
    x1: Math.min(...points.map((point) => point.x)),
    x2: Math.max(...points.map((point) => point.x)),
    y1: Math.min(...points.map((point) => point.y)),
    y2: Math.max(...points.map((point) => point.y)),
  };
}

export function expandBounds(bounds, amount) {
  return {
    x1: bounds.x1 - amount,
    x2: bounds.x2 + amount,
    y1: bounds.y1 - amount,
    y2: bounds.y2 + amount,
  };
}

export function translateBounds(bounds, dx, dy) {
  return {
    x1: bounds.x1 + dx,
    x2: bounds.x2 + dx,
    y1: bounds.y1 + dy,
    y2: bounds.y2 + dy,
  };
}

export function shiftBoxWithAnchor(box, dx, dy) {
  return {
    ...box,
    x: box.x + dx,
    y: box.y + dy,
    bounds: translateBounds(box.bounds, dx, dy),
    center: {
      x: box.center.x + dx,
      y: box.center.y + dy,
    },
  };
}

export function cloneBounds(bounds) {
  return {
    x1: bounds.x1,
    x2: bounds.x2,
    y1: bounds.y1,
    y2: bounds.y2,
  };
}

export function orderedSides(preferred, sides) {
  const normalized = normalizePlacementSide(preferred);

  return [
    normalized,
    ...sides.filter((side) => side !== normalized),
  ];
}

export function normalizePlacementSide(side) {
  if (side === "incoming" || side === "left") {
    return "left";
  }

  if (side === "outgoing" || side === "right") {
    return "right";
  }

  if (side === "bottom") {
    return "bottom";
  }

  return "top";
}

export function nodeSideShifts(side) {
  if (side === "left" || side === "right") {
    return [
      { x: 0, y: 0 },
      { x: 0, y: -16 },
      { x: 0, y: 16 },
    ];
  }

  return [
    { x: 0, y: 0 },
    { x: -18, y: 0 },
    { x: 18, y: 0 },
  ];
}

export function edgeTangentShifts() {
  return [0, -18, 18];
}

export function viewOverflow(bounds, layout) {
  const width = layout.width ?? layout.options?.width ?? 0;
  const height = layout.height ?? layout.options?.height ?? 0;

  if (!width || !height) {
    return 0;
  }

  return Math.max(0, -bounds.x1)
    + Math.max(0, -bounds.y1)
    + Math.max(0, bounds.x2 - width)
    + Math.max(0, bounds.y2 - height);
}

export function roundBounds(bounds) {
  return {
    x1: roundPlacement(bounds.x1),
    x2: roundPlacement(bounds.x2),
    y1: roundPlacement(bounds.y1),
    y2: roundPlacement(bounds.y2),
  };
}

export function roundPlacement(value) {
  return Number(value.toFixed(6));
}

export function pointInsideBounds(point, bounds) {
  return point.x >= bounds.x1
    && point.x <= bounds.x2
    && point.y >= bounds.y1
    && point.y <= bounds.y2;
}

export function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x2, right.x2) - Math.max(left.x1, right.x1));
  const height = Math.max(0, Math.min(left.y2, right.y2) - Math.max(left.y1, right.y1));

  return width * height;
}

export function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function samePoint(from, to) {
  return Math.abs(from.x - to.x) < 0.001 && Math.abs(from.y - to.y) < 0.001;
}

export function isMomentumEdge(edge) {
  return edge.metadata.labelPlacement === "momentum" || edge.metadata.labelPlacement === "momentum-prime";
}

function momentumNormalForTangent(edge, tangent, sideOverride) {
  const normal = canonicalMomentumNormal(tangent);
  const normalSign = normalizePlacementSide(sideOverride || (
    edge.metadata.labelPlacement === "momentum-prime" ? "right" : "left"
  )) === "right" ? 1 : -1;

  return {
    x: normal.x * normalSign,
    y: normal.y * normalSign,
  };
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

function momentumArrowDistance(edge) {
  return edge.metadata.momentum?.arrowDistance ?? METRICS.momentumArrowOffset;
}

function momentumLabelDistance(edge) {
  return edge.metadata.momentum?.labelDistance ?? 0;
}

function momentumArrowShorten(edge) {
  return edge.metadata.momentum?.arrowShorten ?? METRICS.momentumArrowShorten;
}

export function lineVector(from, to) {
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

export function normalizeVector(dx, dy) {
  const length = Math.hypot(dx, dy) || 1;

  return {
    ux: dx / length,
    uy: dy / length,
    px: -dy / length,
    py: dx / length,
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

export function selfLoopSideVector(side) {
  if (side === "right") {
    return { x: 1, y: 0 };
  }

  if (side === "bottom") {
    return { x: 0, y: 1 };
  }

  if (side === "left") {
    return { x: -1, y: 0 };
  }

  return { x: 0, y: -1 };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
