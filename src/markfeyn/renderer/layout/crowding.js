// Measures how tightly vertices are packed in a finished layout and produces
// the "crowded-layout" diagnostic used both by the layout pipeline (see
// layout.js) and by the auto-growth retry in layout-engine.js.

export const CROWDED_LAYOUT_MIN_DISTANCE = 12;

export function measureMinVertexDistance(positions) {
  const points = Object.values(positions || {}).filter(
    (position) => position && Number.isFinite(position.x) && Number.isFinite(position.y)
  );

  let minDistance = Infinity;

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));

      if (distance < minDistance) {
        minDistance = distance;
      }
    }
  }

  return Number.isFinite(minDistance) ? minDistance : null;
}

export function crowdedLayoutDiagnostic(minDistance) {
  if (minDistance == null || minDistance >= CROWDED_LAYOUT_MIN_DISTANCE) {
    return null;
  }

  return {
    stage: "layout",
    severity: "warning",
    code: "crowded-layout",
    message: `Vertices are crowded (closest pair is ${minDistance.toFixed(1)}px apart). Try "size large" or "options width=... height=..." to spread them out.`,
    data: {
      minDistance: Number(minDistance.toFixed(2)),
      threshold: CROWDED_LAYOUT_MIN_DISTANCE,
    },
  };
}
