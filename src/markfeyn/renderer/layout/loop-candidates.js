import { compareStable } from "./model.js";
import { compareExternalOrdering } from "./external-order.js";
import { scoreLoopCandidate } from "./score.js";
import { labelScoreTotal, nonLabelScoreTotal } from "./labels.js";

const LOOP_TOPOLOGIES = new Set(["triangleLoop", "boxLoop", "polygonLoop", "tadpole", "oneLoop"]);

export function hasLoopCandidateLayout(prepared) {
  return Boolean(
    prepared?.topology?.loopCandidate
    && LOOP_TOPOLOGIES.has(prepared.topology.detectedTopology)
  );
}

export function selectLoopCandidateLayout(prepared, layoutOptions = {}) {
  if (!hasLoopCandidateLayout(prepared)) {
    return null;
  }

  const loop = prepared.topology.loopCandidate;
  const candidates = generateLoopCandidates(prepared, layoutOptions, loop)
    .map((candidate) => {
      const score = scoreLoopCandidate(candidate.layout, prepared, candidate);

      return {
        ...candidate,
        score,
      };
    })
    .sort(compareScoredCandidates);

  if (!candidates.length) {
    return null;
  }

  const baselineSelected = candidates.slice().sort(compareBaselineCandidates)[0];
  const selected = candidates[0];
  const labelInfluenced = Boolean(baselineSelected && baselineSelected.id !== selected.id);
  const selectedSummary = summarizeCandidate(selected, true, {
    baselineCandidateId: baselineSelected?.id || null,
    labelAware: true,
    labelInfluenced,
  });

  selected.layout.loopCandidate = selectedSummary;

  return {
    layout: selected.layout,
    selection: {
      selected: selectedSummary,
      labelAware: true,
      labelInfluenced,
      baselineSelected: baselineSelected
        ? summarizeCandidate(baselineSelected, baselineSelected === selected)
        : null,
      candidates: candidates.map((candidate) => summarizeCandidate(candidate, candidate === selected, {
        baselineCandidateId: baselineSelected?.id || null,
        labelAware: true,
        labelInfluenced: candidate === selected ? labelInfluenced : false,
      })),
    },
  };
}

function generateLoopCandidates(prepared, layoutOptions, loop) {
  if (loop.type === "tadpole") {
    return generateTadpoleCandidates(prepared, layoutOptions, loop);
  }

  return generateCycleCandidates(prepared, layoutOptions, loop);
}

function generateCycleCandidates(prepared, layoutOptions, loop) {
  const candidates = [];
  const angleSets = cycleAngleSets(loop.length);
  const rotations = loop.nodes.map((node, index) => index);

  angleSets.forEach((angleSet) => {
    rotations.forEach((rotation) => {
      [false, true].forEach((reflected) => {
        const orderedNodes = rotateCycle(loop.nodes, rotation, reflected);
        const variant = {
          shape: angleSet.name,
          rotation,
          reflected,
          orderedNodes,
        };

        candidates.push(buildCandidate(prepared, layoutOptions, loop, variant, angleSet.angles));
      });
    });
  });

  return candidates;
}

function generateTadpoleCandidates(prepared, layoutOptions, loop) {
  return ["top", "right", "bottom", "left"].map((loopSide) => {
    const variant = {
      shape: "tadpole",
      rotation: 0,
      reflected: false,
      orderedNodes: loop.nodes.slice(),
      loopSide,
    };

    return buildCandidate(prepared, layoutOptions, loop, variant, [0]);
  });
}

function buildCandidate(prepared, layoutOptions, loop, variant, angles) {
  const positions = initialPositions(prepared, layoutOptions);
  const center = defaultLoopCenter(layoutOptions);
  const radius = loopRadius(layoutOptions, loop);

  variant.orderedNodes.forEach((node, index) => {
    if (positions[node]) {
      return;
    }

    const angle = angles[index % angles.length];

    positions[node] = positionForKind(
      center.x + Math.cos(angle) * radius.x,
      center.y + Math.sin(angle) * radius.y,
      vertexKind(prepared, node),
      layoutOptions
    );
  });

  const placedLoopCenter = centerForNodes(positions, loop.nodes) || center;

  placeOffLoopInternals(prepared, positions, loop, placedLoopCenter, layoutOptions);
  placeExternalVertices(prepared, positions, placedLoopCenter, layoutOptions);
  placeRemainingVertices(prepared, positions, placedLoopCenter, layoutOptions);

  const candidate = {
    id: candidateId(loop, variant),
    topology: prepared.topology.detectedTopology,
    type: loop.type,
    loop,
    variant,
    curvePlan: loopCurvePlan(loop, variant),
    layout: {
      width: layoutOptions.width,
      height: layoutOptions.height,
      positions,
      options: layoutOptions,
      loopCandidate: {
        id: candidateId(loop, variant),
        topology: prepared.topology.detectedTopology,
        type: loop.type,
        nodes: loop.nodes.slice(),
      },
    },
  };

  return candidate;
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
      kindForExternalRole(vertex.externalRole),
      layoutOptions
    );
  });

  return positions;
}

function placeOffLoopInternals(prepared, positions, loop, center, layoutOptions) {
  const loopNodes = new Set(loop.nodes);
  const internalNodes = prepared.semantic.internalVertices
    .filter((node) => !loopNodes.has(node))
    .sort(compareStable);
  const adjacency = visibleAdjacency(prepared);
  const gap = Math.max(46, Math.min(layoutOptions.width, layoutOptions.height) * 0.15);

  for (let pass = 0; pass < internalNodes.length; pass += 1) {
    let changed = false;

    internalNodes.forEach((node) => {
      if (positions[node]) {
        return;
      }

      const neighbors = Array.from(adjacency.get(node) || [])
        .filter((neighbor) => positions[neighbor]);

      if (!neighbors.length) {
        return;
      }

      const anchor = averagePosition(neighbors.map((neighbor) => positions[neighbor]));
      const direction = outwardUnit(anchor, center, fallbackAngleForNode(prepared, node));
      const next = clampPosition(
        {
          x: anchor.x + direction.x * gap,
          y: anchor.y + direction.y * gap,
        },
        layoutOptions
      );

      positions[node] = positionForKind(next.x, next.y, "internal", layoutOptions);
      changed = true;
    });

    if (!changed) {
      break;
    }
  }
}

function placeExternalVertices(prepared, positions, center, layoutOptions) {
  const externalNodes = prepared.semantic.externalVertices
    .slice()
    .sort((left, right) => compareExternalOrdering(prepared.externalOrdering, left, right));
  const legsByInternalAndRole = new Map();

  externalNodes.forEach((external) => {
    if (positions[external]) {
      return;
    }

    const neighbor = firstPositionedInternalNeighbor(prepared, positions, external);

    if (!neighbor) {
      return;
    }

    const role = vertexRole(prepared, external);
    const key = `${neighbor}|${role}`;

    if (!legsByInternalAndRole.has(key)) {
      legsByInternalAndRole.set(key, []);
    }

    legsByInternalAndRole.get(key).push(external);
  });

  legsByInternalAndRole.forEach((nodes, key) => {
    const [internal, role] = key.split("|");
    const anchor = positions[internal];

    nodes
      .slice()
      .sort((left, right) => compareExternalOrdering(prepared.externalOrdering, left, right))
      .forEach((node, index) => {
        const offset = stackOffset(index, nodes.length);
        const point = externalPoint(role, anchor, center, offset, layoutOptions);

        positions[node] = positionForKind(point.x, point.y, kindForExternalRole(role), layoutOptions);
      });
  });
}

function placeRemainingVertices(prepared, positions, center, layoutOptions) {
  const remaining = prepared.semantic.vertices
    .map((vertex) => vertex.id)
    .filter((node) => !positions[node])
    .sort(compareStable);
  const radius = Math.max(48, Math.min(layoutOptions.width, layoutOptions.height) * 0.24);

  remaining.forEach((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(remaining.length, 1);
    const point = clampPosition(
      {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      },
      layoutOptions
    );

    positions[node] = positionForKind(point.x, point.y, vertexKind(prepared, node), layoutOptions);
  });
}

function firstPositionedInternalNeighbor(prepared, positions, external) {
  return prepared.semantic.propagators
    .filter((edge) => !edge.metadata.hidden && (edge.source === external || edge.target === external))
    .map((edge) => edge.source === external ? edge.target : edge.source)
    .filter((node) => prepared.semantic.internalVertices.includes(node) && positions[node])
    .sort(compareStable)[0] || null;
}

function visibleAdjacency(prepared) {
  const adjacency = new Map(prepared.semantic.vertices.map((vertex) => [vertex.id, new Set()]));

  prepared.semantic.propagators
    .filter((edge) => !edge.metadata.hidden && edge.source !== edge.target)
    .forEach((edge) => {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    });

  return adjacency;
}

function externalPoint(role, anchor, center, offset, layoutOptions) {
  if (role === "incoming" || role === "outgoing") {
    return {
      x: terminalLayerForRole(role, layoutOptions),
      y: clamp(anchor.y + offset, layoutOptions.marginY, layoutOptions.height - layoutOptions.marginY),
    };
  }

  const direction = outwardUnit(anchor, center, -Math.PI / 2);
  const distance = Math.max(70, Math.min(layoutOptions.width, layoutOptions.height) * 0.22);
  const tangent = { x: -direction.y, y: direction.x };

  return clampPosition(
    {
      x: anchor.x + direction.x * distance + tangent.x * offset,
      y: anchor.y + direction.y * distance + tangent.y * offset,
    },
    layoutOptions
  );
}

function stackOffset(index, count) {
  if (count <= 1) {
    return 0;
  }

  const gap = 34;

  return (index - (count - 1) / 2) * gap;
}

function loopCurvePlan(loop, variant) {
  if (loop.type !== "tadpole") {
    return [];
  }

  return loop.edgeIndices.map((edgeIndex, index) => ({
    edgeIndex,
    edge: loop.edges[index],
    side: variant.loopSide || "top",
    amount: 0.72,
    shape: "self-loop",
  }));
}

function cycleAngleSets(length) {
  if (length === 3) {
    return [
      { name: "triangle-side-left", angles: [Math.PI, -Math.PI / 4, Math.PI / 4] },
      { name: "triangle-side-right", angles: [0, 3 * Math.PI / 4, -3 * Math.PI / 4] },
      { name: "triangle-apex-up", angles: [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6] },
      { name: "triangle-apex-down", angles: [Math.PI / 2, -Math.PI / 6, -5 * Math.PI / 6] },
    ];
  }

  if (length === 4) {
    return [
      { name: "box-rectangle", angles: [-3 * Math.PI / 4, -Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4] },
      { name: "box-diamond", angles: [-Math.PI / 2, 0, Math.PI / 2, Math.PI] },
    ];
  }

  return [
    {
      name: "regular",
      angles: Array.from({ length }, (value, index) => -Math.PI / 2 + (2 * Math.PI * index) / length),
    },
    {
      name: "regular-shifted",
      angles: Array.from({ length }, (value, index) => -Math.PI / 2 + Math.PI / length + (2 * Math.PI * index) / length),
    },
  ];
}

function rotateCycle(nodes, rotation, reflected) {
  const ordered = reflected ? nodes.slice().reverse() : nodes.slice();

  return [
    ...ordered.slice(rotation),
    ...ordered.slice(0, rotation),
  ];
}

function defaultLoopCenter(layoutOptions) {
  return {
    x: layoutOptions.width / 2,
    y: layoutOptions.height / 2,
  };
}

function loopRadius(layoutOptions, loop) {
  const availableWidth = Math.max(1, layoutOptions.width - 2 * layoutOptions.marginX);
  const availableHeight = Math.max(1, layoutOptions.height - 2 * layoutOptions.marginY);

  if (loop.type === "tadpole") {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp(availableWidth * 0.28, 62, loop.length >= 4 ? 134 : 118),
    y: clamp(availableHeight * 0.32, 54, loop.length >= 4 ? 112 : 104),
  };
}

function centerForNodes(positions, nodes) {
  const placed = nodes
    .map((node) => positions[node])
    .filter(Boolean);

  if (!placed.length) {
    return null;
  }

  return averagePosition(placed);
}

function averagePosition(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function outwardUnit(point, center, fallbackAngle) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const length = Math.hypot(dx, dy);

  if (length > 0.001) {
    return {
      x: dx / length,
      y: dy / length,
    };
  }

  return {
    x: Math.cos(fallbackAngle),
    y: Math.sin(fallbackAngle),
  };
}

function fallbackAngleForNode(prepared, node) {
  const vertices = prepared.semantic.vertices.map((vertex) => vertex.id).sort(compareStable);
  const index = Math.max(0, vertices.indexOf(node));

  return -Math.PI / 2 + (2 * Math.PI * index) / Math.max(vertices.length, 1);
}

function clampPosition(point, layoutOptions) {
  return {
    x: clamp(point.x, layoutOptions.marginX, layoutOptions.width - layoutOptions.marginX),
    y: clamp(point.y, layoutOptions.marginY, layoutOptions.height - layoutOptions.marginY),
  };
}

function positionForKind(x, y, kind, layoutOptions) {
  return {
    x,
    y,
    kind,
    labelSide: labelSideForKind(kind, layoutOptions.orientation),
  };
}

function vertexKind(prepared, node) {
  return kindForExternalRole(vertexRole(prepared, node));
}

function vertexRole(prepared, node) {
  const vertex = prepared.semantic.vertices.find((entry) => entry.id === node);

  return vertex?.externalRole || "none";
}

function kindForExternalRole(role) {
  if (role === "incoming" || role === "outgoing" || role === "unclassified") {
    return role;
  }

  return "internal";
}

function labelSideForKind(kind, orientation = "horizontal") {
  const reverse = String(orientation || "").endsWith("reverse");

  if (kind === "incoming") {
    return reverse ? "right" : "left";
  }

  if (kind === "outgoing") {
    return reverse ? "left" : "right";
  }

  return "top";
}

function terminalLayerForRole(role, layoutOptions) {
  const reverse = String(layoutOptions.orientation || "").endsWith("reverse");

  if (role === "incoming") {
    return reverse ? layoutOptions.width - layoutOptions.marginX : layoutOptions.marginX;
  }

  return reverse ? layoutOptions.marginX : layoutOptions.width - layoutOptions.marginX;
}

function summarizeCandidate(candidate, selected, metadata = {}) {
  return {
    id: candidate.id,
    selected,
    topology: candidate.topology,
    type: candidate.type,
    nodes: candidate.loop.nodes.slice(),
    edges: candidate.loop.edges.slice(),
    variant: {
      shape: candidate.variant.shape,
      rotation: candidate.variant.rotation,
      reflected: candidate.variant.reflected,
      loopSide: candidate.variant.loopSide,
    },
    score: {
      total: roundScore(candidate.score.total),
      nonLabelTotal: roundScore(nonLabelScoreTotal(candidate.score)),
      labelTotal: roundScore(labelScoreTotal(candidate.score)),
      breakdown: Object.fromEntries(
        Object.entries(candidate.score.breakdown).map(([key, value]) => [key, roundScore(value)])
      ),
    },
    labelAware: Boolean(metadata.labelAware),
    labelInfluenced: Boolean(metadata.labelInfluenced),
    baselineCandidateId: metadata.baselineCandidateId || null,
    curvePlan: candidate.curvePlan.map((entry) => ({ ...entry })),
  };
}

function candidateId(loop, variant) {
  return [
    loop.type,
    loop.nodes.join("-"),
    variant.shape,
    `r${variant.rotation}`,
    variant.reflected ? "reflected" : "normal",
    variant.loopSide || "plain",
  ].join(":");
}

function compareScoredCandidates(left, right) {
  return numericCompare(left.score.total, right.score.total)
    || compareCandidateTieBreakers(left, right);
}

function compareBaselineCandidates(left, right) {
  return numericCompare(nonLabelScoreTotal(left.score), nonLabelScoreTotal(right.score))
    || compareCandidateTieBreakers(left, right);
}

function compareCandidateTieBreakers(left, right) {
  return numericCompare(left.score.breakdown.externalBoundaryRoleViolations, right.score.breakdown.externalBoundaryRoleViolations)
    || numericCompare(left.score.breakdown.externalLegStraightness, right.score.breakdown.externalLegStraightness)
    || numericCompare(left.score.breakdown.loopReadability, right.score.breakdown.loopReadability)
    || numericCompare(left.score.breakdown.loopSymmetry, right.score.breakdown.loopSymmetry)
    || numericCompare(left.variant.rotation, right.variant.rotation)
    || numericCompare(left.variant.reflected ? 1 : 0, right.variant.reflected ? 1 : 0)
    || numericCompare(loopSideRank(left.variant.loopSide), loopSideRank(right.variant.loopSide))
    || compareStable(left.id, right.id);
}

function loopSideRank(side) {
  return {
    top: 0,
    right: 1,
    bottom: 2,
    left: 3,
  }[side] ?? 4;
}

function numericCompare(left, right) {
  const difference = left - right;

  return Math.abs(difference) < 0.000001 ? 0 : difference;
}

function roundScore(value) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
