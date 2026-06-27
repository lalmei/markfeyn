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
import {
  detectSimpleInternalCycles,
  detectTadpoleLoops,
  selectOneLoopTopology,
} from "./topology/cycles.js";
import { analyzeBiconnectedComponents } from "./topology/biconnected.js";
import { detectParallelEdgeGroups } from "./topology/parallel.js";
import {
  buildLoopRegions,
  buildPrincipalSkeleton,
  classifyMultiLoop,
  compareCycleSummaries,
} from "./topology/regions.js";

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

function inferSimpleSymmetryGroups(semantic) {
  if (semantic.unclassified.length >= 2) {
    return [semantic.unclassified.slice().sort(compareStable)];
  }

  return [];
}
