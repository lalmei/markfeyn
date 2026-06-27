import { compareStable } from "../model.js";

// Topologies that are effective point vertices (contact interactions) or otherwise
// not built from continuous propagator fermion lines. For these, an internal-vertex
// fermion-flow imbalance is expected and is not treated as a custom-graph signal.
const FERMION_FLOW_EXEMPT_TOPOLOGIES = new Set([
  "contactInteraction",
  "vacuum",
  "unknown",
]);

// Fermion number must be conserved: a fermion line is a continuous, directed path
// that only terminates on external legs, so at every internal vertex the number of
// fermion arrows pointing in equals the number pointing out. A definite imbalance
// (with no unspecified arrows) means fermion number is not conserved, which marks a
// custom graph. External fermions are reported separately as the endpoints of those
// lines.
export function analyzeFermionFlow(semantic, visibleEdges, detectedTopology) {
  const internalVertices = new Set(semantic.internalVertices);
  const externalVertices = new Set(semantic.externalVertices);
  const fermionEdges = visibleEdges.filter((edge) => edge.style === "fermion");
  const flux = new Map();

  const bucket = (id) => {
    if (!flux.has(id)) {
      flux.set(id, { in: 0, out: 0, unspecified: 0 });
    }

    return flux.get(id);
  };

  fermionEdges.forEach((edge) => {
    if (edge.source === edge.target) {
      const node = bucket(edge.source);

      if (edge.fermionFlow === "source-to-target" || edge.fermionFlow === "target-to-source") {
        node.in += 1;
        node.out += 1;
      } else {
        node.unspecified += 2;
      }

      return;
    }

    const source = bucket(edge.source);
    const target = bucket(edge.target);

    if (edge.fermionFlow === "source-to-target") {
      source.out += 1;
      target.in += 1;
    } else if (edge.fermionFlow === "target-to-source") {
      source.in += 1;
      target.out += 1;
    } else {
      source.unspecified += 1;
      target.unspecified += 1;
    }
  });

  const violations = [];
  let unresolved = false;

  Array.from(flux.entries())
    .filter(([id]) => internalVertices.has(id))
    .sort(([left], [right]) => compareStable(left, right))
    .forEach(([vertex, tally]) => {
      if (tally.unspecified > 0) {
        unresolved = true;
        return;
      }

      if (tally.in !== tally.out) {
        violations.push({ vertex, in: tally.in, out: tally.out });
      }
    });

  const externalFermions = [];

  fermionEdges.forEach((edge) => {
    const sourceExternal = externalVertices.has(edge.source);
    const targetExternal = externalVertices.has(edge.target);

    if (sourceExternal === targetExternal) {
      return;
    }

    const external = sourceExternal ? edge.source : edge.target;
    const internal = sourceExternal ? edge.target : edge.source;
    const arrowTarget = fermionArrowTarget(edge);
    let direction = "unspecified";

    if (arrowTarget === internal) {
      direction = "incoming";
    } else if (arrowTarget === external) {
      direction = "outgoing";
    }

    externalFermions.push({
      external,
      internal,
      edge: edge.id,
      edgeIndex: edge.metadata.edgeIndex,
      direction,
    });
  });

  externalFermions.sort((left, right) => (
    left.edgeIndex - right.edgeIndex
    || compareStable(left.external, right.external)
  ));

  const conserved = violations.length === 0;
  const customGraph = !conserved && !FERMION_FLOW_EXEMPT_TOPOLOGIES.has(detectedTopology);

  return {
    fermionEdgeCount: fermionEdges.length,
    externalFermionCount: externalFermions.length,
    externalFermions,
    conserved,
    unresolved,
    violations,
    customGraph,
  };
}

export function fermionArrowTarget(edge) {
  if (edge.fermionFlow === "source-to-target") {
    return edge.target;
  }

  if (edge.fermionFlow === "target-to-source") {
    return edge.source;
  }

  return null;
}

export function fermionFlowLimitations(fermionFlow) {
  if (fermionFlow.customGraph) {
    return [{
      code: "fermion-number-not-conserved",
      message: "Fermion number is not conserved at one or more internal vertices, so the diagram is treated as a custom graph; structural placement still applies but the topology is unverified.",
    }];
  }

  return [];
}
