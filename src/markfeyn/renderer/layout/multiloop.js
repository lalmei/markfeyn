import { compareStable } from "./model.js";

export function analyzeMultiloop(semantic, topology) {
  const regions = (topology.loopRegions || [])
    .filter((region) => region.loopOrder > 0)
    .sort(compareRegion);

  return {
    applicable: topology.loopOrder > 1 && regions.length > 0,
    kind: topology.multiLoop?.kind || "unknown",
    loopOrder: topology.loopOrder,
    regions,
    principalSkeleton: topology.principalSkeleton || null,
    diagnostics: regions.length
      ? []
      : [{
        code: "no-loop-regions",
        message: "No loop regions were available for multiloop candidate placement.",
      }],
  };
}

export function multiloopDiagnostic(multiloop) {
  return {
    stage: "multiloop",
    severity: multiloop?.applicable ? "info" : "warning",
    message: multiloop?.applicable
      ? `Multiloop decomposition: ${multiloop.kind}`
      : "Multiloop decomposition unavailable",
    data: {
      applicable: Boolean(multiloop?.applicable),
      kind: multiloop?.kind || null,
      loopOrder: multiloop?.loopOrder || 0,
      regions: (multiloop?.regions || []).map((region) => ({
        id: region.id,
        kind: region.kind,
        loopOrder: region.loopOrder,
        nodes: region.nodes,
        cycles: region.cycles,
      })),
      diagnostics: multiloop?.diagnostics || [],
    },
  };
}

export function hasMultiloopLayout(prepared) {
  return Boolean(prepared?.multiloop?.applicable && prepared.topology.detectedTopology === "multiLoop");
}

export function selectMultiloopLayout(prepared, layoutOptions = {}) {
  if (!hasMultiloopLayout(prepared)) {
    return null;
  }

  const candidates = generateMultiloopCandidates(prepared, layoutOptions)
    .map((candidate) => ({
      ...candidate,
      score: scoreMultiloopCandidate(candidate.layout, prepared, candidate),
    }))
    .sort(compareScoredCandidates);

  if (!candidates.length) {
    return null;
  }

  const selected = candidates[0];
  const selectedSummary = summarizeCandidate(selected, true);
  selected.layout.multiloopCandidate = selectedSummary;

  return {
    layout: selected.layout,
    selection: {
      selected: selectedSummary,
      candidates: candidates.map((candidate) => summarizeCandidate(candidate, candidate === selected)),
    },
  };
}

function generateMultiloopCandidates(prepared, layoutOptions) {
  const limit = candidateLimit(layoutOptions.quality);
  const variants = [
    { id: "canonical", laneSign: 1, reflected: false },
    { id: "reflected", laneSign: -1, reflected: true },
    { id: "upper-first", laneSign: 1, reflected: true },
    { id: "lower-first", laneSign: -1, reflected: false },
  ].slice(0, limit);

  return variants.map((variant) => buildCandidate(prepared, layoutOptions, variant));
}

function buildCandidate(prepared, layoutOptions, variant) {
  const positions = initialPositions(prepared, layoutOptions);
  const regions = primaryRegions(prepared.multiloop.regions);
  const sharedNodes = sharedCycleNodes(regions);
  const center = { x: layoutOptions.width / 2, y: layoutOptions.height / 2 };
  const radius = {
    x: Math.max(46, Math.min(86, layoutOptions.width / 6)),
    y: Math.max(42, Math.min(72, layoutOptions.height / 4)),
  };
  const regionGap = Math.max(radius.x * 1.2, layoutOptions.width / Math.max(4, regions.length + 2));

  sharedNodes.forEach((node) => {
    if (prepared.multiloop.kind !== "overlapping" || sharedNodes.length === 1) {
      positions[node] = positionForKind(center.x, center.y, "internal", layoutOptions);
    }
  });
  placeNestedSharedPointRegions(prepared, positions, regions, sharedNodes, center, layoutOptions);
  placeOverlappingSharedPointRegions(prepared, positions, regions, sharedNodes, center, layoutOptions);

  regions.forEach((region, index) => {
    const offset = index - (regions.length - 1) / 2;
    const regionCenter = {
      x: center.x + offset * regionGap,
      y: center.y + variant.laneSign * laneOffset(prepared, region, index, radius.y),
    };
    const orderedNodes = orderedRegionNodes(region, variant);
    const angles = regionAngles(region, orderedNodes.length, variant);

    orderedNodes.forEach((node, nodeIndex) => {
      if (positions[node]) {
        return;
      }

      positions[node] = positionForKind(
        regionCenter.x + Math.cos(angles[nodeIndex]) * radius.x,
        regionCenter.y + Math.sin(angles[nodeIndex]) * radius.y,
        "internal",
        layoutOptions
      );
    });
  });

  placeRemainingInternals(prepared, positions, center, layoutOptions);
  placeExternalVertices(prepared, positions, center, layoutOptions);

  return {
    id: `multiloop:${prepared.multiloop.kind}:${variant.id}`,
    variant,
    regions,
    layout: {
      width: layoutOptions.width,
      height: layoutOptions.height,
      positions,
      options: layoutOptions,
      multiloopCandidate: {
        id: `multiloop:${prepared.multiloop.kind}:${variant.id}`,
        kind: prepared.multiloop.kind,
        regions: regions.map((region) => region.id),
      },
    },
  };
}

function placeOverlappingSharedPointRegions(prepared, positions, regions, sharedNodes, center, layoutOptions) {
  if (prepared.multiloop.kind !== "overlapping" || sharedNodes.length !== 1 || regions.length < 2) {
    return;
  }

  const shared = sharedNodes[0];
  const verticalGap = Math.max(70, layoutOptions.height * 0.22);
  const horizontalGap = Math.max(96, layoutOptions.width * 0.17);

  regions.forEach((region, index) => {
    if (!region.nodes.includes(shared)) {
      return;
    }

    const nonShared = region.nodes
      .filter((node) => node !== shared)
      .sort(compareStable);
    const y = center.y + (index - (regions.length - 1) / 2) * verticalGap;
    const slots = [
      { x: center.x - horizontalGap, y },
      { x: center.x + horizontalGap, y },
      { x: center.x, y: y + (index === 0 ? -verticalGap * 0.55 : verticalGap * 0.55) },
    ];
    const usedSlots = new Set();

    nonShared.forEach((node, nodeIndex) => {
      if (positions[node]) {
        return;
      }

      const slotIndex = nestedSlotIndex(prepared, node, usedSlots, nodeIndex);
      usedSlots.add(slotIndex);
      const slot = slots[Math.min(slotIndex, slots.length - 1)];
      positions[node] = positionForKind(slot.x, slot.y, "internal", layoutOptions);
    });
  });
}

function placeNestedSharedPointRegions(prepared, positions, regions, sharedNodes, center, layoutOptions) {
  if (prepared.multiloop.kind !== "nested" || sharedNodes.length !== 1 || regions.length < 2) {
    return;
  }

  const shared = sharedNodes[0];
  const verticalGap = Math.max(70, layoutOptions.height * 0.22);
  const horizontalGap = Math.max(96, layoutOptions.width * 0.17);

  regions.forEach((region, index) => {
    if (!region.nodes.includes(shared)) {
      return;
    }

    const nonShared = region.nodes
      .filter((node) => node !== shared)
      .sort(compareStable);
    const y = center.y + (index - (regions.length - 1) / 2) * verticalGap;
    const slots = [
      { x: center.x - horizontalGap, y },
      { x: center.x + horizontalGap, y },
      { x: center.x, y: y + (index === 0 ? -verticalGap * 0.55 : verticalGap * 0.55) },
    ];
    const usedSlots = new Set();

    nonShared.forEach((node, nodeIndex) => {
      if (positions[node]) {
        return;
      }

      const slotIndex = nestedSlotIndex(prepared, node, usedSlots, nodeIndex);
      usedSlots.add(slotIndex);
      const slot = slots[Math.min(slotIndex, slots.length - 1)];
      positions[node] = positionForKind(slot.x, slot.y, "internal", layoutOptions);
    });
  });
}

function primaryRegions(regions) {
  const cycles = regions
    .filter((region) => region.loopOrder === 1)
    .sort(compareRegion);

  return (cycles.length ? cycles : regions).slice(0, 8);
}

function initialPositions(prepared, layoutOptions) {
  const positions = {};

  prepared.semantic.vertices.forEach((vertex) => {
    if (!vertex.positionHint) {
      return;
    }

    positions[vertex.id] = positionForKind(
      vertex.positionHint.x,
      vertex.positionHint.y,
      kindForRole(vertex.externalRole),
      layoutOptions
    );
  });

  return positions;
}

function sharedCycleNodes(regions) {
  const counts = new Map();

  regions.forEach((region) => {
    region.nodes.forEach((node) => counts.set(node, (counts.get(node) || 0) + 1));
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([node]) => node)
    .sort(compareStable);
}

function orderedRegionNodes(region, variant) {
  const nodes = region.nodes.slice().sort(compareStable);
  return variant.reflected ? nodes.reverse() : nodes;
}

function regionAngles(region, count, variant) {
  if (region.kind === "box" && count === 4) {
    const base = [-0.72 * Math.PI, -0.28 * Math.PI, 0.28 * Math.PI, 0.72 * Math.PI];
    return variant.reflected ? base.slice().reverse() : base;
  }

  const start = region.kind === "triangle" ? -Math.PI / 2 : -Math.PI;

  return Array.from({ length: count }, (_, index) => (
    start + (2 * Math.PI * index) / count
  ));
}

function laneOffset(prepared, region, index, radiusY) {
  if (prepared.multiloop.kind === "disjoint") {
    return 0;
  }

  if (prepared.multiloop.kind === "nested") {
    return index % 2 === 0 ? -radiusY * 0.45 : radiusY * 0.45;
  }

  return (index % 2 === 0 ? -1 : 1) * radiusY * 0.35;
}

function placeRemainingInternals(prepared, positions, center, layoutOptions) {
  const placed = new Set(Object.keys(positions));
  const internals = prepared.semantic.internalVertices
    .filter((node) => !placed.has(node))
    .sort(compareStable);
  const gap = Math.max(54, Math.min(layoutOptions.width, layoutOptions.height) * 0.16);

  internals.forEach((node, index) => {
    const angle = -Math.PI / 2 + (Math.PI * (index + 1)) / (internals.length + 1);
    positions[node] = positionForKind(
      center.x + Math.cos(angle) * gap,
      center.y + Math.sin(angle) * gap,
      "internal",
      layoutOptions
    );
  });
}

function placeExternalVertices(prepared, positions, center, layoutOptions) {
  const external = prepared.semantic.externalVertices
    .slice()
    .sort((left, right) => compareExternal(prepared, left, right));
  const byNeighbor = new Map();

  external.forEach((node) => {
    if (positions[node]) {
      return;
    }

    const neighbor = firstPositionedNeighbor(prepared, positions, node);
    const key = neighbor || "unanchored";

    if (!byNeighbor.has(key)) {
      byNeighbor.set(key, []);
    }

    byNeighbor.get(key).push(node);
  });

  byNeighbor.forEach((nodes, neighbor) => {
    const anchor = positions[neighbor] || center;

    nodes
      .slice()
      .sort((left, right) => compareExternal(prepared, left, right))
      .forEach((node, index) => {
        const role = roleFor(prepared, node);
        const offset = stackOffset(index, nodes.length);
        let point;

        if (role === "incoming") {
          point = { x: layoutOptions.marginX, y: anchor.y + offset };
        } else if (role === "outgoing") {
          point = { x: layoutOptions.width - layoutOptions.marginX, y: anchor.y + offset };
        } else {
          const direction = outwardUnit(anchor, center, fallbackAngle(node));
          point = {
            x: anchor.x + direction.x * Math.max(72, layoutOptions.width * 0.2),
            y: anchor.y + direction.y * Math.max(56, layoutOptions.height * 0.22) + offset,
          };
        }

        positions[node] = positionForKind(point.x, point.y, kindForRole(role), layoutOptions);
      });
  });
}

function firstPositionedNeighbor(prepared, positions, node) {
  const edge = prepared.semantic.propagators
    .filter((propagator) => !propagator.metadata.hidden)
    .find((propagator) => (
      (propagator.source === node && positions[propagator.target])
      || (propagator.target === node && positions[propagator.source])
    ));

  if (!edge) {
    return null;
  }

  return edge.source === node ? edge.target : edge.source;
}

function compareExternal(prepared, left, right) {
  const order = new Map((prepared.externalOrdering?.all || []).map((entry, index) => [entry.id, index]));

  if (order.has(left) && order.has(right)) {
    return order.get(left) - order.get(right);
  }

  return compareStable(left, right);
}

function nestedSlotIndex(prepared, node, usedSlots, fallbackIndex) {
  const roles = attachedExternalRoles(prepared, node);

  if (roles.has("incoming") && !usedSlots.has(0)) {
    return 0;
  }

  if (roles.has("outgoing") && !usedSlots.has(1)) {
    return 1;
  }

  return [0, 1, 2].find((slot) => !usedSlots.has(slot)) ?? fallbackIndex;
}

function attachedExternalRoles(prepared, node) {
  const roles = new Set();
  const external = new Set(prepared.semantic.externalVertices);

  prepared.semantic.propagators
    .filter((propagator) => !propagator.metadata.hidden)
    .forEach((propagator) => {
      const neighbor = propagator.source === node
        ? propagator.target
        : propagator.target === node
          ? propagator.source
          : null;

      if (neighbor && external.has(neighbor)) {
        roles.add(roleFor(prepared, neighbor));
      }
    });

  return roles;
}

function roleFor(prepared, node) {
  return prepared.semantic.vertices.find((vertex) => vertex.id === node)?.externalRole || "unclassified";
}

function kindForRole(role) {
  if (role === "incoming" || role === "outgoing") {
    return role;
  }

  if (role === "unclassified") {
    return "external";
  }

  return "internal";
}

function positionForKind(x, y, kind, layoutOptions) {
  return {
    x: Math.max(layoutOptions.marginX, Math.min(layoutOptions.width - layoutOptions.marginX, x)),
    y: Math.max(layoutOptions.marginY, Math.min(layoutOptions.height - layoutOptions.marginY, y)),
    kind,
  };
}

function stackOffset(index, count) {
  return (index - (count - 1) / 2) * 38;
}

function outwardUnit(anchor, center, fallbackAngleValue) {
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;
  const length = Math.hypot(dx, dy);

  if (length > 1e-6) {
    return { x: dx / length, y: dy / length };
  }

  return { x: Math.cos(fallbackAngleValue), y: Math.sin(fallbackAngleValue) };
}

function fallbackAngle(node) {
  const text = String(node);
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 997;
  }

  return (2 * Math.PI * hash) / 997;
}

function scoreMultiloopCandidate(layout, prepared, candidate) {
  const finitePenalty = Object.values(layout.positions)
    .filter((position) => !Number.isFinite(position.x) || !Number.isFinite(position.y))
    .length * 1000;
  const regionPenalty = candidate.regions.reduce((sum, region) => {
    const points = region.nodes.map((node) => layout.positions[node]).filter(Boolean);
    return sum + (Math.abs(polygonArea(points)) < 200 ? 250 : 0);
  }, 0);
  const overlapPenalty = sharedCycleNodes(candidate.regions).length && prepared.multiloop.kind === "overlapping"
    ? 0
    : 10;
  const externalPenalty = prepared.semantic.externalVertices.reduce((sum, node) => (
    layout.positions[node] ? sum : sum + 100
  ), 0);

  return {
    total: finitePenalty + regionPenalty + overlapPenalty + externalPenalty,
    breakdown: {
      finitePenalty,
      regionPenalty,
      overlapPenalty,
      externalPenalty,
    },
  };
}

function polygonArea(points) {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    area += point.x * next.y - next.x * point.y;
  });

  return area / 2;
}

function candidateLimit(quality) {
  if (quality === "high") {
    return 4;
  }

  if (quality === "fast") {
    return 1;
  }

  return 2;
}

function compareScoredCandidates(left, right) {
  return left.score.total - right.score.total
    || compareStable(left.id, right.id);
}

function summarizeCandidate(candidate, selected) {
  return {
    id: candidate.id,
    selected,
    kind: candidate.layout.multiloopCandidate.kind,
    regions: candidate.layout.multiloopCandidate.regions,
    variant: candidate.variant,
    score: candidate.score,
  };
}

function compareRegion(left, right) {
  return left.loopOrder - right.loopOrder
    || left.nodes.length - right.nodes.length
    || compareStable(left.id, right.id);
}
