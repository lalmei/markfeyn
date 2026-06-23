/**
 * @typedef {"incoming" | "outgoing" | "unclassified" | "none"} ExternalRole
 * @typedef {"source-to-target" | "target-to-source" | "unspecified"} MomentumDirection
 * @typedef {"source-to-target" | "target-to-source" | "none" | "unspecified"} FermionFlow
 * @typedef {"forward" | "backward" | "neutral" | "unspecified"} LayoutDirection
 */

export function createSemanticDiagram(diagram) {
  const nodes = collectSemanticNodes(diagram);
  const explicitIncoming = uniqueList(diagram.incoming || []);
  const explicitOutgoing = uniqueList(diagram.outgoing || []);
  const incoming = new Set(explicitIncoming);
  const outgoing = new Set(explicitOutgoing);
  const degree = visibleDegreeByNode(diagram);
  const vertices = Array.from(nodes).sort(compareStable).map((id) => {
    const externalRole = externalRoleForNode(id, incoming, outgoing, degree);

    return {
      id,
      kind: externalRole === "none" ? "interaction" : "external",
      externalRole,
      fixed: Boolean(diagram.manualPositions?.[id]),
      positionHint: diagram.manualPositions?.[id] || null,
      metadata: {
        declarationIndex: declarationIndexForNode(diagram, id),
        vertexShape: diagram.vertices?.[id],
      },
    };
  });

  return {
    id: diagram.id || "markfeyn-diagram",
    source: diagram,
    vertices,
    propagators: (diagram.edges || []).map((edge, index) => semanticPropagator(edge, index)),
    process: {
      initialState: explicitIncoming,
      finalState: explicitOutgoing,
      preferredFlow: explicitIncoming.length && explicitOutgoing.length ? "left-to-right" : undefined,
    },
    layoutHints: {
      topology: diagram.options?.topology || "auto",
      orientationMode: diagram.options?.orientationMode || "auto",
    },
    externalVertices: vertices.filter((vertex) => vertex.externalRole !== "none").map((vertex) => vertex.id),
    internalVertices: vertices.filter((vertex) => vertex.externalRole === "none").map((vertex) => vertex.id),
    incoming: explicitIncoming,
    outgoing: explicitOutgoing,
    unclassified: vertices
      .filter((vertex) => vertex.externalRole === "unclassified")
      .map((vertex) => vertex.id),
  };
}

export function createCompatibilityDiagram(diagram, semantic) {
  return {
    ...diagram,
    incoming: semantic.incoming.slice(),
    outgoing: semantic.outgoing.slice(),
    unclassified: semantic.unclassified.slice(),
    semantic,
  };
}

export function semanticNodeById(semantic) {
  return new Map(semantic.vertices.map((vertex) => [vertex.id, vertex]));
}

export function semanticVertexRole(semantic, node) {
  return semanticNodeById(semantic).get(node)?.externalRole || "none";
}

export function collectSemanticNodes(diagram) {
  const nodes = new Set([
    ...(diagram.incoming || []),
    ...(diagram.outgoing || []),
    ...(diagram.unclassified || []),
  ]);

  (diagram.edges || []).forEach((edge) => {
    nodes.add(edge.from);
    nodes.add(edge.to);
  });

  Object.keys(diagram.labels || {}).forEach((target) => {
    if (!target.includes("->")) {
      nodes.add(target);
    }
  });

  (diagram.braces || []).forEach((brace) => {
    nodes.add(brace.from);
    nodes.add(brace.to);
  });

  Object.keys(diagram.manualPositions || {}).forEach((node) => nodes.add(node));
  Object.keys(diagram.vertices || {}).forEach((node) => nodes.add(node));

  return nodes;
}

export function visibleDegreeByNode(diagram) {
  const degree = new Map();

  (diagram.edges || [])
    .filter((edge) => !edge.hidden && edge.from !== edge.to)
    .forEach((edge) => {
      degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
    });

  return degree;
}

export function uniqueList(values) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  });

  return result;
}

export function compareStable(left, right) {
  return String(left).localeCompare(String(right));
}

function semanticPropagator(edge, index) {
  return {
    id: edge.id || `${edge.from}->${edge.to}#${index + 1}`,
    source: edge.from,
    target: edge.to,
    style: edge.type || "plain",
    layoutDirection: edge.layoutDirection || "unspecified",
    momentumDirection: semanticMomentumDirection(edge),
    fermionFlow: semanticFermionFlow(edge),
    momentumLabel: edge.labelPlacement?.startsWith("momentum") ? edge.label : undefined,
    particleLabel: edge.labelPlacement?.startsWith("momentum") ? undefined : edge.label,
    routingHint: edge.curve ? "arc" : "automatic",
    metadata: {
      edgeIndex: index,
      hidden: Boolean(edge.hidden),
      arrow: edge.arrow,
      labelSide: edge.labelSide,
      labelPlacement: edge.labelPlacement,
      momentum: edge.momentum ? { ...edge.momentum } : null,
      curve: edge.curve ? { ...edge.curve } : null,
      outAngle: edge.outAngle,
      inAngle: edge.inAngle,
      looseness: edge.looseness,
      relativeAngles: edge.relativeAngles,
    },
  };
}

function semanticMomentumDirection(edge) {
  if (edge.momentumDirection === "forward") {
    return "source-to-target";
  }

  if (edge.momentumDirection === "reverse") {
    return "target-to-source";
  }

  return "unspecified";
}

function semanticFermionFlow(edge) {
  if (edge.type !== "fermion") {
    return edge.arrow ? "unspecified" : "none";
  }

  if (edge.arrow === "reverse") {
    return "target-to-source";
  }

  if (edge.arrow === "forward") {
    return "source-to-target";
  }

  return "unspecified";
}

function externalRoleForNode(node, incoming, outgoing, degree) {
  if (incoming.has(node) && outgoing.has(node)) {
    return "incoming";
  }

  if (incoming.has(node)) {
    return "incoming";
  }

  if (outgoing.has(node)) {
    return "outgoing";
  }

  if ((degree.get(node) || 0) === 1) {
    return "unclassified";
  }

  return "none";
}

function declarationIndexForNode(diagram, node) {
  const candidates = [];

  (diagram.edges || []).forEach((edge, index) => {
    if (edge.from === node || edge.to === node) {
      candidates.push(index);
    }
  });

  return candidates.length ? Math.min(...candidates) : Number.MAX_SAFE_INTEGER;
}
