import { compareStable } from "./model.js";
import {
  classifyTopology,
  confidenceFor,
  topologyLimitations,
} from "./topology/classification.js";
import {
  analyzeFermionFlow,
  fermionFlowLimitations,
} from "./topology/fermion-flow.js";
import {
  adjacencyMap,
  components,
  graphCentersFor,
} from "./topology/graph.js";

export { adjacencyMap } from "./topology/graph.js";

export class TopologyAnalyzer {
  constructor(semantic) {
    this.semantic = semantic;
  }

  analyze() {
  const semantic = this.semantic;
  const visibleEdges = semantic.propagators.filter((propagator) => !propagator.metadata.hidden);
  const adjacency = adjacencyMap(semantic.vertices.map((vertex) => vertex.id), visibleEdges);
  const internalEdges = visibleEdges.filter((edge) => (
    edge.source !== edge.target
    && semantic.internalVertices.includes(edge.source)
    && semantic.internalVertices.includes(edge.target)
  ));
  const internalAdjacency = adjacencyMap(semantic.internalVertices, internalEdges);
  const connectedComponents = components(adjacency);
  const externalVertices = semantic.externalVertices.slice().sort(compareStable);
  const internalVertices = semantic.internalVertices.slice().sort(compareStable);
  const parallelEdgeGroups = detectParallelEdgeGroups(semantic, visibleEdges);
  const tadpoleLoops = detectTadpoleLoops(semantic, visibleEdges);
  const simpleCycles = detectSimpleInternalCycles(semantic, visibleEdges);
  const oneLoop = selectOneLoopTopology(simpleCycles, tadpoleLoops);
  const edgeCount = visibleEdges.length;
  const loopOrder = Math.max(0, edgeCount - semantic.vertices.length + connectedComponents.length);
  const biconnected = analyzeBiconnectedComponents(internalAdjacency, internalEdges);
  const cycles = [
    ...simpleCycles,
    ...tadpoleLoops,
  ].sort(compareCycleSummaries);
  const loopRegions = buildLoopRegions(semantic, cycles, biconnected.components);
  const multiLoop = classifyMultiLoop(loopOrder, loopRegions, cycles);
  const detectedTopology = classifyTopology(
    semantic,
    visibleEdges,
    connectedComponents,
    loopOrder,
    parallelEdgeGroups,
    oneLoop,
    multiLoop
  );
  const fermionFlow = analyzeFermionFlow(semantic, visibleEdges, detectedTopology);
  const graphCenters = graphCentersFor(adjacency, internalVertices);
  const principalSkeleton = buildPrincipalSkeleton(semantic, loopRegions, biconnected);
  const limitations = [
    ...topologyLimitations(semantic, connectedComponents, loopOrder, oneLoop, loopRegions),
    ...fermionFlowLimitations(fermionFlow),
  ];

  return {
    connectedComponents,
    externalVertices,
    internalVertices,
    cycles,
    biconnectedComponents: biconnected.components,
    articulationVertices: biconnected.articulationVertices,
    bridges: biconnected.bridges,
    loopOrder,
    detectedTopology,
    multiLoop,
    fermionFlow,
    loopRegions,
    principalSkeleton,
    confidence: confidenceFor(detectedTopology),
    graphCenters,
    repeatedStructures: parallelEdgeGroups.map((group) => ({
      type: group.selfEnergyLike ? "selfEnergyParallelPropagators" : "parallelPropagators",
      nodes: group.nodes,
      edgeCount: group.edges.length,
    })),
    parallelEdgeGroups,
    selfEnergyBubbles: parallelEdgeGroups.filter((group) => group.selfEnergyLike),
    tadpoleLoops,
    loopCandidate: loopOrder === 1 && detectedTopology !== "selfEnergy" ? oneLoop : null,
    inferredSymmetryGroups: inferSimpleSymmetryGroups(semantic),
    limitations,
  };
  }
}

export function analyzeTopology(semantic) {
  return new TopologyAnalyzer(semantic).analyze();
}
// Fermion number must be conserved: a fermion line is a continuous, directed path
// that only terminates on external legs, so at every internal vertex the number of
// fermion arrows pointing in equals the number pointing out. A definite imbalance
// (with no unspecified arrows) means fermion number is not conserved, which marks a
// custom graph. External fermions are reported separately as the endpoints of those
// lines.
function detectTadpoleLoops(semantic, visibleEdges) {
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

function detectSimpleInternalCycles(semantic, visibleEdges) {
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

function selectOneLoopTopology(simpleCycles, tadpoleLoops) {
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

function externalLegsForNodes(semantic, nodes) {
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

function externalLeg(external, internal, edge) {
  return {
    external,
    internal,
    edge: edge.id,
    edgeIndex: edge.metadata.edgeIndex,
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

function loopTypeRank(type) {
  return {
    tadpole: 0,
    triangle: 1,
    box: 2,
    polygon: 3,
    simple: 3,
  }[type] ?? 4;
}
function analyzeBiconnectedComponents(adjacency, edges) {
  const edgeIdsByPair = edgeIdsByPairMap(edges);
  const discovery = new Map();
  const low = new Map();
  const parent = new Map();
  const edgeStack = [];
  const articulation = new Set();
  const bridges = [];
  const componentsFound = [];
  let time = 0;

  Array.from(adjacency.keys()).sort(compareStable).forEach((root) => {
    if (discovery.has(root)) {
      return;
    }

    let rootChildren = 0;

    function visit(node) {
      discovery.set(node, time);
      low.set(node, time);
      time += 1;

      Array.from(adjacency.get(node) || []).sort(compareStable).forEach((neighbor) => {
        const edge = canonicalEdge(node, neighbor);

        if (!discovery.has(neighbor)) {
          parent.set(neighbor, node);
          rootChildren += node === root ? 1 : 0;
          edgeStack.push(edge);
          visit(neighbor);
          low.set(node, Math.min(low.get(node), low.get(neighbor)));

          if ((node === root && rootChildren > 1) || (node !== root && low.get(neighbor) >= discovery.get(node))) {
            articulation.add(node);
            componentsFound.push(popComponent(edgeStack, edge, edgeIdsByPair));
          }

          if (low.get(neighbor) > discovery.get(node)) {
            bridges.push(edgeSummary(node, neighbor, edgeIdsByPair));
          }
        } else if (parent.get(node) !== neighbor && discovery.get(neighbor) < discovery.get(node)) {
          low.set(node, Math.min(low.get(node), discovery.get(neighbor)));
          edgeStack.push(edge);
        }
      });
    }

    visit(root);

    if (edgeStack.length) {
      componentsFound.push(popComponent(edgeStack, null, edgeIdsByPair));
    }
  });

  return {
    components: componentsFound
      .filter((component) => component.nodes.length)
      .map((component, index) => ({
        id: `bcc:${index + 1}`,
        ...component,
        loopOrder: Math.max(0, component.edges.length - component.nodes.length + 1),
      }))
      .sort(compareComponentSummaries),
    articulationVertices: Array.from(articulation).sort(compareStable),
    bridges: bridges.sort((left, right) => compareStable(left.id, right.id)),
  };
}

function buildLoopRegions(semantic, cycles, biconnectedComponents) {
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

function classifyMultiLoop(loopOrder, loopRegions, cycles) {
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

function buildPrincipalSkeleton(semantic, loopRegions, biconnected) {
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

function compareCycleSummaries(left, right) {
  return loopTypeRank(left.type) - loopTypeRank(right.type)
    || left.length - right.length
    || compareCycleNodeList(left.nodes, right.nodes)
    || compareCycleNodeList(left.edges, right.edges);
}

function compareCycleNodeList(left, right) {
  const count = Math.min(left.length, right.length);

  for (let index = 0; index < count; index += 1) {
    const compared = compareStable(left[index], right[index]);

    if (compared) {
      return compared;
    }
  }

  return left.length - right.length;
}

function addInternalNeighbor(adjacency, node, neighbor) {
  if (!adjacency.has(node)) {
    adjacency.set(node, new Set());
  }

  adjacency.get(node).add(neighbor);
}

function edgePairKey(first, second) {
  return [first, second].sort(compareStable).join("|");
}

function detectParallelEdgeGroups(semantic, visibleEdges) {
  const internal = new Set(semantic.internalVertices);
  const grouped = new Map();

  visibleEdges
    .filter((edge) => edge.source !== edge.target)
    .forEach((edge) => {
      const nodes = [edge.source, edge.target].sort(compareStable);
      const key = nodes.join("|");

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          nodes,
          internal: nodes.every((node) => internal.has(node)),
          edges: [],
        });
      }

      grouped.get(key).edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeIndex: edge.metadata.edgeIndex,
        style: edge.style,
        curveSide: edge.metadata.curve?.side,
        curveAmount: edge.metadata.curve?.amount,
      });
    });

  return Array.from(grouped.values())
    .filter((group) => group.edges.length > 1)
    .map((group) => ({
      ...group,
      edges: group.edges.sort((left, right) => left.edgeIndex - right.edgeIndex || compareStable(left.id, right.id)),
      selfEnergyLike: group.internal && group.edges.length >= 2,
    }))
    .sort((left, right) => compareStable(left.id, right.id));
}
function edgeIdsByPairMap(edges) {
  const map = new Map();

  edges.forEach((edge) => {
    const key = edgePairKey(edge.source, edge.target);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(edge.id);
  });

  map.forEach((ids) => ids.sort(compareStable));

  return map;
}

function canonicalEdge(source, target) {
  const [left, right] = [source, target].sort(compareStable);

  return { source: left, target: right, key: `${left}|${right}` };
}

function edgeSummary(source, target, edgeIdsByPair) {
  const edge = canonicalEdge(source, target);

  return {
    id: edgeIdsByPair.get(edge.key)?.[0] || edge.key,
    source: edge.source,
    target: edge.target,
    edges: edgeIdsByPair.get(edge.key) || [],
  };
}

function popComponent(edgeStack, stopEdge, edgeIdsByPair) {
  const nodes = new Set();
  const edges = new Set();

  while (edgeStack.length) {
    const edge = edgeStack.pop();

    nodes.add(edge.source);
    nodes.add(edge.target);
    (edgeIdsByPair.get(edge.key) || [edge.key]).forEach((edgeId) => edges.add(edgeId));

    if (!stopEdge || edge.key === stopEdge.key) {
      break;
    }
  }

  return {
    nodes: Array.from(nodes).sort(compareStable),
    edges: Array.from(edges).sort(compareStable),
  };
}

function compareComponentSummaries(left, right) {
  return compareCycleNodeList(left.nodes, right.nodes)
    || compareCycleNodeList(left.edges, right.edges);
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
function inferSimpleSymmetryGroups(semantic) {
  if (semantic.unclassified.length >= 2) {
    return [semantic.unclassified.slice().sort(compareStable)];
  }

  return [];
}
