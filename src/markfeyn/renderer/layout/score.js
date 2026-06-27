import { scoreLabelGeometry } from "./labels.js";
import { layoutInstabilityScore } from "./incremental.js";

export function scoreLayout(layout, prepared) {
  const labelBreakdown = scoreLabelGeometry(layout, prepared);
  const breakdown = {
    missingCoordinates: scoreMissingCoordinates(layout, prepared.semantic),
    nonFiniteCoordinates: scoreNonFiniteCoordinates(layout),
    externalBoundaryRoleViolations: scoreExternalBoundaryRoles(layout, prepared),
    parallelEdgeOverlap: scoreParallelEdgeOverlap(prepared),
    externalAlignment: scoreExternalAlignment(layout, prepared),
    symmetry: scoreSymmetry(layout, prepared),
    symmetricUnclassifiedBranchLengths: scoreSymmetricUnclassifiedBranchLengths(layout, prepared),
    symmetricUnclassifiedBranchAngles: scoreSymmetricUnclassifiedBranchAngles(layout, prepared),
    symmetricUnclassifiedMirrorDeviation: scoreSymmetricUnclassifiedMirrorDeviation(layout, prepared),
    symmetricUnclassifiedCenteredInteraction: scoreSymmetricUnclassifiedCenteredInteraction(layout, prepared),
    symmetricUnclassifiedExternalLegBalance: scoreSymmetricUnclassifiedExternalLegBalance(layout, prepared),
    multiloopRegionOverlap: scoreMultiloopRegionOverlap(layout, prepared),
    multiloopContainmentViolation: scoreMultiloopContainmentViolation(layout, prepared),
    multiloopInterleaving: scoreMultiloopInterleaving(layout, prepared),
    topologyRecognizability: scoreTopologyRecognizability(layout, prepared),
    layoutInstability: layoutInstabilityScore(layout, prepared.incremental),
    edgeOverlap: scoreCandidateEdgeOverlap(layout, prepared),
    loopReadability: scoreCandidateLoopReadability(layout, prepared, layout.loopCandidate),
    loopSymmetry: scoreLoopSymmetryRefinement(layout, prepared, layout.loopCandidate),
    externalLegStraightness: scoreCandidateExternalLegStraightness(layout, prepared),
    ...labelBreakdown,
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  return {
    total,
    breakdown,
    summary: {
      missingCoordinates: breakdown.missingCoordinates,
      nonFiniteCoordinates: breakdown.nonFiniteCoordinates,
      externalBoundaryRoleViolations: breakdown.externalBoundaryRoleViolations,
      parallelEdgeOverlap: breakdown.parallelEdgeOverlap,
      multiloopRegionOverlap: breakdown.multiloopRegionOverlap,
      multiloopContainmentViolation: breakdown.multiloopContainmentViolation,
      multiloopInterleaving: breakdown.multiloopInterleaving,
      topologyRecognizability: breakdown.topologyRecognizability,
      layoutInstability: breakdown.layoutInstability,
      edgeOverlap: breakdown.edgeOverlap,
      loopReadability: breakdown.loopReadability,
      loopSymmetry: breakdown.loopSymmetry,
      externalLegStraightness: breakdown.externalLegStraightness,
      nodeLabelOverlap: breakdown.nodeLabelOverlap,
      edgeLabelOverlap: breakdown.edgeLabelOverlap,
      labelLabelOverlap: breakdown.labelLabelOverlap,
      labelsInsideLoops: breakdown.labelsInsideLoops,
      momentumLoopCollision: breakdown.momentumLoopCollision,
    },
  };
}

export function scoreLoopCandidate(layout, prepared, candidate = {}) {
  const labelBreakdown = scoreLabelGeometry(layout, prepared, candidate);
  const breakdown = {
    missingCoordinates: scoreMissingCoordinates(layout, prepared.semantic),
    nonFiniteCoordinates: scoreNonFiniteCoordinates(layout),
    externalBoundaryRoleViolations: scoreExternalBoundaryRoles(layout, prepared),
    externalAlignment: scoreExternalAlignment(layout, prepared),
    edgeOverlap: scoreCandidateEdgeOverlap(layout, prepared),
    loopReadability: scoreCandidateLoopReadability(layout, prepared, candidate),
    loopSymmetry: scoreLoopSymmetryRefinement(layout, prepared, candidate),
    externalLegStraightness: scoreCandidateExternalLegStraightness(layout, prepared),
    ...labelBreakdown,
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  return {
    total,
    breakdown,
  };
}

export function scoreDiagnostic(score) {
  return {
    stage: "score",
    severity: score.total > 0 ? "warning" : "info",
    message: `Layout score: ${roundScore(score.total)}`,
    data: {
      total: roundScore(score.total),
      breakdown: Object.fromEntries(
        Object.entries(score.breakdown).map(([key, value]) => [key, roundScore(value)])
      ),
    },
  };
}

function scoreMissingCoordinates(layout, semantic) {
  return semantic.vertices
    .filter((vertex) => !layout.positions?.[vertex.id])
    .length * 100;
}

function scoreNonFiniteCoordinates(layout) {
  return Object.values(layout.positions || {})
    .filter((position) => !Number.isFinite(position.x) || !Number.isFinite(position.y))
    .length * 100;
}

function scoreExternalBoundaryRoles(layout, prepared) {
  if (prepared.orientation.mode !== "process" || layout.options?.tikzOrientation) {
    return 0;
  }

  const options = layout.options || {};
  const tolerance = 4;
  const incomingLayer = options.orientation?.endsWith("reverse")
    ? options.width - options.marginX
    : options.marginX;
  const outgoingLayer = options.orientation?.endsWith("reverse")
    ? options.marginX
    : options.width - options.marginX;
  let penalty = 0;

  prepared.semantic.incoming.forEach((node) => {
    const position = layout.positions?.[node];

    if (position) {
      penalty += outsideTolerance(Math.abs(position.x - incomingLayer), tolerance);
    }
  });

  prepared.semantic.outgoing.forEach((node) => {
    const position = layout.positions?.[node];

    if (position) {
      penalty += outsideTolerance(Math.abs(position.x - outgoingLayer), tolerance);
    }
  });

  return penalty;
}

function scoreParallelEdgeOverlap(prepared) {
  const plannedByEdge = new Map((prepared.parallelCurvePlan || []).map((entry) => [entry.propagator, entry]));

  return (prepared.topology.parallelEdgeGroups || []).reduce((penalty, group) => {
    if (!group.internal || group.edges.length < 2) {
      return penalty;
    }

    const signatures = new Set();
    let groupPenalty = 0;

    group.edges.forEach((edge) => {
      const planned = plannedByEdge.get(edge.id);
      const signature = planned
        ? `${planned.side}:${planned.amount}`
        : edge.curveSide
          ? `${edge.curveSide}:${edge.curveAmount}`
        : "line";

      if (signatures.has(signature)) {
        groupPenalty += 25;
      }

      signatures.add(signature);

      if (signature === "line") {
        groupPenalty += 25;
      }
    });

    return penalty + groupPenalty;
  }, 0);
}

function scoreExternalAlignment(layout, prepared) {
  const ordering = prepared.externalOrdering;

  if (!ordering || prepared.orientation.mode !== "process" || layout.options?.tikzOrientation) {
    return 0;
  }

  return scoreOrderedCross(layout, ordering.incoming)
    + scoreOrderedCross(layout, ordering.outgoing);
}

function scoreOrderedCross(layout, entries) {
  const positions = entries
    .map((entry) => layout.positions?.[entry.id])
    .filter((position) => (
      position
      && Number.isFinite(position.x)
      && Number.isFinite(position.y)
    ));

  if (positions.length <= 1) {
    return 0;
  }

  const centerX = Number.isFinite(layout.width)
    ? layout.width / 2
    : positions.reduce((sum, position) => sum + position.x, 0) / positions.length;
  const averageX = positions.reduce((sum, position) => sum + position.x, 0) / positions.length;
  const bottomToTop = averageX <= centerX;

  return bottomToTop
    ? scoreDescendingCross(positions)
    : scoreAscendingCross(positions);
}

function scoreAscendingCross(positions) {
  let penalty = 0;
  let previous = -Infinity;

  positions.forEach((position) => {
    if (position.y + 0.001 < previous) {
      penalty += previous - position.y;
    }

    previous = Math.max(previous, position.y);
  });

  return penalty;
}

function scoreDescendingCross(positions) {
  let penalty = 0;
  let previous = Infinity;

  positions.forEach((position) => {
    if (position.y + 0.001 < previous) {
      previous = Math.min(previous, position.y);
      return;
    }

    penalty += position.y - previous;
    previous = Math.min(previous, position.y);
  });

  return penalty;
}

function scoreSymmetry(layout, prepared) {
  if (prepared.orientation.mode !== "symmetric" || !prepared.semantic.unclassified.length) {
    return 0;
  }

  const center = centerOfPositions(layout.positions || {});
  const distances = prepared.semantic.unclassified
    .map((node) => layout.positions?.[node])
    .filter(Boolean)
    .map((position) => Math.hypot(position.x - center.x, position.y - center.y));

  if (distances.length < 2) {
    return 0;
  }

  return (Math.max(...distances) - Math.min(...distances)) / 20;
}

function symmetricUnclassifiedRefinement(prepared) {
  return prepared.symmetricUnclassified?.applicable ? prepared.symmetricUnclassified : null;
}

function scoreSymmetricUnclassifiedBranchLengths(layout, prepared) {
  const refinement = symmetricUnclassifiedRefinement(prepared);

  if (!refinement) {
    return 0;
  }

  if (refinement.kind === "twoCenterTree") {
    const leftLengths = branchLengths(layout, refinement.leftCenter, refinement.leftLeaves);
    const rightLengths = branchLengths(layout, refinement.rightCenter, refinement.rightLeaves);

    return range(leftLengths) / 24 + range(rightLengths) / 24
      + Math.abs(average(leftLengths) - average(rightLengths)) / 28;
  }

  if (refinement.kind === "twoPointLoop") {
    const lengths = (refinement.externalLegs || []).map((leg) => (
      distance(layout.positions?.[leg.external], layout.positions?.[leg.internal])
    )).filter((value) => Number.isFinite(value));

    return lengths.length >= 2 ? range(lengths) / 24 : 0;
  }

  return 0;
}

function scoreSymmetricUnclassifiedBranchAngles(layout, prepared) {
  const refinement = symmetricUnclassifiedRefinement(prepared);

  if (!refinement || refinement.kind !== "twoCenterTree") {
    return 0;
  }

  const axis = backboneAxis(layout, refinement.leftCenter, refinement.rightCenter);

  if (!axis) {
    return 0;
  }

  const leftAngles = signedCrossAxisAngles(layout, refinement.leftCenter, refinement.leftLeaves, axis);
  const rightAngles = signedCrossAxisAngles(layout, refinement.rightCenter, refinement.rightLeaves, axis);

  return mirrorAnglePenalty(leftAngles, rightAngles);
}

function scoreSymmetricUnclassifiedMirrorDeviation(layout, prepared) {
  const refinement = symmetricUnclassifiedRefinement(prepared);

  if (!refinement || refinement.kind !== "twoCenterTree") {
    return 0;
  }

  const axis = backboneAxis(layout, refinement.leftCenter, refinement.rightCenter);
  const midpoint = midpointOf(layout.positions?.[refinement.leftCenter], layout.positions?.[refinement.rightCenter]);

  if (!axis || !midpoint) {
    return 0;
  }

  let penalty = 0;
  const pairCount = Math.min(refinement.leftLeaves.length, refinement.rightLeaves.length);

  for (let index = 0; index < pairCount; index += 1) {
    const left = layout.positions?.[refinement.leftLeaves[index]];
    const right = layout.positions?.[refinement.rightLeaves[index]];

    if (!left || !right) {
      continue;
    }

    const mirrored = reflectAcrossAxis(left, midpoint, axis);
    penalty += distance(mirrored, right) / 36;
  }

  return penalty;
}

function scoreSymmetricUnclassifiedCenteredInteraction(layout, prepared) {
  const refinement = symmetricUnclassifiedRefinement(prepared);

  if (!refinement) {
    return 0;
  }

  const options = layout.options || {};
  const canvasCenter = {
    x: (layout.width ?? options.width ?? 0) / 2,
    y: (layout.height ?? options.height ?? 0) / 2,
  };
  let penalty = 0;

  if (refinement.kind === "twoCenterTree") {
    const left = layout.positions?.[refinement.leftCenter];
    const right = layout.positions?.[refinement.rightCenter];
    const interactionCenter = midpointOf(left, right);

    if (interactionCenter) {
      penalty += distance(interactionCenter, canvasCenter) / 40;
    }
  }

  if (refinement.kind === "twoPointLoop") {
    const [endpointA, endpointB] = refinement.loopEndpoints || [];
    const center = midpointOf(layout.positions?.[endpointA], layout.positions?.[endpointB]);

    if (center) {
      penalty += distance(center, canvasCenter) / 40;
    }
  }

  return penalty;
}

function scoreSymmetricUnclassifiedExternalLegBalance(layout, prepared) {
  const refinement = symmetricUnclassifiedRefinement(prepared);

  if (!refinement || refinement.kind !== "twoPointLoop") {
    return 0;
  }

  const [endpointA, endpointB] = refinement.loopEndpoints || [];
  const positionA = layout.positions?.[endpointA];
  const positionB = layout.positions?.[endpointB];
  const axis = backboneAxis(layout, endpointA, endpointB);

  if (!positionA || !positionB || !axis) {
    return 0;
  }

  let penalty = 0;

  (refinement.externalLegs || []).forEach((leg) => {
    const external = layout.positions?.[leg.external];
    const internal = layout.positions?.[leg.internal];

    if (!external || !internal) {
      return;
    }

    const axialOffset = (
      (external.x - internal.x) * axis.x
      + (external.y - internal.y) * axis.y
    );

    if (Math.abs(axialOffset) < 8) {
      penalty += (8 - Math.abs(axialOffset)) * 2;
    }
  });

  const axialOffsets = (refinement.externalLegs || []).map((leg) => {
    const external = layout.positions?.[leg.external];
    const internal = layout.positions?.[leg.internal];

    if (!external || !internal) {
      return null;
    }

    return (
      (external.x - internal.x) * axis.x
      + (external.y - internal.y) * axis.y
    );
  }).filter((value) => Number.isFinite(value));

  if (axialOffsets.length === 2 && axialOffsets[0] * axialOffsets[1] >= 0) {
    penalty += Math.abs(axialOffsets[0]) + Math.abs(axialOffsets[1]);
  }

  return penalty;
}

function scoreMultiloopRegionOverlap(layout, prepared) {
  const regions = scoredMultiloopRegions(layout, prepared);

  if (prepared.topology.detectedTopology !== "multiLoop" || regions.length < 2) {
    return 0;
  }

  const boxes = regions
    .map((region) => ({
      region,
      box: boundingBox(region.nodes.map((node) => layout.positions?.[node]).filter(Boolean)),
    }))
    .filter((entry) => entry.box);
  let penalty = 0;

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];

      if (!sharedCount(left.region.nodes, right.region.nodes) && boxesOverlap(left.box, right.box, 10)) {
        penalty += 60;
      }
    }
  }

  return penalty;
}

function scoreMultiloopContainmentViolation(layout, prepared) {
  const regions = prepared.topology.loopRegions || [];

  if (prepared.topology.multiLoop?.kind !== "nested") {
    return 0;
  }

  const byId = new Map(regions.map((region) => [region.id, region]));
  let penalty = 0;

  regions.forEach((outer) => {
    const outerBox = boundingBox(outer.nodes.map((node) => layout.positions?.[node]).filter(Boolean));

    (outer.contains || []).forEach((childId) => {
      const child = byId.get(childId);
      const childBox = boundingBox((child?.nodes || []).map((node) => layout.positions?.[node]).filter(Boolean));

      if (outerBox && childBox && !boxContains(outerBox, childBox, 4)) {
        penalty += 80;
      }
    });
  });

  return penalty;
}

function scoreMultiloopInterleaving(layout, prepared) {
  const selection = layout.multiloopCandidate;

  if (!selection || prepared.topology.detectedTopology !== "multiLoop") {
    return 0;
  }

  const centers = (prepared.topology.loopRegions || [])
    .filter((region) => selection.regions?.includes(region.id))
    .map((region) => centerForNodes(layout, region.nodes))
    .filter(Boolean)
    .sort((left, right) => left.x - right.x);

  if (centers.length < 3) {
    return 0;
  }

  return centers.reduce((penalty, center, index) => {
    if (index === 0) {
      return penalty;
    }

    return center.x < centers[index - 1].x ? penalty + 40 : penalty;
  }, 0);
}

function scoreTopologyRecognizability(layout, prepared) {
  if (prepared.topology.detectedTopology !== "multiLoop") {
    return 0;
  }

  return scoredMultiloopRegions(layout, prepared).reduce((penalty, region) => {
    const points = region.nodes.map((node) => layout.positions?.[node]).filter(Boolean);

    if (region.nodes.length >= 3 && Math.abs(polygonArea(points)) < 200) {
      return penalty + 100;
    }

    if (region.kind === "box" && points.length === 4 && !isConvexPolygon(points)) {
      return penalty + 120;
    }

    return penalty;
  }, 0);
}

function branchLengths(layout, center, leaves) {
  const centerPosition = layout.positions?.[center];

  return leaves
    .map((leaf) => layout.positions?.[leaf])
    .filter(Boolean)
    .map((position) => distance(centerPosition, position));
}

function backboneAxis(layout, left, right) {
  const leftPosition = layout.positions?.[left];
  const rightPosition = layout.positions?.[right];

  if (!leftPosition || !rightPosition) {
    return null;
  }

  const dx = rightPosition.x - leftPosition.x;
  const dy = rightPosition.y - leftPosition.y;
  const length = Math.hypot(dx, dy);

  if (!length) {
    return null;
  }

  return { x: dx / length, y: dy / length };
}

function signedCrossAxisAngles(layout, center, leaves, axis) {
  const centerPosition = layout.positions?.[center];
  const normal = { x: -axis.y, y: axis.x };

  return leaves
    .map((leaf) => layout.positions?.[leaf])
    .filter(Boolean)
    .map((position) => (
      (position.x - centerPosition.x) * normal.x + (position.y - centerPosition.y) * normal.y
    ))
    .sort((left, right) => left - right);
}

function mirrorAnglePenalty(leftValues, rightValues) {
  const pairCount = Math.min(leftValues.length, rightValues.length);
  let penalty = 0;

  for (let index = 0; index < pairCount; index += 1) {
    penalty += Math.abs(leftValues[index] + rightValues[index]) / 24;
  }

  return penalty + range(leftValues) / 30 + range(rightValues) / 30;
}

function midpointOf(left, right) {
  if (!left || !right) {
    return null;
  }

  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function reflectAcrossAxis(point, midpoint, axis) {
  const relative = {
    x: point.x - midpoint.x,
    y: point.y - midpoint.y,
  };
  const along = relative.x * axis.x + relative.y * axis.y;
  const alongVector = { x: axis.x * along, y: axis.y * along };
  const normalVector = {
    x: relative.x - alongVector.x,
    y: relative.y - alongVector.y,
  };

  return {
    x: midpoint.x + alongVector.x - normalVector.x,
    y: midpoint.y + alongVector.y - normalVector.y,
  };
}

function signedNormalDistance(point, from, to, axis) {
  const midpoint = midpointOf(from, to);
  const normal = { x: -axis.y, y: axis.x };

  return (point.x - midpoint.x) * normal.x + (point.y - midpoint.y) * normal.y;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreCandidateEdgeOverlap(layout, prepared) {
  if (!layout.loopCandidate && !prepared.topology.loopCandidate) {
    return 0;
  }

  const segments = prepared.semantic.propagators
    .filter((edge) => !edge.metadata.hidden && edge.source !== edge.target)
    .map((edge) => ({
      edge,
      from: layout.positions?.[edge.source],
      to: layout.positions?.[edge.target],
    }))
    .filter((entry) => entry.from && entry.to);
  let penalty = 0;

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const left = segments[leftIndex];
      const right = segments[rightIndex];

      if (shareEndpoint(left.edge, right.edge)) {
        continue;
      }

      if (segmentsIntersect(left.from, left.to, right.from, right.to)) {
        penalty += 35;
      }
    }
  }

  return penalty;
}

function scoreCandidateLoopReadability(layout, prepared, candidate = {}) {
  const loop = candidate?.loop || prepared.topology.loopCandidate;

  if (!loop) {
    return 0;
  }

  const positions = loop.nodes
    .map((node) => layout.positions?.[node])
    .filter(Boolean);

  if (positions.length !== loop.nodes.length) {
    return 100;
  }

  if (positions.some((position) => !Number.isFinite(position.x) || !Number.isFinite(position.y))) {
    return 100;
  }

  if (loop.type === "tadpole") {
    const position = positions[0];
    const minClearance = Math.min(
      position.x - (layout.options?.marginX ?? 0),
      (layout.width ?? 0) - (layout.options?.marginX ?? 0) - position.x,
      position.y - (layout.options?.marginY ?? 0),
      (layout.height ?? 0) - (layout.options?.marginY ?? 0) - position.y
    );

    return minClearance < 42 ? 42 - minClearance : 0;
  }

  const area = Math.abs(polygonArea(positions));
  const minArea = Math.max(900, loop.nodes.length * 420);
  const edgeLengths = positions.map((position, index) => (
    distance(position, positions[(index + 1) % positions.length])
  ));
  const minEdge = Math.min(...edgeLengths);
  const maxEdge = Math.max(...edgeLengths);
  let penalty = 0;

  if (area < minArea) {
    penalty += (minArea - area) / 20;
  }

  if (minEdge < 42) {
    penalty += 42 - minEdge;
  }

  if (maxEdge > 0 && minEdge > 0) {
    penalty += Math.max(0, maxEdge / minEdge - 2.4) * 15;
  }

  return penalty;
}

function scoreLoopSymmetryRefinement(layout, prepared, candidate = {}) {
  const loop = candidate?.loop || prepared.topology.loopCandidate;

  if (!loop || loop.type === "tadpole") {
    return 0;
  }

  const positions = loop.nodes
    .map((node) => layout.positions?.[node])
    .filter(Boolean);

  if (positions.length !== loop.nodes.length || positions.length < 3) {
    return 0;
  }

  const center = averagePosition(positions);
  const edgeLengths = positions.map((position, index) => (
    distance(position, positions[(index + 1) % positions.length])
  ));
  const radii = positions.map((position) => distance(position, center));
  let penalty = 0;

  penalty += range(edgeLengths) / 36;
  penalty += range(radii) / 42;

  if (loop.nodes.length === 3) {
    const area = Math.abs(polygonArea(positions));
    const perimeter = edgeLengths.reduce((sum, value) => sum + value, 0);
    const idealArea = perimeter > 0
      ? (Math.sqrt(3) / 36) * perimeter * perimeter
      : 0;

    if (idealArea > 0 && area < idealArea * 0.55) {
      penalty += (idealArea * 0.55 - area) / 180;
    }
  }

  if (loop.nodes.length === 4) {
    if (!isConvexPolygon(positions)) {
      penalty += 55;
    }

    const firstDiagonal = distance(positions[0], positions[2]);
    const secondDiagonal = distance(positions[1], positions[3]);
    const maxDiagonal = Math.max(firstDiagonal, secondDiagonal);
    const minDiagonal = Math.min(firstDiagonal, secondDiagonal);

    if (minDiagonal > 0) {
      penalty += Math.max(0, maxDiagonal / minDiagonal - 1.7) * 18;
    }
  }

  penalty += scoreEquivalentExternalLegLengths(layout, prepared, loop);

  return penalty;
}

function scoreEquivalentExternalLegLengths(layout, prepared, loop) {
  const groups = new Map();

  (loop.externalLegs || []).forEach((leg) => {
    const externalPosition = layout.positions?.[leg.external];
    const internalPosition = layout.positions?.[leg.internal];

    if (!externalPosition || !internalPosition) {
      return;
    }

    const role = roleFor(prepared, leg.external);

    if (role === "none") {
      return;
    }

    if (!groups.has(role)) {
      groups.set(role, []);
    }

    groups.get(role).push(distance(externalPosition, internalPosition));
  });

  let penalty = 0;

  groups.forEach((lengths) => {
    if (lengths.length >= 2) {
      penalty += range(lengths) / 28;
    }
  });

  return penalty;
}

function scoreCandidateExternalLegStraightness(layout, prepared) {
  if (!layout.loopCandidate && !prepared.topology.loopCandidate) {
    return 0;
  }

  const external = new Set(prepared.semantic.externalVertices);
  const internals = new Set(prepared.semantic.internalVertices);
  const terminalsByRole = {
    incoming: [],
    outgoing: [],
  };
  let penalty = 0;

  prepared.semantic.propagators
    .filter((edge) => !edge.metadata.hidden)
    .forEach((edge) => {
      const externalNode = external.has(edge.source) ? edge.source : external.has(edge.target) ? edge.target : null;
      const internalNode = internals.has(edge.source) ? edge.source : internals.has(edge.target) ? edge.target : null;

      if (!externalNode || !internalNode) {
        return;
      }

      const externalPosition = layout.positions?.[externalNode];
      const internalPosition = layout.positions?.[internalNode];

      if (!externalPosition || !internalPosition) {
        return;
      }

      const role = roleFor(prepared, externalNode);

      if (role === "incoming" || role === "outgoing") {
        penalty += Math.abs(externalPosition.y - internalPosition.y) / 8;
      }
    });

  prepared.semantic.externalVertices.forEach((node) => {
    const role = roleFor(prepared, node);
    const position = layout.positions?.[node];

    if ((role === "incoming" || role === "outgoing") && position) {
      terminalsByRole[role].push(position);
    }
  });

  Object.values(terminalsByRole).forEach((positions) => {
    positions
      .sort((left, right) => left.y - right.y)
      .forEach((position, index) => {
        if (index === 0) {
          return;
        }

        const gap = position.y - positions[index - 1].y;

        if (gap < 28) {
          penalty += (28 - gap) / 2;
        }
      });
  });

  return penalty;
}

function roleFor(prepared, node) {
  const vertex = prepared.semantic.vertices.find((entry) => entry.id === node);

  return vertex?.externalRole || "none";
}

function shareEndpoint(left, right) {
  return left.source === right.source
    || left.source === right.target
    || left.target === right.source
    || left.target === right.target;
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  return abC * abD < -0.000001 && cdA * cdB < -0.000001;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function polygonArea(points) {
  let area = 0;

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];

    area += point.x * next.y - next.x * point.y;
  });

  return area / 2;
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function averagePosition(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function centerForNodes(layout, nodes) {
  const points = nodes.map((node) => layout.positions?.[node]).filter(Boolean);

  return points.length ? averagePosition(points) : null;
}

function boundingBox(points) {
  if (!points.length) {
    return null;
  }

  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function boxesOverlap(left, right, padding = 0) {
  return left.minX - padding <= right.maxX
    && left.maxX + padding >= right.minX
    && left.minY - padding <= right.maxY
    && left.maxY + padding >= right.minY;
}

function boxContains(outer, inner, padding = 0) {
  return inner.minX >= outer.minX - padding
    && inner.maxX <= outer.maxX + padding
    && inner.minY >= outer.minY - padding
    && inner.maxY <= outer.maxY + padding;
}

function sharedCount(left, right) {
  const rightSet = new Set(right);

  return left.filter((value) => rightSet.has(value)).length;
}

function range(values) {
  if (values.length < 2) {
    return 0;
  }

  return Math.max(...values) - Math.min(...values);
}

function isConvexPolygon(points) {
  let sign = 0;

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[index];
    const current = points[(index + 1) % points.length];
    const next = points[(index + 2) % points.length];
    const cross = orientation(previous, current, next);

    if (Math.abs(cross) < 0.001) {
      continue;
    }

    const currentSign = Math.sign(cross);

    if (!sign) {
      sign = currentSign;
    } else if (sign !== currentSign) {
      return false;
    }
  }

  return true;
}

function scoredMultiloopRegions(layout, prepared) {
  const regions = prepared.topology.loopRegions || [];
  const selectedIds = new Set(layout.multiloopCandidate?.regions || []);
  const selected = selectedIds.size
    ? regions.filter((region) => selectedIds.has(region.id))
    : [];
  const primitive = regions.filter((region) => (
    region.loopOrder === 1 && !(region.contains || []).length
  ));

  return selected.length ? selected : primitive.length ? primitive : regions;
}

function centerOfPositions(positions) {
  const values = Object.values(positions).filter((position) => (
    Number.isFinite(position.x) && Number.isFinite(position.y)
  ));

  if (!values.length) {
    return { x: 0, y: 0 };
  }

  return {
    x: values.reduce((sum, position) => sum + position.x, 0) / values.length,
    y: values.reduce((sum, position) => sum + position.y, 0) / values.length,
  };
}

function outsideTolerance(value, tolerance) {
  return Math.max(0, value - tolerance);
}

function roundScore(value) {
  return Math.round(value * 1000) / 1000;
}
