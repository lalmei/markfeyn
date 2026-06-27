export function classifyTopology(semantic, visibleEdges, connectedComponents, loopOrder, parallelEdgeGroups, oneLoop, multiLoop) {
  const incomingCount = semantic.incoming.length;
  const outgoingCount = semantic.outgoing.length;
  const externalCount = semantic.externalVertices.length;
  const internalCount = semantic.internalVertices.length;

  if (loopOrder > 1 && multiLoop?.regions?.length) {
    return "multiLoop";
  }

  if (parallelEdgeGroups.some((group) => group.selfEnergyLike)) {
    return "selfEnergy";
  }

  if (loopOrder === 1 && oneLoop) {
    if (oneLoop.type === "tadpole") {
      return "tadpole";
    }

    if (oneLoop.type === "triangle") {
      return "triangleLoop";
    }

    if (oneLoop.type === "box") {
      return "boxLoop";
    }

    if (oneLoop.type === "polygon" || oneLoop.type === "simple") {
      return "polygonLoop";
    }

    return "oneLoop";
  }

  if (incomingCount === 1 && outgoingCount >= 2 && loopOrder === 0) {
    return "decay";
  }

  if (incomingCount === 2 && outgoingCount >= 2) {
    return "scattering";
  }

  if (isContactInteraction(semantic, visibleEdges)) {
    return "contactInteraction";
  }

  if (externalCount === 0 && internalCount > 0 && connectedComponents.length > 0) {
    return "vacuum";
  }

  if (loopOrder === 0 && semantic.vertices.length > 0) {
    return "tree";
  }

  return "unknown";
}

export function topologyLimitations(semantic, connectedComponents, loopOrder, oneLoop, loopRegions) {
  const limitations = [];

  if (loopOrder > 1 && !loopRegions.length) {
    limitations.push({
      code: "general-multiloop-layout-not-implemented",
      message: "General multiloop optimization is not implemented; layout falls back to local and ELK heuristics.",
    });
  } else if (loopOrder > 2) {
    limitations.push({
      code: "higher-order-multiloop-heuristic",
      message: "Higher-order multiloop diagrams use bounded region heuristics rather than a complete multiloop optimizer.",
    });
  }

  if (semantic.externalVertices.length === 0 && loopOrder === 1 && oneLoop) {
    limitations.push({
      code: "vacuum-one-loop-centered-only",
      message: "Vacuum one-loop diagrams use deterministic centered polygon placement, not a full vacuum graph optimizer.",
    });
  }

  if (semantic.externalVertices.length === 0 && connectedComponents.length > 1 && loopOrder > 1) {
    limitations.push({
      code: "disconnected-vacuum-multiloop-not-solved",
      message: "Disconnected multiloop vacuum diagrams are detected but not treated as solved by the one-loop candidate layout.",
    });
  }

  return limitations;
}

export function isContactInteraction(semantic, visibleEdges) {
  if (semantic.internalVertices.length !== 1 || semantic.externalVertices.length < 3) {
    return false;
  }

  const center = semantic.internalVertices[0];

  return visibleEdges.every((edge) => edge.source === center || edge.target === center);
}

export function confidenceFor(topology) {
  if (topology === "unknown") {
    return 0.2;
  }

  return 0.85;
}
