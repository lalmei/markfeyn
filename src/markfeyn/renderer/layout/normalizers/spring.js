import {
  nodeKind,
  terminalNeighborsByInternal,
} from "../coordinates.js";

export function centerDefaultSpringExchangeFans(diagram, positions, axes, layoutOptions) {
  if (
    (layoutOptions.layout !== "spring" && layoutOptions.layout !== "spring-electrical")
    || !layoutOptions.orientation.startsWith("horizontal")
    || diagram.incoming.length !== 2
    || diagram.outgoing.length !== 2
  ) {
    return;
  }

  const incomingInternals = internalsConnectedToTerminalSet(diagram, "incoming", diagram.incoming);
  const outgoingInternals = internalsConnectedToTerminalSet(diagram, "outgoing", diagram.outgoing);

  if (incomingInternals.length !== 1 || outgoingInternals.length !== 1) {
    return;
  }

  const incomingInternal = incomingInternals[0];
  const outgoingInternal = outgoingInternals[0];

  if (incomingInternal === outgoingInternal || !visibleInternalEdgeConnects(diagram, incomingInternal, outgoingInternal)) {
    return;
  }

  centerMultiTerminalFanJunctions(
    diagram,
    positions,
    axes,
    new Set([incomingInternal, outgoingInternal])
  );
}

function internalsConnectedToTerminalSet(diagram, kind, terminals) {
  const terminalSet = new Set(terminals);
  const terminalsByInternal = terminalNeighborsByInternal(diagram, kind);

  return Array.from(terminalsByInternal.entries())
    .filter(([, connectedTerminals]) => (
      connectedTerminals.size === terminalSet.size
      && Array.from(connectedTerminals).every((terminal) => terminalSet.has(terminal))
    ))
    .map(([internal]) => internal);
}

function visibleInternalEdgeConnects(diagram, first, second) {
  return diagram.edges.some((edge) => {
    if (edge.hidden) {
      return false;
    }

    return (edge.from === first && edge.to === second)
      || (edge.from === second && edge.to === first);
  });
}

export function centerMultiTerminalFanJunctions(diagram, positions, axes, eligibleInternals) {
  const manual = new Set(Object.keys(diagram.manualPositions || {}));
  const targetCrossesByInternal = new Map();
  const terminalKinds = ["incoming", "outgoing"];

  terminalKinds.forEach((kind) => {
    const terminalsByInternal = terminalNeighborsByInternal(diagram, kind);

    terminalsByInternal.forEach((terminals, internal) => {
      if (
        terminals.size < 2
        || !eligibleInternals.has(internal)
        || manual.has(internal)
        || !positions[internal]
      ) {
        return;
      }

      const crosses = Array.from(terminals)
        .map((terminal) => positions[terminal])
        .filter(Boolean)
        .map((position) => axes.crossOf(position));

      if (crosses.length < 2) {
        return;
      }

      if (!targetCrossesByInternal.has(internal)) {
        targetCrossesByInternal.set(internal, []);
      }

      targetCrossesByInternal.get(internal).push(
        crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length
      );
    });
  });

  targetCrossesByInternal.forEach((crosses, internal) => {
    if (positions[internal]) {
      axes.setCross(
        positions[internal],
        crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length
      );
    }
  });
}

function internalAdjacency(diagram) {
  const adjacency = new Map();

  const addNeighbor = (first, second) => {
    if (!adjacency.has(first)) {
      adjacency.set(first, new Set());
    }

    adjacency.get(first).add(second);
  };

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    const fromKind = nodeKind(edge.from, diagram);
    const toKind = nodeKind(edge.to, diagram);

    if (fromKind === "internal" && toKind === "internal") {
      addNeighbor(edge.from, edge.to);
      addNeighbor(edge.to, edge.from);
    }
  });

  return adjacency;
}

function internalsAdjacentToTerminals(diagram, kind) {
  const internals = new Set();
  const terminalsByInternal = terminalNeighborsByInternal(diagram, kind);

  terminalsByInternal.forEach((terminals, internal) => {
    if (terminals.size > 0) {
      internals.add(internal);
    }
  });

  return internals;
}

function shortestInternalPath(adjacency, start, end) {
  if (start === end) {
    return [start];
  }

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    const neighbors = adjacency.get(node) || new Set();

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue;
      }

      const nextPath = [...path, neighbor];

      if (neighbor === end) {
        return nextPath;
      }

      visited.add(neighbor);
      queue.push(nextPath);
    }
  }

  return null;
}

function mainHorizontalBackboneNodes(diagram) {
  if (!diagram.incoming.length && !diagram.outgoing.length) {
    return null;
  }

  const leftInternals = internalsAdjacentToTerminals(diagram, "incoming");
  const rightInternals = internalsAdjacentToTerminals(diagram, "outgoing");

  if (!leftInternals.size || !rightInternals.size) {
    return null;
  }

  const adjacency = internalAdjacency(diagram);
  let bestPath = null;

  leftInternals.forEach((start) => {
    rightInternals.forEach((end) => {
      if (start === end) {
        return;
      }

      const path = shortestInternalPath(adjacency, start, end);

      if (!path) {
        return;
      }

      if (!bestPath || path.length < bestPath.length) {
        bestPath = path;
      }
    });
  });

  return bestPath;
}

export function alignHorizontalBackboneInternals(diagram, positions, axes, layoutOptions) {
  if (!layoutOptions.orientation.startsWith("horizontal")) {
    return;
  }

  const backbone = mainHorizontalBackboneNodes(diagram);

  if (!backbone || backbone.length < 1) {
    return;
  }

  const manual = new Set(Object.keys(diagram.manualPositions || {}));
  const positioned = backbone
    .map((node) => ({ node, position: positions[node] }))
    .filter((entry) => entry.position);

  if (!positioned.length) {
    return;
  }

  const targetCross = positioned.reduce(
    (sum, entry) => sum + axes.crossOf(entry.position),
    0
  ) / positioned.length;

  positioned.forEach((entry) => {
    if (!manual.has(entry.node)) {
      axes.setCross(entry.position, targetCross);
    }
  });
}

export function orientHorizontalBackboneInternals(diagram, positions, axes, layoutOptions) {
  if (!layoutOptions.orientation.startsWith("horizontal")) {
    return;
  }

  const backbone = mainHorizontalBackboneNodes(diagram);
  const manual = new Set(Object.keys(diagram.manualPositions || {}));

  if (!backbone || backbone.length < 2 || backbone.some((node) => !positions[node] || manual.has(node))) {
    return;
  }

  const direction = Math.sign(axes.layerEnd - axes.layerStart) || 1;
  const orderedLayers = backbone
    .map((node) => positions[node].x)
    .sort((left, right) => direction * (left - right));

  backbone.forEach((node, index) => {
    positions[node].x = orderedLayers[index];
  });
}

function curvedInternalEdgeGroups(diagram) {
  const groups = new Map();

  diagram.edges.forEach((edge) => {
    if (edge.hidden || !edge.curve) {
      return;
    }

    const fromKind = nodeKind(edge.from, diagram);
    const toKind = nodeKind(edge.to, diagram);

    if (fromKind !== "internal" || toKind !== "internal") {
      return;
    }

    const key = [edge.from, edge.to].sort().join("|");

    if (!groups.has(key)) {
      groups.set(key, {
        nodes: [edge.from, edge.to].sort(),
        edges: [],
      });
    }

    groups.get(key).edges.push(edge);
  });

  return groups;
}

function curveArcAmount(edge) {
  if (!edge.curve) {
    return 0;
  }

  return edge.curve.amount * (edge.looseness ?? 1);
}

function maxChordForCurvedEdgeGroup(edges, availableCross) {
  const maxAmount = Math.max(...edges.map((edge) => curveArcAmount(edge)), 0);

  if (maxAmount <= 0 || availableCross <= 0) {
    return null;
  }

  const bilateral = edges.length >= 2;

  if (bilateral) {
    return (availableCross / (2 * maxAmount)) * 0.95;
  }

  return ((availableCross / 2) / maxAmount) * 0.95;
}

export function fitCurvedInternalEdgeGroupsToViewBox(diagram, positions, axes, layoutOptions) {
  if (!layoutOptions.orientation.startsWith("horizontal")) {
    return;
  }

  const manual = new Set(Object.keys(diagram.manualPositions || {}));
  const availableCross = axes.crossEnd - axes.crossStart;

  curvedInternalEdgeGroups(diagram).forEach(({ nodes, edges }) => {
    const [firstNode, secondNode] = nodes;
    const first = positions[firstNode];
    const second = positions[secondNode];

    if (!first || !second || nodes.some((node) => manual.has(node))) {
      return;
    }

    const maxChord = maxChordForCurvedEdgeGroup(edges, availableCross);
    const currentChord = Math.abs(first.x - second.x);

    if (maxChord && currentChord > maxChord) {
      const midLayer = (first.x + second.x) / 2;
      const halfChord = maxChord / 2;

      first.x = midLayer - halfChord;
      second.x = midLayer + halfChord;
    }

    const targetCross = (axes.crossStart + axes.crossEnd) / 2;

    axes.setCross(first, targetCross);
    axes.setCross(second, targetCross);
  });
}
