import { adjacencyMap } from "./topology.js";
import { compareStable } from "./model.js";

/**
 * Focused symmetric-unclassified refinement for balanced two-center trees and
 * symmetric two-point self-energy loops. Not a general automorphism solver.
 */
export function analyzeSymmetricUnclassifiedRefinement(semantic, topology, orientation) {
  if (orientation.mode !== "symmetric") {
    return skipped("orientation is not symmetric");
  }

  if (semantic.incoming.length || semantic.outgoing.length) {
    return skipped("explicit incoming or outgoing roles are declared");
  }

  const visibleEdges = semantic.propagators.filter((propagator) => !propagator.metadata.hidden);
  const adjacency = adjacencyMap(
    semantic.vertices.map((vertex) => vertex.id),
    visibleEdges
  );
  const twoCenterTree = detectTwoCenterUnclassifiedTree(semantic, topology, adjacency);

  if (twoCenterTree) {
    return {
      applicable: true,
      kind: "twoCenterTree",
      ...twoCenterTree,
      scope: "focused two-center unclassified tree heuristic",
    };
  }

  const twoPointLoop = detectSymmetricTwoPointLoop(semantic, topology, adjacency);

  if (twoPointLoop) {
    return {
      applicable: true,
      kind: "twoPointLoop",
      ...twoPointLoop,
      scope: "focused symmetric two-point self-energy heuristic",
    };
  }

  return skipped("topology does not match focused symmetric unclassified patterns");
}

export function symmetricUnclassifiedDiagnostic(refinement) {
  const message = refinement.applicable
    ? `Applied symmetric unclassified refinement: ${refinement.kind}`
    : `Skipped symmetric unclassified refinement: ${refinement.reason}`;

  return {
    stage: "symmetric-unclassified",
    severity: "info",
    message,
    data: {
      applicable: refinement.applicable,
      kind: refinement.kind || null,
      reason: refinement.reason || null,
      scope: refinement.scope || "focused tree and two-point-loop heuristic, not full automorphism solving",
      leftCenter: refinement.leftCenter || null,
      rightCenter: refinement.rightCenter || null,
      leftLeaves: refinement.leftLeaves || null,
      rightLeaves: refinement.rightLeaves || null,
      centerExternal: refinement.centerExternal || null,
      centerAttachedCenter: refinement.centerAttachedCenter || null,
      loopEndpoints: refinement.loopEndpoints || null,
      externalLegs: refinement.externalLegs || null,
    },
  };
}

function skipped(reason) {
  return {
    applicable: false,
    reason,
    scope: "focused tree and two-point-loop heuristic, not full automorphism solving",
  };
}

function detectTwoCenterUnclassifiedTree(semantic, topology, adjacency) {
  if (topology.detectedTopology !== "tree") {
    return null;
  }

  const internals = semantic.internalVertices.slice().sort(compareStable);

  if (internals.length !== 2) {
    return null;
  }

  const [centerA, centerB] = internals;
  const unclassified = new Set(semantic.unclassified);

  if (!adjacency.get(centerA)?.has(centerB)) {
    return null;
  }

  const leavesA = unclassifiedNeighbors(adjacency, centerA, centerB, unclassified);
  const leavesB = unclassifiedNeighbors(adjacency, centerB, centerA, unclassified);

  if (!leavesA.length || !leavesB.length) {
    return null;
  }

  if (Math.abs(leavesA.length - leavesB.length) > 1) {
    return null;
  }

  if (!onlyAllowedNeighbors(adjacency, centerA, centerB, unclassified, leavesA)) {
    return null;
  }

  if (!onlyAllowedNeighbors(adjacency, centerB, centerA, unclassified, leavesB)) {
    return null;
  }

  let ordered = orderTwoCenterSides(semantic, centerA, centerB, leavesA, leavesB);
  const allLeaves = [...ordered.leftLeaves, ...ordered.rightLeaves];
  let centerExternal = null;
  let centerAttachedCenter = null;

  if (allLeaves.length % 2 === 1) {
    centerExternal = medianExternalLeaf(semantic, allLeaves);
    centerAttachedCenter = ordered.leftLeaves.includes(centerExternal)
      ? ordered.leftCenter
      : ordered.rightCenter;
    ordered = {
      ...ordered,
      leftLeaves: ordered.leftLeaves.filter((leaf) => leaf !== centerExternal),
      rightLeaves: ordered.rightLeaves.filter((leaf) => leaf !== centerExternal),
    };
  }

  return {
    leftCenter: ordered.leftCenter,
    rightCenter: ordered.rightCenter,
    leftLeaves: ordered.leftLeaves,
    rightLeaves: ordered.rightLeaves,
    centerExternal,
    centerAttachedCenter,
    backbone: [ordered.leftCenter, ordered.rightCenter],
  };
}

function detectSymmetricTwoPointLoop(semantic, topology, adjacency) {
  if (topology.detectedTopology !== "selfEnergy") {
    return null;
  }

  const bubble = (topology.selfEnergyBubbles || []).find((group) => group.internal && group.edges.length >= 2);

  if (!bubble) {
    return null;
  }

  const [endpointA, endpointB] = bubble.nodes.slice().sort(compareStable);
  const internals = new Set(semantic.internalVertices);
  const unclassified = new Set(semantic.unclassified);

  if (internals.size !== 2) {
    return null;
  }

  const legA = externalLegForEndpoint(adjacency, endpointA, endpointB, unclassified, internals);
  const legB = externalLegForEndpoint(adjacency, endpointB, endpointA, unclassified, internals);

  if (!legA || !legB) {
    return null;
  }

  if (unclassified.size !== 2) {
    return null;
  }

  return {
    loopEndpoints: [endpointA, endpointB],
    externalLegs: [
      { external: legA, internal: endpointA },
      { external: legB, internal: endpointB },
    ],
    bubbleId: bubble.id,
  };
}

function unclassifiedNeighbors(adjacency, center, otherInternal, unclassified) {
  return Array.from(adjacency.get(center) || [])
    .filter((neighbor) => neighbor !== otherInternal && unclassified.has(neighbor))
    .sort(compareStable);
}

function orderTwoCenterSides(semantic, centerA, centerB, leavesA, leavesB) {
  const orderA = earliestDeclarationIndex(semantic, leavesA);
  const orderB = earliestDeclarationIndex(semantic, leavesB);

  if (orderA <= orderB) {
    return {
      leftCenter: centerA,
      rightCenter: centerB,
      leftLeaves: leavesA,
      rightLeaves: leavesB,
    };
  }

  return {
    leftCenter: centerB,
    rightCenter: centerA,
    leftLeaves: leavesB,
    rightLeaves: leavesA,
  };
}

function earliestDeclarationIndex(semantic, leaves) {
  const indices = leaves.map((id) => declarationIndexFor(semantic, id));

  return Math.min(...indices);
}

function declarationIndexFor(semantic, id) {
  const vertex = semantic.vertices.find((entry) => entry.id === id);

  return vertex?.metadata?.declarationIndex ?? Number.MAX_SAFE_INTEGER;
}

function medianExternalLeaf(semantic, leaves) {
  const sorted = leaves.slice().sort((left, right) => (
    declarationIndexFor(semantic, left) - declarationIndexFor(semantic, right)
    || compareStable(left, right)
  ));

  return sorted[Math.floor(sorted.length / 2)];
}

function onlyAllowedNeighbors(adjacency, center, otherInternal, unclassified, leaves) {
  const allowed = new Set([otherInternal, ...leaves]);

  return Array.from(adjacency.get(center) || []).every((neighbor) => allowed.has(neighbor));
}

function externalLegForEndpoint(adjacency, endpoint, otherEndpoint, unclassified, internals) {
  const neighbors = Array.from(adjacency.get(endpoint) || [])
    .filter((neighbor) => neighbor !== otherEndpoint);

  if (neighbors.length !== 1) {
    return null;
  }

  const [neighbor] = neighbors;

  if (!unclassified.has(neighbor) || internals.has(neighbor)) {
    return null;
  }

  return neighbor;
}
