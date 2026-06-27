import { compareStable } from "../model.js";
import {
  compareCycleNodeList,
  compareCycleSummaries,
  edgePairKey,
  externalLegsForNodes,
  loopTypeRank,
} from "./regions.js";

export function detectTadpoleLoops(semantic, visibleEdges) {
  const internal = new Set(semantic.internalVertices);

  return visibleEdges
    .filter((edge) => edge.source === edge.target)
    .map((edge) => ({
      id: `tadpole:${edge.source}:${edge.metadata.edgeIndex}`,
      type: "tadpole",
      nodes: [edge.source],
      edges: [edge.id],
      edgeIndices: [edge.metadata.edgeIndex],
      length: 1,
      internal: internal.has(edge.source),
      externalLegs: externalLegsForNodes(semantic, [edge.source]),
    }))
    .sort(compareCycleSummaries);
}

export function detectSimpleInternalCycles(semantic, visibleEdges) {
  const internal = new Set(semantic.internalVertices);
  const pairEdges = internalPairEdges(visibleEdges, internal);
  const adjacency = new Map();

  pairEdges.forEach((edges, key) => {
    const [first, second] = key.split("|");
    addInternalNeighbor(adjacency, first, second);
    addInternalNeighbor(adjacency, second, first);
  });

  const cyclesByKey = new Map();
  const nodes = Array.from(adjacency.keys()).sort(compareStable);

  nodes.forEach((start) => {
    findCyclesFrom(start, start, adjacency, [start], new Set([start]), cyclesByKey);
  });

  return Array.from(cyclesByKey.values())
    .map((nodesInCycle) => cycleSummary(nodesInCycle, pairEdges, semantic))
    .filter(Boolean)
    .sort(compareCycleSummaries);
}

export function selectOneLoopTopology(simpleCycles, tadpoleLoops) {
  const tadpole = tadpoleLoops.find((loop) => loop.internal) || tadpoleLoops[0];

  if (tadpole) {
    return tadpole;
  }

  if (!simpleCycles.length) {
    return null;
  }

  return simpleCycles.slice().sort((left, right) => (
    loopTypeRank(left.type) - loopTypeRank(right.type)
    || left.length - right.length
    || compareCycleSummaries(left, right)
  ))[0];
}

function internalPairEdges(visibleEdges, internal) {
  const pairEdges = new Map();

  visibleEdges.forEach((edge) => {
    if (
      edge.source === edge.target
      || !internal.has(edge.source)
      || !internal.has(edge.target)
    ) {
      return;
    }

    const key = edgePairKey(edge.source, edge.target);

    if (!pairEdges.has(key)) {
      pairEdges.set(key, []);
    }

    pairEdges.get(key).push(edge);
  });

  pairEdges.forEach((edges) => {
    edges.sort((left, right) => (
      left.metadata.edgeIndex - right.metadata.edgeIndex
      || compareStable(left.id, right.id)
    ));
  });

  return pairEdges;
}

function findCyclesFrom(start, current, adjacency, path, visited, cyclesByKey) {
  Array.from(adjacency.get(current) || [])
    .sort(compareStable)
    .forEach((neighbor) => {
      if (neighbor === start && path.length >= 3) {
        const canonical = canonicalCycle(path);
        cyclesByKey.set(canonical.join("|"), canonical);
        return;
      }

      if (visited.has(neighbor) || compareStable(neighbor, start) < 0 || path.length >= 12) {
        return;
      }

      visited.add(neighbor);
      path.push(neighbor);
      findCyclesFrom(start, neighbor, adjacency, path, visited, cyclesByKey);
      path.pop();
      visited.delete(neighbor);
    });
}

function canonicalCycle(nodes) {
  const candidates = [];
  const forward = nodes.slice();
  const reverse = nodes.slice().reverse();

  [forward, reverse].forEach((cycle) => {
    for (let index = 0; index < cycle.length; index += 1) {
      candidates.push([
        ...cycle.slice(index),
        ...cycle.slice(0, index),
      ]);
    }
  });

  return candidates.sort(compareCycleNodeList)[0];
}

function cycleSummary(nodes, pairEdges, semantic) {
  const edges = [];
  const edgeIndices = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const first = nodes[index];
    const second = nodes[(index + 1) % nodes.length];
    const edge = pairEdges.get(edgePairKey(first, second))?.[0];

    if (!edge) {
      return null;
    }

    edges.push(edge.id);
    edgeIndices.push(edge.metadata.edgeIndex);
  }

  return {
    id: `cycle:${nodes.join("|")}`,
    type: cycleType(nodes.length),
    nodes,
    edges,
    edgeIndices,
    length: nodes.length,
    internal: true,
    externalLegs: externalLegsForNodes(semantic, nodes),
  };
}

function cycleType(length) {
  if (length === 3) {
    return "triangle";
  }

  if (length === 4) {
    return "box";
  }

  return "polygon";
}

function addInternalNeighbor(adjacency, node, neighbor) {
  if (!adjacency.has(node)) {
    adjacency.set(node, new Set());
  }

  adjacency.get(node).add(neighbor);
}
