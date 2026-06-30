import {
  crossCoordinateAt,
  nodeKind,
  terminalNeighborsByInternal,
  visibleAdjacencyForLayout,
  visibleInternalNeighborsForTerminal,
} from "../coordinates.js";

export function terminalCrossLocks(diagram, positions, axes, pinned) {
  const externalKinds = new Set(["incoming", "outgoing"]);
  const constraints = new Map();

  const addConstraint = (node, cross) => {
    if (pinned.has(node)) {
      return;
    }

    if (!constraints.has(node)) {
      constraints.set(node, []);
    }

    constraints.get(node).push(cross);
  };

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    const from = positions[edge.from];
    const to = positions[edge.to];

    if (!from || !to) {
      return;
    }

    const fromExternal = externalKinds.has(from.kind);
    const toExternal = externalKinds.has(to.kind);

    if (fromExternal && !toExternal) {
      addConstraint(edge.to, axes.crossOf(from));
    }

    if (toExternal && !fromExternal) {
      addConstraint(edge.from, axes.crossOf(to));
    }
  });

  const locks = new Map();

  constraints.forEach((crosses, node) => {
    const min = Math.min(...crosses);
    const max = Math.max(...crosses);

    if (max - min <= 1) {
      locks.set(node, crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length);
    }
  });

  return locks;
}

export function straightenSingleTerminalLegs(diagram, positions, axes) {
  const manual = new Set(Object.keys(diagram.manualPositions || {}));
  const terminalKinds = ["incoming", "outgoing"];

  terminalKinds.forEach((kind) => {
    const terminalsByInternal = terminalNeighborsByInternal(diagram, kind, manual);

    terminalsByInternal.forEach((terminals, internal) => {
      if (terminals.size !== 1 || !positions[internal]) {
        return;
      }

      const terminal = Array.from(terminals)[0];

      if (!positions[terminal]) {
        return;
      }

      if (canMoveTerminalCross(terminal, axes.crossOf(positions[internal]), positions, axes, kind)) {
        axes.setCross(positions[terminal], axes.crossOf(positions[internal]));
      }
    });
  });
}

export function alignVerticalProcessTerminalStacks(diagram, positions, axes, layoutOptions) {
  if (!layoutOptions.orientation.startsWith("vertical")) {
    return;
  }

  const manual = new Set(Object.keys(diagram.manualPositions || {}));
  const orderedInternals = [];
  const terminalsByInternal = new Map();

  diagram.incoming.forEach((terminal) => {
    const internals = visibleInternalNeighborsForTerminal(diagram, terminal, manual);

    if (internals.length !== 1) {
      return;
    }

    const internal = internals[0];

    if (!orderedInternals.includes(internal)) {
      orderedInternals.push(internal);
    }

    addTerminalForInternal(terminalsByInternal, internal, terminal);
  });

  diagram.outgoing.forEach((terminal) => {
    const internals = visibleInternalNeighborsForTerminal(diagram, terminal, manual);

    if (internals.length !== 1) {
      return;
    }

    const internal = internals[0];

    if (!orderedInternals.includes(internal)) {
      orderedInternals.push(internal);
    }

    addTerminalForInternal(terminalsByInternal, internal, terminal);
  });

  if (orderedInternals.length < 2) {
    return;
  }

  orderedInternals.forEach((internal, index) => {
    const cross = crossCoordinateAt(index, orderedInternals.length, axes.crossStart, axes.crossEnd);

    if (positions[internal] && !manual.has(internal)) {
      axes.setCross(positions[internal], cross);
    }

    (terminalsByInternal.get(internal) || []).forEach((terminal) => {
      if (positions[terminal] && !manual.has(terminal)) {
        axes.setCross(positions[terminal], cross);
      }
    });
  });
}

function addTerminalForInternal(terminalsByInternal, internal, terminal) {
  if (!terminalsByInternal.has(internal)) {
    terminalsByInternal.set(internal, []);
  }

  if (!terminalsByInternal.get(internal).includes(terminal)) {
    terminalsByInternal.get(internal).push(terminal);
  }
}

export function alignInternalsAcrossInvisibleTerminalPairs(diagram, positions, axes) {
  const manual = new Set(Object.keys(diagram.manualPositions || {}));
  const terminalKinds = new Set(["incoming", "outgoing"]);

  diagram.edges.forEach((edge) => {
    if (!edge.hidden) {
      return;
    }

    const fromKind = nodeKind(edge.from, diagram);
    const toKind = nodeKind(edge.to, diagram);

    if (!terminalKinds.has(fromKind) || fromKind !== toKind) {
      return;
    }

    const internalsFrom = visibleInternalNeighborsForTerminal(diagram, edge.from, manual);
    const internalsTo = visibleInternalNeighborsForTerminal(diagram, edge.to, manual);

    if (internalsFrom.length !== 1 || internalsTo.length !== 1) {
      return;
    }

    const firstInternal = internalsFrom[0];
    const secondInternal = internalsTo[0];

    if (
      firstInternal === secondInternal
      || !positions[firstInternal]
      || !positions[secondInternal]
      || manual.has(firstInternal)
      || manual.has(secondInternal)
    ) {
      return;
    }

    const sharedLayer = (
      positions[firstInternal].x
      + positions[secondInternal].x
    ) / 2;

    positions[firstInternal].x = sharedLayer;
    positions[secondInternal].x = sharedLayer;
  });
}

function canMoveTerminalCross(node, cross, positions, axes, kind) {
  const minGap = 28;

  return Object.entries(positions).every(([otherNode, position]) => (
    otherNode === node
    || position.kind === "internal"
    || position.kind !== kind
    || Math.abs(axes.crossOf(position) - cross) >= minGap
  ));
}

export function alignInternalsToDeclaredTerminalRows(diagram, positions, axes, layoutOptions) {
  if (!diagram.incoming.length && !diagram.outgoing.length) {
    return;
  }

  const pinned = new Set([
    ...diagram.incoming,
    ...diagram.outgoing,
    ...Object.keys(diagram.manualPositions || {}),
  ]);

  terminalCrossLocks(diagram, positions, axes, pinned).forEach((cross, node) => {
    if (positions[node]?.kind === "internal") {
      axes.setCross(positions[node], cross);
    }
  });

  if (layoutOptions.layout === "spring") {
    alignJunctionsToTerminalRowCorridors(diagram, positions, axes, pinned);
  }

  alignTerminalLaneInternals(diagram, positions, axes, pinned);
}

function alignJunctionsToTerminalRowCorridors(diagram, positions, axes, pinned) {
  if (axes.stackInternals) {
    return;
  }

  const externalKinds = new Set(["incoming", "outgoing"]);
  const directLocks = terminalCrossLocks(diagram, positions, axes, pinned);
  const adjacency = visibleAdjacencyForLayout(diagram, Object.keys(positions));
  const tolerance = 1;

  adjacency.forEach((neighbors, node) => {
    const position = positions[node];

    if (
      !position
      || position.kind !== "internal"
      || pinned.has(node)
      || directLocks.has(node)
    ) {
      return;
    }

    const crosses = [];

    neighbors.forEach((neighbor) => {
      const neighborPosition = positions[neighbor];

      if (!neighborPosition) {
        return;
      }

      if (externalKinds.has(neighborPosition.kind)) {
        crosses.push(axes.crossOf(neighborPosition));
        return;
      }

      if (directLocks.has(neighbor)) {
        crosses.push(directLocks.get(neighbor));
      }
    });

    if (crosses.length < 2) {
      return;
    }

    const groups = groupNearbyCrosses(crosses, tolerance);

    if (groups.length < 2) {
      return;
    }

    const largest = Math.max(...groups.map((group) => group.count));
    const dominantGroups = groups.filter((group) => group.count === largest);
    const target = dominantGroups.length === 1 && largest > 1
      ? dominantGroups[0].sum / dominantGroups[0].count
      : crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length;

    axes.setCross(position, target);
  });
}

function groupNearbyCrosses(crosses, tolerance) {
  const groups = [];

  crosses
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
    .forEach((cross) => {
      const last = groups[groups.length - 1];

      if (!last || Math.abs(cross - last.center) > tolerance) {
        groups.push({ center: cross, sum: cross, count: 1 });
        return;
      }

      last.sum += cross;
      last.count += 1;
      last.center = last.sum / last.count;
    });

  return groups;
}

function alignTerminalLaneInternals(diagram, positions, axes, pinned) {
  if (diagram.incoming.length <= 1 && diagram.outgoing.length <= 1) {
    return;
  }

  const tolerance = 1;
  const moved = new Set();

  diagram.incoming.forEach((incoming) => {
    const incomingPosition = positions[incoming];

    if (!incomingPosition) {
      return;
    }

    diagram.outgoing.forEach((outgoing) => {
      const outgoingPosition = positions[outgoing];

      if (
        !outgoingPosition
        || Math.abs(axes.crossOf(incomingPosition) - axes.crossOf(outgoingPosition)) > tolerance
      ) {
        return;
      }

      const path = terminalLanePath(diagram, positions, axes, incoming, outgoing, axes.crossOf(incomingPosition), tolerance);

      if (!path) {
        return;
      }

      const internals = path.filter((node) => (
        positions[node]?.kind === "internal" && !pinned.has(node) && !moved.has(node)
      ));

      if (!internals.length) {
        return;
      }

      internals.forEach((node, index) => {
        positions[node].x = axes.layerStart
          + ((axes.layerEnd - axes.layerStart) * (index + 1)) / (internals.length + 1);
        moved.add(node);
      });
    });
  });
}

function terminalLanePath(diagram, positions, axes, incoming, outgoing, cross, tolerance) {
  const allowed = new Set([incoming, outgoing]);

  Object.entries(positions).forEach(([node, position]) => {
    if (
      position.kind === "internal"
      && Math.abs(axes.crossOf(position) - cross) <= tolerance
    ) {
      allowed.add(node);
    }
  });

  const adjacency = new Map(Array.from(allowed).map((node) => [node, []]));

  diagram.edges.forEach((edge) => {
    if (edge.hidden || !allowed.has(edge.from) || !allowed.has(edge.to)) {
      return;
    }

    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  });

  adjacency.forEach((neighbors) => {
    neighbors.sort((left, right) => left.localeCompare(right));
  });

  const queue = [[incoming]];
  const visited = new Set([incoming]);

  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === outgoing) {
      return path;
    }

    (adjacency.get(node) || []).forEach((neighbor) => {
      if (visited.has(neighbor)) {
        return;
      }

      visited.add(neighbor);
      queue.push([...path, neighbor]);
    });
  }

  return null;
}
