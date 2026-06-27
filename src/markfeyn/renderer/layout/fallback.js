import {
  clamp,
  collectNodes,
  crossCoordinateAt,
  diagramAxes,
  initialFixedPositions,
  labelSideForKind,
  nodeKind,
  nodesWithoutIncomingEdges,
  placeExternalNodes,
  placeNodesOnRing,
  safeDelta,
  slotCoordinateAt,
  terminalNeighborsByInternal,
} from "./coordinates.js";
import {
  applyLayoutNormalizations,
  terminalCrossLocks,
} from "./normalization.js";

export function layoutFeynmanFallbackRaw(diagram, layoutOptions) {
  if (layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical") {
    return layoutSpring(diagram, layoutOptions, {
      electrical: layoutOptions.layout === "spring-electrical",
    });
  }

  if (layoutOptions.layout === "tree") {
    return layoutTree(diagram, layoutOptions);
  }

  return layoutLayered(diagram, layoutOptions);
}

export function layoutLayered(diagram, layoutOptions) {
  const { width, height } = layoutOptions;
  const axes = diagramAxes(layoutOptions);
  const positions = initialFixedPositions(diagram, axes);
  const incoming = new Set(diagram.incoming);
  const outgoing = new Set(diagram.outgoing);
  const unclassified = new Set(diagram.unclassified || []);
  const allNodes = collectNodes(diagram);

  placeExternalNodes(diagram.incoming, axes.layerStart, axes.crossStart, axes.crossEnd, "incoming", axes, positions);
  placeExternalNodes(diagram.outgoing, axes.layerEnd, axes.crossStart, axes.crossEnd, "outgoing", axes, positions);

  const internalNodes = Array.from(allNodes).filter((node) => (
    !incoming.has(node) && !outgoing.has(node) && !unclassified.has(node) && !positions[node]
  ));
  const layerByNode = computeInternalLayers(diagram, internalNodes, incoming);
  const maxLayer = Math.max(1, ...Array.from(layerByNode.values()));
  const layers = new Map();

  internalNodes.forEach((node) => {
    const layer = layerByNode.get(node) || 1;
    const layerPosition = axes.layerStart + ((axes.layerEnd - axes.layerStart) * layer) / (maxLayer + 1);
    const cross = estimateInternalCross(node, diagram, positions, axes);

    if (!layers.has(layer)) {
      layers.set(layer, []);
    }

    layers.get(layer).push({ node, layer: layerPosition, cross });
  });

  layers.forEach((nodes) => {
    distributeLayer(nodes, axes.crossStart, axes.crossEnd).forEach(({ node, layer, cross }) => {
      positions[node] = axes.point(layer, cross, "internal");
    });
  });

  placeNodesOnRing(
    Array.from(unclassified).filter((node) => !positions[node]),
    { x: width / 2, y: height / 2 },
    Math.max(52, Math.min(width - 2 * layoutOptions.marginX, height - 2 * layoutOptions.marginY) * 0.38),
    positions,
    diagram,
    layoutOptions,
    -3 * Math.PI / 4
  );

  return { width, height, positions, options: layoutOptions };
}

export function layoutTree(diagram, layoutOptions) {
  const { width, height } = layoutOptions;
  const axes = diagramAxes(layoutOptions);
  const positions = initialFixedPositions(diagram, axes);
  const allNodes = Array.from(collectNodes(diagram)).filter((node) => !positions[node]);
  const nodeSet = new Set(allNodes);
  const childrenByNode = treeChildrenByNode(diagram, nodeSet);
  const roots = treeRoots(diagram, allNodes, nodeSet);
  const depthByNode = new Map();
  const slotByNode = new Map();
  const visited = new Set();
  const visiting = new Set();
  let nextSlot = 0;

  const assignSubtree = (node, depth) => {
    if (!nodeSet.has(node)) {
      return null;
    }

    depthByNode.set(node, Math.max(depthByNode.get(node) ?? 0, depth));

    if (slotByNode.has(node)) {
      return slotByNode.get(node);
    }

    if (visiting.has(node)) {
      return null;
    }

    visiting.add(node);

    const childSlots = (childrenByNode.get(node) || [])
      .map((child) => assignSubtree(child, depth + 1))
      .filter((slot) => slot !== null);

    let slot;

    if (childSlots.length) {
      slot = childSlots.reduce((sum, childSlot) => sum + childSlot, 0) / childSlots.length;
    } else {
      slot = nextSlot;
      nextSlot += 1;
    }

    slotByNode.set(node, slot);
    visiting.delete(node);
    visited.add(node);

    return slot;
  };

  roots.forEach((root) => {
    assignSubtree(root, 0);
  });

  allNodes.forEach((node) => {
    if (!visited.has(node)) {
      assignSubtree(node, 0);
    }
  });

  allNodes.forEach((node) => {
    const maxDepth = Math.max(1, ...Array.from(depthByNode.values()));
    const depth = depthByNode.get(node) ?? 0;
    const slotCount = Math.max(nextSlot, 1);
    const kind = nodeKind(node, diagram);
    const layer = treeLayerForNode(kind, depth, maxDepth, axes);
    const cross = slotCoordinateAt(slotByNode.get(node) ?? 0, slotCount, axes.crossStart, axes.crossEnd);

    positions[node] = axes.point(layer, cross, kind);
  });

  return { width, height, positions, options: layoutOptions };
}

export function layoutSpring(diagram, layoutOptions, springOptions = {}) {
  const { width, height, marginX, marginY } = layoutOptions;
  const axes = diagramAxes(layoutOptions);
  const base = layoutLayered(diagram, { ...layoutOptions, layout: "layered" });
  const positions = { ...base.positions };
  const allNodes = Array.from(collectNodes(diagram));
  const pinned = new Set([
    ...diagram.incoming,
    ...diagram.outgoing,
    ...Object.keys(diagram.manualPositions || {}),
  ]);
  const crossLocks = axes.stackInternals ? new Map() : terminalCrossLocks(diagram, positions, axes, pinned);
  const targetLength = Math.max(70, Math.min(width, height) / 3);
  const repulsion = targetLength * targetLength * (springOptions.electrical ? 0.16 : 0.08);
  const stiffness = 0.025;

  allNodes.forEach((node, index) => {
    if (positions[node]) {
      return;
    }

    const angle = (Math.PI * 2 * index) / Math.max(allNodes.length, 1);
    positions[node] = {
      x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.25,
      y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.25,
      kind: nodeKind(node, diagram),
      labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
    };
  });
  applyCrossLocks(positions, crossLocks, axes);

  for (let iteration = 0; iteration < 90; iteration += 1) {
    const forces = new Map(allNodes.map((node) => [node, { x: 0, y: 0 }]));

    for (let first = 0; first < allNodes.length; first += 1) {
      for (let second = first + 1; second < allNodes.length; second += 1) {
        const a = allNodes[first];
        const b = allNodes[second];
        const delta = safeDelta(positions[a], positions[b]);
        const force = repulsion / Math.max(delta.distance * delta.distance, 1);
        const fx = delta.ux * force;
        const fy = delta.uy * force;

        forces.get(a).x -= fx;
        forces.get(a).y -= fy;
        forces.get(b).x += fx;
        forces.get(b).y += fy;
      }
    }

    diagram.edges.forEach((edge) => {
      const from = positions[edge.from];
      const to = positions[edge.to];

      if (!from || !to) {
        return;
      }

      const delta = safeDelta(from, to);
      const force = (delta.distance - targetLength) * stiffness;
      const fx = delta.ux * force;
      const fy = delta.uy * force;

      forces.get(edge.from).x += fx;
      forces.get(edge.from).y += fy;
      forces.get(edge.to).x -= fx;
      forces.get(edge.to).y -= fy;
    });

    allNodes.forEach((node) => {
      if (pinned.has(node)) {
        return;
      }

      const force = forces.get(node);
      positions[node] = clampSpringPosition(
        positions[node],
        force,
        layoutOptions,
        axes,
        diagram
      );
      applyCrossLock(positions[node], crossLocks.get(node), axes);
    });
  }

  applyLayoutNormalizations(diagram, positions, axes, layoutOptions);

  return { width, height, positions, options: layoutOptions };
}

function treeLayerForNode(kind, depth, maxDepth, axes) {
  if (kind === "incoming") {
    return axes.layerStart;
  }

  if (kind === "outgoing") {
    return axes.layerEnd;
  }

  return axes.layerStart + ((axes.layerEnd - axes.layerStart) * depth) / maxDepth;
}

function treeChildrenByNode(diagram, nodeSet) {
  const childrenByNode = new Map();

  const addChild = (parent, child) => {
    if (!childrenByNode.has(parent)) {
      childrenByNode.set(parent, []);
    }

    const children = childrenByNode.get(parent);

    if (!children.includes(child)) {
      children.push(child);
    }
  };

  diagram.edges.forEach((edge) => {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to) || edge.from === edge.to) {
      return;
    }

    const direction = treeLayoutEdgeDirection(edge, diagram);

    if (direction) {
      addChild(direction.parent, direction.child);
    }
  });

  return childrenByNode;
}

function treeLayoutEdgeDirection(edge, diagram) {
  const fromKind = nodeKind(edge.from, diagram);
  const toKind = nodeKind(edge.to, diagram);

  if (fromKind === "incoming" && toKind !== "incoming") {
    return { parent: edge.from, child: edge.to };
  }

  if (toKind === "incoming" && fromKind !== "incoming") {
    return { parent: edge.to, child: edge.from };
  }

  if (fromKind !== "outgoing" && toKind === "outgoing") {
    return { parent: edge.from, child: edge.to };
  }

  if (toKind !== "outgoing" && fromKind === "outgoing") {
    return { parent: edge.to, child: edge.from };
  }

  return { parent: edge.from, child: edge.to };
}

function treeRoots(diagram, allNodes, nodeSet) {
  const declaredRoots = diagram.incoming.filter((node) => nodeSet.has(node));

  if (declaredRoots.length) {
    return declaredRoots;
  }

  return nodesWithoutIncomingEdges(diagram, allNodes);
}

function clampSpringPosition(position, force, layoutOptions, axes, diagram) {
  const { width, height, marginX, marginY } = layoutOptions;
  const next = {
    ...position,
    x: clamp(position.x + force.x, marginX, width - marginX),
    y: clamp(position.y + force.y, marginY, height - marginY),
  };

  if (
    position.kind !== "internal"
    || (!diagram.incoming.length && !diagram.outgoing.length)
  ) {
    return next;
  }

  const layerMin = Math.min(axes.layerStart, axes.layerEnd);
  const layerMax = Math.max(axes.layerStart, axes.layerEnd);
  const terminalGap = Math.min(72, Math.max(42, (layerMax - layerMin) * 0.24));

  if (layerMax - layerMin > 2 * terminalGap) {
    next.x = clamp(next.x, layerMin + terminalGap, layerMax - terminalGap);
  }

  return next;
}

function applyCrossLocks(positions, crossLocks, axes) {
  crossLocks.forEach((cross, node) => {
    if (positions[node]) {
      applyCrossLock(positions[node], cross, axes);
    }
  });
}

function applyCrossLock(position, cross, axes) {
  if (cross === undefined) {
    return;
  }

  axes.setCross(position, cross);
}

function computeInternalLayers(diagram, internalNodes, incoming) {
  const layers = new Map(internalNodes.map((node) => [node, 1]));
  const knownSources = new Set(incoming);

  const maxUsefulLayer = Math.max(1, internalNodes.length);

  for (let pass = 0; pass < internalNodes.length + diagram.edges.length + 1; pass += 1) {
    let changed = false;

    diagram.edges.forEach((edge) => {
      if (!layers.has(edge.to)) {
        return;
      }

      const sourceLayer = layers.get(edge.from) ?? (knownSources.has(edge.from) ? 0 : 1);
      const nextLayer = Math.max(layers.get(edge.to), Math.min(sourceLayer + 1, maxUsefulLayer));

      if (nextLayer !== layers.get(edge.to)) {
        layers.set(edge.to, nextLayer);
        changed = true;
      }
    });

    if (!changed) {
      break;
    }
  }

  return layers;
}

function estimateInternalCross(node, diagram, fixedPositions, axes) {
  const singleIncomingCross = axes.stackInternals
    ? null
    : directSingleIncomingCross(node, diagram, fixedPositions, axes);

  if (singleIncomingCross !== null) {
    return singleIncomingCross;
  }

  const neighborCrosses = [];

  diagram.edges.forEach((edge) => {
    if (edge.from === node && fixedPositions[edge.to]) {
      neighborCrosses.push(axes.crossOf(fixedPositions[edge.to]));
    }

    if (edge.to === node && fixedPositions[edge.from]) {
      neighborCrosses.push(axes.crossOf(fixedPositions[edge.from]));
    }
  });

  if (!neighborCrosses.length) {
    return (axes.crossStart + axes.crossEnd) / 2;
  }

  const average = neighborCrosses.reduce((sum, cross) => sum + cross, 0) / neighborCrosses.length;

  if (axes.stackInternals) {
    return pullCrossTowardCenter(average, axes);
  }

  return average;
}

function pullCrossTowardCenter(cross, axes) {
  const center = (axes.crossStart + axes.crossEnd) / 2;

  return center + (cross - center) * 0.5;
}

function directSingleIncomingCross(node, diagram, fixedPositions, axes) {
  if (diagram.incoming.length !== 1) {
    return null;
  }

  const incoming = diagram.incoming[0];

  if (!fixedPositions[incoming]) {
    return null;
  }

  const connected = diagram.edges.some((edge) => (
    !edge.hidden
    && (
      (edge.from === incoming && edge.to === node)
      || (edge.to === incoming && edge.from === node)
    )
  ));

  return connected ? axes.crossOf(fixedPositions[incoming]) : null;
}

function distributeLayer(nodes, minCross, maxCross) {
  const minGap = 42;
  const sorted = [...nodes].sort((a, b) => a.cross - b.cross || a.node.localeCompare(b.node));

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].cross - sorted[index - 1].cross < minGap) {
      sorted[index].cross = sorted[index - 1].cross + minGap;
    }
  }

  const overflow = sorted.length ? sorted[sorted.length - 1].cross - maxCross : 0;
  if (overflow > 0) {
    sorted.forEach((item) => {
      item.cross -= overflow;
    });
  }

  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    if (sorted[index + 1].cross - sorted[index].cross < minGap) {
      sorted[index].cross = sorted[index + 1].cross - minGap;
    }
  }

  const underflow = sorted.length ? minCross - sorted[0].cross : 0;
  if (underflow > 0) {
    sorted.forEach((item) => {
      item.cross += underflow;
    });
  }

  return sorted.map((item) => ({
    ...item,
    cross: Math.max(minCross, Math.min(maxCross, item.cross)),
  }));
}
