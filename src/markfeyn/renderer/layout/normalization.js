import { edgePath, lineVector } from "../render/paths.js";
import {
  blobVertexRadii,
  vertexDefinitionShape,
} from "../render/vertex-shapes.js";
import {
  applyManualPositions,
  boundsForAxis,
  boundsForNodes,
  clamp,
  collectNodes,
  crossCoordinateAt,
  degreesToRadians,
  diagramAxes,
  enforceDeclaredExternalOrder,
  fallbackRawPosition,
  labelSideForKind,
  nodeKind,
  placeExternalNodes,
  positionBounds,
  scaleCoordinate,
  terminalNeighborsByInternal,
  visibleAdjacencyForLayout,
  visibleInternalNeighborsForTerminal,
} from "./coordinates.js";

export function elkNodeDimensions(node, diagram) {
  const definition = diagram.vertices?.[node] ?? null;
  const shape = vertexDefinitionShape(definition);

  if (shape === "blob" || shape === "disk") {
    const radii = blobVertexRadii(shape, definition);

    return {
      width: Math.max(12, radii.rx * 2),
      height: Math.max(12, radii.ry * 2),
    };
  }

  return { width: 8, height: 8 };
}

export function normalizeElkLayout(diagram, layoutOptions, elkGraph) {
  const { width, height } = layoutOptions;
  const axes = diagramAxes(layoutOptions);
  const positions = {};
  const allNodes = Array.from(collectNodes(diagram));
  const rawPositions = elkRawPositions(elkGraph);
  const incoming = new Set(diagram.incoming);
  const outgoing = new Set(diagram.outgoing);
  const unclassified = new Set(diagram.unclassified || []);
  const manual = new Set(Object.keys(diagram.manualPositions || {}));
  const internalNodes = allNodes.filter((node) => (
    !incoming.has(node) && !outgoing.has(node) && !unclassified.has(node)
  ));
  const sourceNodes = internalNodes.length && !unclassified.size ? internalNodes : allNodes;
  const sourceBounds = boundsForNodes(sourceNodes, rawPositions);
  const crossBounds = boundsForAxis(allNodes, rawPositions, "y");
  const layerRange = elkInternalLayerRange(diagram, axes);

  placeExternalNodes(diagram.incoming, axes.layerStart, axes.crossStart, axes.crossEnd, "incoming", axes, positions);
  placeExternalNodes(diagram.outgoing, axes.layerEnd, axes.crossStart, axes.crossEnd, "outgoing", axes, positions);

  internalNodes.forEach((node) => {
    const raw = rawPositions.get(node) || fallbackRawPosition(rawPositions, sourceBounds);
    const layer = scaleCoordinate(raw.x, sourceBounds.minX, sourceBounds.maxX, layerRange.start, layerRange.end);
    const cross = scaleCoordinate(raw.y, crossBounds.min, crossBounds.max, axes.crossStart, axes.crossEnd);

    positions[node] = axes.point(layer, cross, "internal");
  });

  allNodes.forEach((node) => {
    if (positions[node] || manual.has(node)) {
      return;
    }

    const raw = rawPositions.get(node) || fallbackRawPosition(rawPositions, sourceBounds);
    const layer = scaleCoordinate(raw.x, sourceBounds.minX, sourceBounds.maxX, layerRange.start, layerRange.end);
    const cross = scaleCoordinate(raw.y, crossBounds.min, crossBounds.max, axes.crossStart, axes.crossEnd);
    const kind = nodeKind(node, diagram);

    positions[node] = axes.point(layer, cross, kind);
  });

  applyManualPositions(positions, diagram, layoutOptions);
  applyLayoutNormalizations(diagram, positions, axes, layoutOptions);

  return { width, height, positions, options: layoutOptions };
}

export function applyLayoutNormalizations(diagram, positions, axes, layoutOptions) {
  centerDefaultSpringExchangeFans(diagram, positions, axes, layoutOptions);
  centerTikzOrientationEndpointFans(diagram, positions, axes, layoutOptions);

  if (usesSpringStyleNormalization(layoutOptions)) {
    alignHorizontalBackboneInternals(diagram, positions, axes, layoutOptions);
    orientHorizontalBackboneInternals(diagram, positions, axes, layoutOptions);
    fitCurvedInternalEdgeGroupsToViewBox(diagram, positions, axes, layoutOptions);
  }

  straightenSingleTerminalLegs(diagram, positions, axes);
  if (!layoutOptions.tikzOrientation) {
    alignVerticalProcessTerminalStacks(diagram, positions, axes, layoutOptions);
  }
  straightenSingleTerminalLegs(diagram, positions, axes);
  alignInternalsAcrossInvisibleTerminalPairs(diagram, positions, axes);
  enforceDeclaredExternalOrder(diagram, positions, axes);
  if (!layoutOptions.tikzOrientation) {
    alignInternalsToDeclaredTerminalRows(diagram, positions, axes, layoutOptions);
  }
  applyAlignmentConstraints(diagram, positions, layoutOptions);
  fitLayoutTranslationToEdgeBounds(diagram, positions, layoutOptions);
}

export function finalizeLayout(diagram, layout, layoutOptions) {
  applyTikzPostLayoutOrientation(diagram, layout, layoutOptions);
  applyManualPositions(layout.positions, diagram, layoutOptions);
  layout.options = layoutOptions;

  return layout;
}

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

function usesSpringStyleNormalization(layoutOptions) {
  return layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical";
}

function elkRawPositions(elkGraph) {
  const positions = new Map();

  (elkGraph.children || []).forEach((child) => {
    positions.set(child.id, {
      x: (child.x || 0) + (child.width || 0) / 2,
      y: (child.y || 0) + (child.height || 0) / 2,
    });
  });

  return positions;
}

function elkInternalLayerRange(diagram, axes) {
  if (!diagram.incoming.length && !diagram.outgoing.length) {
    return { start: axes.layerStart, end: axes.layerEnd };
  }

  const layerSpan = axes.layerEnd - axes.layerStart;
  const terminalGap = Math.min(84, Math.max(48, Math.abs(layerSpan) * 0.24));
  const direction = Math.sign(layerSpan) || 1;

  return {
    start: axes.layerStart + direction * terminalGap,
    end: axes.layerEnd - direction * terminalGap,
  };
}

function centerDefaultSpringExchangeFans(diagram, positions, axes, layoutOptions) {
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

function centerTikzOrientationEndpointFans(diagram, positions, axes, layoutOptions) {
  const orientation = layoutOptions.tikzOrientation;

  if (!orientation) {
    return;
  }

  centerMultiTerminalFanJunctions(
    diagram,
    positions,
    axes,
    new Set([orientation.from, orientation.to])
  );
}

function centerMultiTerminalFanJunctions(diagram, positions, axes, eligibleInternals) {
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

function alignHorizontalBackboneInternals(diagram, positions, axes, layoutOptions) {
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

function orientHorizontalBackboneInternals(diagram, positions, axes, layoutOptions) {
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

function fitCurvedInternalEdgeGroupsToViewBox(diagram, positions, axes, layoutOptions) {
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

function layoutEdgePathBounds(diagram, positions) {
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };
  let hasGeometry = false;

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    const from = positions[edge.from];
    const to = positions[edge.to];

    if (!from || !to) {
      return;
    }

    const numbers = edgePath(edge, from, to).match(/-?\d+(?:\.\d+)?/g);

    if (!numbers) {
      return;
    }

    numbers.map(Number).forEach((value, index) => {
      if (index % 2 === 0) {
        hasGeometry = true;
        bounds.minX = Math.min(bounds.minX, value);
        bounds.maxX = Math.max(bounds.maxX, value);
        return;
      }

      bounds.minY = Math.min(bounds.minY, value);
      bounds.maxY = Math.max(bounds.maxY, value);
    });
  });

  return hasGeometry ? bounds : null;
}

function fitLayoutTranslationToEdgeBounds(diagram, positions, layoutOptions) {
  const bounds = layoutEdgePathBounds(diagram, positions);

  if (!bounds) {
    return;
  }

  const minX = layoutOptions.marginX;
  const maxX = layoutOptions.width - layoutOptions.marginX;
  const minY = layoutOptions.marginY;
  const maxY = layoutOptions.height - layoutOptions.marginY;
  let offsetX = 0;
  let offsetY = 0;

  if (bounds.minX < minX) {
    offsetX = minX - bounds.minX;
  } else if (bounds.maxX > maxX) {
    offsetX = maxX - bounds.maxX;
  }

  if (bounds.minY < minY) {
    offsetY = minY - bounds.minY;
  } else if (bounds.maxY > maxY) {
    offsetY = maxY - bounds.maxY;
  }

  if (!offsetX && !offsetY) {
    return;
  }

  Object.values(positions).forEach((position) => {
    position.x += offsetX;
    position.y += offsetY;
  });
}

function straightenSingleTerminalLegs(diagram, positions, axes) {
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

function alignVerticalProcessTerminalStacks(diagram, positions, axes, layoutOptions) {
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

function alignInternalsAcrossInvisibleTerminalPairs(diagram, positions, axes) {
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

function applyTikzPostLayoutOrientation(diagram, layout, layoutOptions) {
  const orientation = layoutOptions.tikzOrientation;

  if (!orientation) {
    return;
  }

  const from = layout.positions[orientation.from];
  const to = layout.positions[orientation.to];

  if (!from || !to) {
    return;
  }

  const currentAngle = Math.atan2(to.y - from.y, to.x - from.x);
  const targetAngle = degreesToRadians(orientation.angle);
  const rotation = targetAngle - currentAngle;
  const pivot = { x: from.x, y: from.y };

  Object.values(layout.positions).forEach((position) => {
    rotatePositionAround(position, pivot, rotation);
  });

  if (orientation.flip) {
    Object.values(layout.positions).forEach((position) => {
      reflectPositionAcrossLine(position, pivot, targetAngle);
    });
  }

  fanTikzOrientationMixedTerminalPairs(diagram, layout, orientation);
  fanTikzOrientationProcessTerminalGroups(diagram, layout, orientation);
  enforceDeclaredExternalOrder(diagram, layout.positions, diagramAxes(layoutOptions));
  fitLayoutPositions(layout, layoutOptions);
}

function fanTikzOrientationMixedTerminalPairs(diagram, layout, orientation) {
  const from = layout.positions[orientation.from];
  const to = layout.positions[orientation.to];

  if (!from || !to) {
    return;
  }

  const axis = lineVector(from, to);
  const axisGap = clamp(Math.min(layout.width, layout.height) * 0.24, 72, 104);
  const fanGap = orientation.axis === "vertical"
    ? clamp(Math.min(layout.width, layout.height) * 0.45, 126, 150)
    : clamp(Math.min(layout.width, layout.height) * 0.33, 84, 126);

  [
    { internal: orientation.from, outward: -1 },
    { internal: orientation.to, outward: 1 },
  ].forEach(({ internal, outward }) => {
    const endpoint = layout.positions[internal];
    const terminals = mixedTerminalPairForInternal(diagram, internal);

    if (!endpoint || !terminals) {
      return;
    }

    moveTerminalIntoOrientationFan(
      layout.positions[terminals.incoming],
      endpoint,
      axis,
      outward,
      1,
      axisGap,
      fanGap
    );
    moveTerminalIntoOrientationFan(
      layout.positions[terminals.outgoing],
      endpoint,
      axis,
      outward,
      -1,
      axisGap,
      fanGap
    );
  });
}

function mixedTerminalPairForInternal(diagram, internal) {
  const terminals = { incoming: [], outgoing: [] };
  const terminalKinds = new Set(["incoming", "outgoing"]);

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    let terminal = null;

    if (edge.from === internal && terminalKinds.has(nodeKind(edge.to, diagram))) {
      terminal = edge.to;
    }

    if (edge.to === internal && terminalKinds.has(nodeKind(edge.from, diagram))) {
      terminal = edge.from;
    }

    if (!terminal) {
      return;
    }

    terminals[nodeKind(terminal, diagram)].push(terminal);
  });

  if (terminals.incoming.length !== 1 || terminals.outgoing.length !== 1) {
    return null;
  }

  return {
    incoming: terminals.incoming[0],
    outgoing: terminals.outgoing[0],
  };
}

function fanTikzOrientationProcessTerminalGroups(diagram, layout, orientation) {
  const from = layout.positions[orientation.from];
  const to = layout.positions[orientation.to];

  if (!from || !to) {
    return;
  }

  const axis = lineVector(from, to);
  const axisGap = clamp(Math.min(layout.width, layout.height) * 0.24, 72, 104);
  const fanGap = clamp(Math.min(layout.width, layout.height) * 0.33, 84, 126);

  [
    { internal: orientation.from, kind: "incoming", outward: -1 },
    { internal: orientation.to, kind: "outgoing", outward: 1 },
  ].forEach(({ internal, kind, outward }) => {
    const endpoint = layout.positions[internal];
    const terminals = Array.from(terminalNeighborsByInternal(diagram, kind).get(internal) || [])
      .filter((terminal) => layout.positions[terminal])
      .sort((left, right) => terminalDeclarationOrder(diagram, kind, left) - terminalDeclarationOrder(diagram, kind, right) || left.localeCompare(right));

    if (!endpoint || terminals.length < 2) {
      return;
    }

    terminals.forEach((terminal, index) => {
      const side = terminals.length === 1
        ? 0
        : -1 + (2 * index) / (terminals.length - 1);
      const position = layout.positions[terminal];

      position.x = endpoint.x + axis.ux * axisGap * outward + axis.px * fanGap * side;
      position.y = endpoint.y + axis.uy * axisGap * outward + axis.py * fanGap * side;
    });
  });
}

function terminalDeclarationOrder(diagram, kind, terminal) {
  const list = kind === "incoming" ? diagram.incoming : diagram.outgoing;
  const index = list.indexOf(terminal);

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function moveTerminalIntoOrientationFan(position, endpoint, axis, outward, side, axisGap, fanGap) {
  if (!position) {
    return;
  }

  position.x = endpoint.x + axis.ux * axisGap * outward + axis.px * fanGap * side;
  position.y = endpoint.y + axis.uy * axisGap * outward + axis.py * fanGap * side;
}

function rotatePositionAround(position, pivot, angle) {
  const dx = position.x - pivot.x;
  const dy = position.y - pivot.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  position.x = pivot.x + dx * cos - dy * sin;
  position.y = pivot.y + dx * sin + dy * cos;
}

function reflectPositionAcrossLine(position, pivot, angle) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const dx = position.x - pivot.x;
  const dy = position.y - pivot.y;
  const parallel = dx * ux + dy * uy;
  const projection = {
    x: pivot.x + parallel * ux,
    y: pivot.y + parallel * uy,
  };

  position.x = 2 * projection.x - position.x;
  position.y = 2 * projection.y - position.y;
}

function fitLayoutPositions(layout, layoutOptions) {
  const positions = Object.values(layout.positions);

  if (!positions.length) {
    return;
  }

  const bounds = positionBounds(positions);
  const availableWidth = Math.max(1, layoutOptions.width - 2 * layoutOptions.marginX);
  const availableHeight = Math.max(1, layoutOptions.height - 2 * layoutOptions.marginY);
  const scale = Math.min(
    1,
    availableWidth / Math.max(1, bounds.maxX - bounds.minX),
    availableHeight / Math.max(1, bounds.maxY - bounds.minY)
  );
  const scaledWidth = (bounds.maxX - bounds.minX) * scale;
  const scaledHeight = (bounds.maxY - bounds.minY) * scale;
  const offsetX = layoutOptions.marginX + (availableWidth - scaledWidth) / 2 - bounds.minX * scale;
  const offsetY = layoutOptions.marginY + (availableHeight - scaledHeight) / 2 - bounds.minY * scale;

  positions.forEach((position) => {
    position.x = position.x * scale + offsetX;
    position.y = position.y * scale + offsetY;
  });
}

function alignInternalsToDeclaredTerminalRows(diagram, positions, axes, layoutOptions) {
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

function applyAlignmentConstraints(diagram, positions, layoutOptions) {
  const alignments = layoutOptions.alignments || [];

  if (!alignments.length) {
    return;
  }

  const manual = new Set(Object.keys(diagram.manualPositions || {}));

  alignments.forEach((alignment) => {
    const coordinate = alignment.axis === "vertical" ? "x" : "y";
    const crossCoordinate = alignment.axis === "vertical" ? "y" : "x";
    const positioned = alignment.nodes
      .map((node) => ({ node, position: positions[node] }))
      .filter((entry) => entry.position && Number.isFinite(entry.position[coordinate]));

    if (positioned.length < 2) {
      return;
    }

    const anchors = positioned.filter((entry) => manual.has(entry.node));
    const source = anchors.length ? anchors : positioned;
    const target = source.reduce((sum, entry) => sum + entry.position[coordinate], 0) / source.length;

    positioned.forEach(({ node, position }) => {
      if (!manual.has(node)) {
        position[coordinate] = target;
      }
    });

    orderAlignedNodesAlongCrossAxis(positioned, crossCoordinate, manual);
  });
}

function orderAlignedNodesAlongCrossAxis(positioned, crossCoordinate, manual) {
  if (
    positioned.length < 2
    || positioned.some((entry) => manual.has(entry.node))
  ) {
    return;
  }

  const slots = positioned
    .map((entry) => entry.position[crossCoordinate])
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (slots.length !== positioned.length) {
    return;
  }

  positioned.forEach((entry, index) => {
    entry.position[crossCoordinate] = slots[index];
  });
}
