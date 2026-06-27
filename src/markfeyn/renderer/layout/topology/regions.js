import { compareStable } from "../model.js";

export function buildLoopRegions(semantic, cycles, biconnectedComponents) {
  const cycleRegions = cycles.map((cycle, index) => ({
    id: `loop-region:${index + 1}`,
    nodes: cycle.nodes.slice(),
    edges: cycle.edges.slice(),
    loopOrder: 1,
    kind: loopKind(cycle.type),
    cycles: [cycle.id],
    contains: [],
    attachments: externalLegsForNodes(semantic, cycle.nodes),
  }));
  const componentRegions = biconnectedComponents
    .filter((component) => component.loopOrder > 1)
    .map((component, index) => ({
      id: `loop-region:bcc-${index + 1}`,
      nodes: component.nodes.slice().sort(compareStable),
      edges: component.edges.slice().sort(compareStable),
      loopOrder: component.loopOrder,
      kind: "generic",
      cycles: cycles
        .filter((cycle) => cycle.nodes.every((node) => component.nodes.includes(node)))
        .map((cycle) => cycle.id)
        .sort(compareStable),
      contains: [],
      attachments: externalLegsForNodes(semantic, component.nodes),
    }));

  const regions = [...cycleRegions, ...componentRegions]
    .filter((region, index, list) => (
      list.findIndex((other) => sameMembers(region.nodes, other.nodes) && sameMembers(region.edges, other.edges)) === index
    ))
    .sort(compareLoopRegions);

  regions.forEach((region) => {
    region.contains = regions
      .filter((other) => other.id !== region.id && isStrictSubset(other.nodes, region.nodes))
      .map((other) => other.id)
      .sort(compareStable);
  });

  return regions;
}

export function classifyMultiLoop(loopOrder, loopRegions, cycles) {
  if (loopOrder <= 1 || !loopRegions.length) {
    return null;
  }

  const sharedEdges = hasSharedMembers(cycles, "edges");
  const sharedNodes = hasSharedMembers(cycles, "nodes");
  const nested = loopRegions.some((region) => region.kind !== "generic" && region.contains.length);
  const kind = sharedEdges
    ? "overlapping"
    : sharedNodes
      ? "overlapping"
      : nested
        ? "nested"
        : "disjoint";

  return {
    kind,
    loopOrder,
    regions: loopRegions.map((region) => region.id),
  };
}

export function buildPrincipalSkeleton(semantic, loopRegions, biconnected) {
  const regionByNode = new Map();

  loopRegions.forEach((region) => {
    region.nodes.forEach((node) => {
      if (!regionByNode.has(node)) {
        regionByNode.set(node, []);
      }

      regionByNode.get(node).push(region.id);
    });
  });

  const edges = biconnected.bridges
    .map((bridge) => ({
      ...bridge,
      regions: [
        ...(regionByNode.get(bridge.source) || []),
        ...(regionByNode.get(bridge.target) || []),
      ].filter((value, index, list) => list.indexOf(value) === index).sort(compareStable),
    }))
    .sort((left, right) => compareStable(left.id, right.id));

  return {
    articulationVertices: biconnected.articulationVertices.slice(),
    bridges: edges,
    externalAttachments: semantic.externalVertices
      .map((external) => ({
        external,
        internal: firstInternalNeighbor(semantic, external),
      }))
      .filter((entry) => entry.internal)
      .sort((left, right) => compareStable(left.external, right.external)),
  };
}

export function externalLegsForNodes(semantic, nodes) {
  const nodeSet = new Set(nodes);
  const external = new Set(semantic.externalVertices);

  return semantic.propagators
    .filter((edge) => !edge.metadata.hidden)
    .flatMap((edge) => {
      if (nodeSet.has(edge.source) && external.has(edge.target)) {
        return [externalLeg(edge.target, edge.source, edge)];
      }

      if (nodeSet.has(edge.target) && external.has(edge.source)) {
        return [externalLeg(edge.source, edge.target, edge)];
      }

      return [];
    })
    .sort((left, right) => (
      left.edgeIndex - right.edgeIndex
      || compareStable(left.external, right.external)
      || compareStable(left.internal, right.internal)
    ));
}

export function compareCycleSummaries(left, right) {
  return loopTypeRank(left.type) - loopTypeRank(right.type)
    || left.length - right.length
    || compareCycleNodeList(left.nodes, right.nodes)
    || compareCycleNodeList(left.edges, right.edges);
}

export function compareCycleNodeList(left, right) {
  const count = Math.min(left.length, right.length);

  for (let index = 0; index < count; index += 1) {
    const compared = compareStable(left[index], right[index]);

    if (compared) {
      return compared;
    }
  }

  return left.length - right.length;
}

export function edgePairKey(first, second) {
  return [first, second].sort(compareStable).join("|");
}

export function loopTypeRank(type) {
  return {
    tadpole: 0,
    triangle: 1,
    box: 2,
    polygon: 3,
    simple: 3,
  }[type] ?? 4;
}

function externalLeg(external, internal, edge) {
  return {
    external,
    internal,
    edge: edge.id,
    edgeIndex: edge.metadata.edgeIndex,
  };
}

function loopKind(type) {
  if (type === "triangle" || type === "box" || type === "tadpole") {
    return type;
  }

  if (type === "polygon" || type === "simple") {
    return "polygon";
  }

  return "generic";
}

function compareLoopRegions(left, right) {
  return left.loopOrder - right.loopOrder
    || left.nodes.length - right.nodes.length
    || compareCycleNodeList(left.nodes, right.nodes)
    || compareCycleNodeList(left.edges, right.edges);
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isStrictSubset(left, right) {
  const rightSet = new Set(right);

  return left.length < right.length && left.every((value) => rightSet.has(value));
}

function hasSharedMembers(cycles, key) {
  for (let leftIndex = 0; leftIndex < cycles.length; leftIndex += 1) {
    const left = new Set(cycles[leftIndex][key]);

    for (let rightIndex = leftIndex + 1; rightIndex < cycles.length; rightIndex += 1) {
      if (cycles[rightIndex][key].some((value) => left.has(value))) {
        return true;
      }
    }
  }

  return false;
}

function firstInternalNeighbor(semantic, node) {
  const internal = new Set(semantic.internalVertices);
  const edge = semantic.propagators
    .filter((propagator) => !propagator.metadata.hidden)
    .find((propagator) => (
      (propagator.source === node && internal.has(propagator.target))
      || (propagator.target === node && internal.has(propagator.source))
    ));

  if (!edge) {
    return null;
  }

  return edge.source === node ? edge.target : edge.source;
}
