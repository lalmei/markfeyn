export function analyzeIncrementalStability(semantic, options = {}) {
  const previousLayout = normalizePreviousLayout(options.previousLayout || semantic.source.previousLayout);
  const enabled = Boolean(options.preservePreviousLayout || semantic.source.preservePreviousLayout);
  const sharedVertices = enabled
    ? semantic.vertices
      .map((vertex) => vertex.id)
      .filter((id) => previousLayout.positions[id])
      .sort()
    : [];

  return {
    enabled,
    previousLayout,
    sharedVertices,
  };
}

export function applyIncrementalStability(layout, incremental) {
  if (!incremental?.enabled || !incremental.sharedVertices.length) {
    return layout;
  }

  const positions = { ...(layout.positions || {}) };

  incremental.sharedVertices.forEach((node) => {
    const previous = incremental.previousLayout.positions[node];
    const current = positions[node] || {};

    positions[node] = {
      ...current,
      x: previous.x,
      y: previous.y,
      kind: current.kind || previous.kind || "internal",
    };
  });

  layout.positions = positions;
  layout.incremental = {
    preserved: true,
    sharedVertexCount: incremental.sharedVertices.length,
    nodes: incremental.sharedVertices.slice(),
  };

  return layout;
}

export function incrementalDiagnostic(incremental) {
  return {
    stage: "incremental",
    severity: incremental?.enabled ? "info" : "info",
    message: incremental?.enabled
      ? `Incremental stability enabled for ${incremental.sharedVertices.length} shared vertices`
      : "Incremental stability disabled",
    data: {
      enabled: Boolean(incremental?.enabled),
      sharedVertexCount: incremental?.sharedVertices?.length || 0,
      previousExternalOrder: externalOrderFromPreviousLayout(incremental?.previousLayout),
    },
  };
}

export function layoutInstabilityScore(layout, incremental) {
  if (!incremental?.enabled || !incremental.sharedVertices.length) {
    return 0;
  }

  const current = normalizedPositions(layout.positions || {}, incremental.sharedVertices);
  const previous = normalizedPositions(incremental.previousLayout.positions || {}, incremental.sharedVertices);

  if (!current || !previous) {
    return 0;
  }

  const total = incremental.sharedVertices.reduce((sum, node) => {
    const dx = current[node].x - previous[node].x;
    const dy = current[node].y - previous[node].y;

    return sum + dx * dx + dy * dy;
  }, 0);

  return total / incremental.sharedVertices.length / 20;
}

export function previousOrderFromLayout(previousLayout) {
  return externalOrderFromPreviousLayout(normalizePreviousLayout(previousLayout));
}

function normalizePreviousLayout(value) {
  const positions = {};

  if (value?.positions && typeof value.positions === "object") {
    Object.entries(value.positions).forEach(([node, position]) => {
      if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
        positions[node] = {
          x: position.x,
          y: position.y,
          kind: position.kind,
        };
      }
    });
  }

  return {
    ...value,
    positions,
  };
}

function externalOrderFromPreviousLayout(previousLayout) {
  const ordering = previousLayout?.analysis?.externalOrdering || previousLayout?.externalOrdering;

  if (!ordering) {
    return null;
  }

  return {
    incoming: idsFromOrder(ordering.incoming),
    outgoing: idsFromOrder(ordering.outgoing),
    unclassified: idsFromOrder(ordering.unclassified),
    all: idsFromOrder(ordering.all),
  };
}

function idsFromOrder(values) {
  return Array.isArray(values)
    ? values.map((value) => (typeof value === "string" ? value : value?.id)).filter(Boolean)
    : [];
}

function normalizedPositions(positions, nodes) {
  const points = nodes
    .map((node) => positions[node])
    .filter((position) => Number.isFinite(position?.x) && Number.isFinite(position?.y));

  if (points.length !== nodes.length) {
    return null;
  }

  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
  const scale = Math.max(
    1,
    Math.sqrt(points.reduce((sum, point) => (
      sum + (point.x - center.x) ** 2 + (point.y - center.y) ** 2
    ), 0) / points.length)
  );

  return Object.fromEntries(nodes.map((node) => [
    node,
    {
      x: (positions[node].x - center.x) / scale,
      y: (positions[node].y - center.y) / scale,
    },
  ]));
}
