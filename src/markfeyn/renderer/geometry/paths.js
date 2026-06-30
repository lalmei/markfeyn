const GLUON_ENDPOINT_RAMP_LOOPS = 0.62;

export function wavePath(from, to, amplitude, wavelength) {
  return wavePathForEdge({}, from, to, amplitude, wavelength);
}

export function wavePathForEdge(edge, from, to, amplitude, wavelength) {
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

export function gluonPath(from, to, radius, loopLength) {
  return gluonPathForEdge({}, from, to, radius, loopLength);
}

export function gluonPathForEdge(edge, from, to, radius, loopLength) {
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
    const taper = gluonEndpointTaper(t, loops);
    const along = Math.sin(phase) * radius * taper;
    const offset = Math.cos(phase) * radius * taper;

    points.push({
      x: sample.point.x + tangent.ux * along + normal.x * offset,
      y: sample.point.y + tangent.uy * along + normal.y * offset,
    });
  }

  return pointsToPath(points);
}

export function gluonEndpointTaper(t, loops) {
  const loopsFromEndpoint = Math.min(t, 1 - t) * loops;
  const edgeProgress = Math.min(1, Math.max(0, loopsFromEndpoint / GLUON_ENDPOINT_RAMP_LOOPS));

  return edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
}

export function trianglePath(from, to, amplitude, wavelength) {
  return trianglePathForEdge({}, from, to, amplitude, wavelength);
}

export function trianglePathForEdge(edge, from, to, amplitude, wavelength) {
  const geometry = edgeGeometry(edge, from, to);
  const length = geometryLength(geometry);
  const cycles = Math.max(2, Math.round(length / wavelength));
  const quarters = cycles * 4;
  const offsetPattern = [0, amplitude, 0, -amplitude];
  const samples = [];

  for (let step = 0; step <= quarters; step += 1) {
    samples.push({
      t: step / quarters,
      offset: offsetPattern[step % 4],
    });
  }

  return offsetSamplesToPath(geometry, samples);
}

export function squarePath(from, to, amplitude, wavelength) {
  return squarePathForEdge({}, from, to, amplitude, wavelength);
}

export function squarePathForEdge(edge, from, to, amplitude, wavelength) {
  const geometry = edgeGeometry(edge, from, to);
  const length = geometryLength(geometry);
  const cycles = Math.max(2, Math.round(length / wavelength));
  const samples = [{ t: 0, offset: 0 }];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const start = cycle / cycles;
    const mid = (cycle + 0.5) / cycles;
    const end = (cycle + 1) / cycles;

    samples.push({ t: start, offset: amplitude });
    samples.push({ t: mid, offset: amplitude });
    samples.push({ t: mid, offset: -amplitude });
    samples.push({ t: end, offset: -amplitude });
  }

  samples.push({ t: 1, offset: 0 });

  return offsetSamplesToPath(geometry, samples);
}

export function offsetSamplesToPath(geometry, samples) {
  const points = samples.map(({ t, offset }) => {
    const sample = geometrySample(geometry, t);
    const normal = perpendicularVector(sample.tangent);

    return {
      x: sample.point.x + normal.x * offset,
      y: sample.point.y + normal.y * offset,
    };
  });

  return pointsToPath(points);
}

export function doubleLinePath(from, to, separation) {
  return doubleLinePathForEdge({}, from, to, separation);
}

export function doubleLinePathForEdge(edge, from, to, separation) {
  const geometry = edgeGeometry(edge, from, to);
  const half = separation / 2;
  const steps = geometry.kind === "cubic" ? 48 : 1;
  const upper = [];
  const lower = [];

  for (let step = 0; step <= steps; step += 1) {
    const sample = geometrySample(geometry, step / steps);
    const normal = perpendicularVector(sample.tangent);

    upper.push({
      x: sample.point.x + normal.x * half,
      y: sample.point.y + normal.y * half,
    });
    lower.push({
      x: sample.point.x - normal.x * half,
      y: sample.point.y - normal.y * half,
    });
  }

  return `${pointsToPath(upper)} ${pointsToPath(lower)}`;
}

export function edgePath(edge, from, to) {
  return geometryToPath(edgeGeometry(edge, from, to));
}

export function edgeGeometry(edge, from, to) {
  const outAngle = Number(edge?.outAngle);
  const inAngle = Number(edge?.inAngle);

  if (samePoint(from, to)) {
    return selfLoopGeometry(edge, from, outAngle, inAngle);
  }

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

export function selfLoopGeometry(edge, point, outAngle, inAngle) {
  const amount = clamp(edge?.curve?.amount ?? 0.72, 0.28, 1.1);
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

  const side = selfLoopSideVector(edge?.curve?.side);
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

export function samePoint(from, to) {
  return Math.abs(from.x - to.x) < 0.001 && Math.abs(from.y - to.y) < 0.001;
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

export function offsetCurveGeometry(edge, from, to) {
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

export function angleCurveGeometry(edge, from, to, outAngle, inAngle) {
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

export function geometryToPath(geometry) {
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

export function geometryPoint(geometry, t) {
  if (geometry.kind === "cubic") {
    return cubicPoint(geometry.from, geometry.c1, geometry.c2, geometry.to, t);
  }

  return {
    x: geometry.from.x + (geometry.to.x - geometry.from.x) * t,
    y: geometry.from.y + (geometry.to.y - geometry.from.y) * t,
  };
}

export function geometryTangent(geometry, t) {
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

export function geometryLength(geometry) {
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

export function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;

  return {
    x: (mt ** 3) * p0.x + 3 * (mt ** 2) * t * p1.x + 3 * mt * (t ** 2) * p2.x + (t ** 3) * p3.x,
    y: (mt ** 3) * p0.y + 3 * (mt ** 2) * t * p1.y + 3 * mt * (t ** 2) * p2.y + (t ** 3) * p3.y,
  };
}

export function cubicTangent(p0, p1, p2, p3, t) {
  const mt = 1 - t;

  return {
    x: 3 * (mt ** 2) * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * (t ** 2) * (p3.x - p2.x),
    y: 3 * (mt ** 2) * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * (t ** 2) * (p3.y - p2.y),
  };
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

export function perpendicularVector(vector) {
  const normalized = normalizeVector(vector.x ?? vector.dx ?? vector.ux, vector.y ?? vector.dy ?? vector.uy);

  return {
    x: normalized.px,
    y: normalized.py,
  };
}

export function leftNormalVector(vector) {
  return {
    x: vector.dy / vector.length,
    y: -vector.dx / vector.length,
  };
}

export function vectorAngle(vector) {
  return (Math.atan2(-vector.dy, vector.dx) * 180) / Math.PI;
}

export function angleUnitVector(degrees) {
  const radians = (degrees * Math.PI) / 180;

  return {
    x: Math.cos(radians),
    y: -Math.sin(radians),
  };
}

export function projectPoint(origin, vector, along, offset) {
  return {
    x: origin.x + vector.ux * along + vector.px * offset,
    y: origin.y + vector.uy * along + vector.py * offset,
  };
}

export function pointsToPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`)
    .join(" ");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}
