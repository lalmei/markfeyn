export function diagramAxes({ width, height, marginX, marginY, orientation, tikzOrientation }) {
  const reverse = orientation.endsWith("reverse");

  return {
    orientation,
    clockwiseBoundaryOrder: !tikzOrientation,
    stackInternals: orientation.startsWith("vertical"),
    layerStart: reverse ? width - marginX : marginX,
    layerEnd: reverse ? marginX : width - marginX,
    crossStart: marginY,
    crossEnd: height - marginY,
    crossOf: (position) => position.y,
    setCross: (position, cross) => {
      position.y = cross;
    },
    point: (layer, cross, kind) => ({
      x: layer,
      y: cross,
      kind,
      labelSide: labelSideForKind(kind, orientation),
    }),
  };
}

export function initialFixedPositions(diagram, axes) {
  const positions = {};

  Object.entries(diagram.manualPositions || {}).forEach(([node, position]) => {
    const kind = nodeKind(node, diagram);

    positions[node] = {
      x: position.x,
      y: position.y,
      kind,
      labelSide: labelSideForKind(kind, axes.orientation || "horizontal"),
    };
  });

  return positions;
}

export function applyManualPositions(positions, diagram, layoutOptions) {
  Object.entries(diagram.manualPositions || {}).forEach(([node, position]) => {
    const kind = nodeKind(node, diagram);

    positions[node] = {
      x: position.x,
      y: position.y,
      kind,
      labelSide: labelSideForKind(kind, layoutOptions.orientation),
    };
  });
}

export function nodeKind(node, diagram) {
  if (diagram.incoming.includes(node)) {
    return "incoming";
  }

  if (diagram.outgoing.includes(node)) {
    return "outgoing";
  }

  if ((diagram.unclassified || []).includes(node)) {
    return "unclassified";
  }

  return "internal";
}

export function labelSideForKind(kind, orientation) {
  const reverse = orientation.endsWith("reverse");

  if (kind === "incoming") {
    return reverse ? "right" : "left";
  }

  if (kind === "outgoing") {
    return reverse ? "left" : "right";
  }

  return "top";
}

export function collectNodes(diagram) {
  const nodes = new Set([...diagram.incoming, ...diagram.outgoing, ...(diagram.unclassified || [])]);

  diagram.edges.forEach((edge) => {
    nodes.add(edge.from);
    nodes.add(edge.to);
  });

  Object.keys(diagram.labels).forEach((labelTarget) => {
    if (!labelTarget.includes("->")) {
      nodes.add(labelTarget);
    }
  });

  (diagram.braces || []).forEach((brace) => {
    nodes.add(brace.from);
    nodes.add(brace.to);
  });

  Object.keys(diagram.manualPositions || {}).forEach((node) => {
    nodes.add(node);
  });

  Object.keys(diagram.vertices || {}).forEach((node) => {
    nodes.add(node);
  });

  return nodes;
}

export function placeExternalNodes(nodes, layer, crossStart, crossEnd, kind, axes, positions) {
  const count = Math.max(nodes.length, 1);

  nodes.forEach((node, index) => {
    if (!positions[node]) {
      positions[node] = axes.point(
        layer,
        externalCrossCoordinateAt(index, count, crossStart, crossEnd, layer, axes, kind),
        kind
      );
    }
  });
}

export function enforceDeclaredExternalOrder(diagram, positions, axes) {
  const manual = new Set(Object.keys(diagram.manualPositions || {}));

  [
    { nodes: diagram.incoming, kind: "incoming" },
    { nodes: diagram.outgoing, kind: "outgoing" },
  ].forEach(({ nodes, kind }) => {
    if (nodes.length <= 1) {
      return;
    }

    const count = Math.max(nodes.length, 1);

    nodes.forEach((node, index) => {
      if (!positions[node] || manual.has(node)) {
        return;
      }

      axes.setCross(
        positions[node],
        externalCrossCoordinateAt(
          index,
          count,
          axes.crossStart,
          axes.crossEnd,
          kind === "incoming" ? axes.layerStart : axes.layerEnd,
          axes,
          kind
        )
      );
      positions[node].kind = kind;
    });
  });
}

export function externalCrossCoordinateAt(index, count, crossStart, crossEnd, layer, axes, kind) {
  if (!axes.clockwiseBoundaryOrder || (kind !== "incoming" && kind !== "outgoing")) {
    return crossCoordinateAt(index, count, crossStart, crossEnd);
  }

  const midpoint = (axes.layerStart + axes.layerEnd) / 2;
  const isLeftBoundary = layer <= midpoint;

  return isLeftBoundary
    ? crossCoordinateAt(index, count, crossEnd, crossStart)
    : crossCoordinateAt(index, count, crossStart, crossEnd);
}

export function crossCoordinateAt(index, count, crossStart, crossEnd) {
  if (count <= 1) {
    return (crossStart + crossEnd) / 2;
  }

  return crossStart + ((crossEnd - crossStart) * index) / (count - 1);
}

export function slotCoordinateAt(slot, count, crossStart, crossEnd) {
  if (count <= 1) {
    return (crossStart + crossEnd) / 2;
  }

  return crossStart + ((crossEnd - crossStart) * slot) / (count - 1);
}

export function placeNodesOnRing(nodes, center, radius, positions, diagram, layoutOptions, startAngle) {
  const count = Math.max(nodes.length, 1);

  nodes.forEach((node, index) => {
    if (positions[node]) {
      return;
    }

    const angle = startAngle + (2 * Math.PI * index) / count;
    const kind = nodeKind(node, diagram);

    positions[node] = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      kind,
      labelSide: labelSideForKind(kind, layoutOptions.orientation),
    };
  });
}

export function visibleAdjacencyForLayout(diagram, nodes) {
  const adjacency = new Map(nodes.map((node) => [node, new Set()]));

  diagram.edges.forEach((edge) => {
    if (edge.hidden || edge.from === edge.to) {
      return;
    }

    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, new Set());
    }

    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, new Set());
    }

    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  });

  return adjacency;
}

export function breadthFirstLayoutDepths(adjacency, start) {
  const depths = new Map();

  if (!start) {
    return depths;
  }

  const queue = [start];
  depths.set(start, 0);

  while (queue.length) {
    const node = queue.shift();
    const nextDepth = depths.get(node) + 1;

    Array.from(adjacency.get(node) || [])
      .sort()
      .forEach((neighbor) => {
        if (!depths.has(neighbor)) {
          depths.set(neighbor, nextDepth);
          queue.push(neighbor);
        }
      });
  }

  return depths;
}

export function visibleInternalNeighborsForTerminal(diagram, terminal, excludedInternals = new Set()) {
  const neighbors = [];

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    if (edge.from === terminal && nodeKind(edge.to, diagram) === "internal" && !excludedInternals.has(edge.to)) {
      neighbors.push(edge.to);
    }

    if (edge.to === terminal && nodeKind(edge.from, diagram) === "internal" && !excludedInternals.has(edge.from)) {
      neighbors.push(edge.from);
    }
  });

  return neighbors;
}

export function terminalNeighborsByInternal(diagram, kind, excludedTerminals = new Set()) {
  const terminalsByInternal = new Map();

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    const fromKind = nodeKind(edge.from, diagram);
    const toKind = nodeKind(edge.to, diagram);
    let terminal = null;
    let internal = null;

    if (fromKind === kind && toKind === "internal") {
      terminal = edge.from;
      internal = edge.to;
    }

    if (toKind === kind && fromKind === "internal") {
      terminal = edge.to;
      internal = edge.from;
    }

    if (!terminal || !internal || excludedTerminals.has(terminal)) {
      return;
    }

    if (!terminalsByInternal.has(internal)) {
      terminalsByInternal.set(internal, new Set());
    }

    terminalsByInternal.get(internal).add(terminal);
  });

  return terminalsByInternal;
}

export function nodesWithoutIncomingEdges(diagram, nodes) {
  const targets = new Set(diagram.edges.map((edge) => edge.to));
  const roots = nodes.filter((node) => !targets.has(node));

  return roots.length ? roots : nodes.slice(0, 1);
}

export function boundsForNodes(nodes, rawPositions) {
  const xs = [];
  const ys = [];

  nodes.forEach((node) => {
    const raw = rawPositions.get(node);

    if (raw) {
      xs.push(raw.x);
      ys.push(raw.y);
    }
  });

  return {
    minX: xs.length ? Math.min(...xs) : 0,
    maxX: xs.length ? Math.max(...xs) : 0,
    minY: ys.length ? Math.min(...ys) : 0,
    maxY: ys.length ? Math.max(...ys) : 0,
  };
}

export function boundsForAxis(nodes, rawPositions, axis) {
  const values = [];

  nodes.forEach((node) => {
    const raw = rawPositions.get(node);

    if (raw) {
      values.push(raw[axis]);
    }
  });

  return {
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
  };
}

export function fallbackRawPosition(rawPositions, bounds) {
  if (rawPositions.size) {
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }

  return { x: 0, y: 0 };
}

export function scaleCoordinate(value, sourceMin, sourceMax, targetStart, targetEnd) {
  if (Math.abs(sourceMax - sourceMin) < 0.001) {
    return (targetStart + targetEnd) / 2;
  }

  return targetStart + ((value - sourceMin) * (targetEnd - targetStart)) / (sourceMax - sourceMin);
}

export function positionBounds(positions) {
  return {
    minX: Math.min(...positions.map((position) => position.x)),
    maxX: Math.max(...positions.map((position) => position.x)),
    minY: Math.min(...positions.map((position) => position.y)),
    maxY: Math.max(...positions.map((position) => position.y)),
  };
}

export function safeDelta(from, to) {
  const dx = to.x - from.x || 0.01;
  const dy = to.y - from.y || 0.01;
  const distance = Math.hypot(dx, dy) || 1;

  return {
    dx,
    dy,
    distance,
    ux: dx / distance,
    uy: dy / distance,
  };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
