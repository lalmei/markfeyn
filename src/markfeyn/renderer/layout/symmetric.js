import { compareExternalOrdering } from "./external-order.js";
import {
  breadthFirstLayoutDepths,
  collectNodes,
  diagramAxes,
  initialFixedPositions,
  labelSideForKind,
  nodeKind,
  placeExternalNodes,
  placeNodesOnRing,
  visibleAdjacencyForLayout,
} from "./coordinates.js";

export function layoutSymmetricContact(diagram, layoutOptions, prepared) {
  const { width, height, marginX, marginY } = layoutOptions;
  const positions = initialFixedPositions(diagram, diagramAxes(layoutOptions));
  const structuralCenter = {
    x: width / 2,
    y: height / 2,
  };
  const centerNode = prepared.topology.internalVertices[0] || prepared.topology.graphCenters[0];
  const externalNodes = orderedSemanticExternalNodes(prepared);
  const radius = Math.max(
    54,
    Math.min(width - 2 * marginX, height - 2 * marginY) * 0.38
  );

  if (centerNode && !positions[centerNode]) {
    positions[centerNode] = {
      ...structuralCenter,
      kind: nodeKind(centerNode, diagram),
      labelSide: labelSideForKind(nodeKind(centerNode, diagram), layoutOptions.orientation),
    };
  }

  const contactCenter = centerNode && positions[centerNode]
    ? positions[centerNode]
    : structuralCenter;

  placeNodesOnRing(
    externalNodes,
    contactCenter,
    radius,
    positions,
    diagram,
    layoutOptions,
    contactStarStartAngle(externalNodes.length)
  );

  Array.from(collectNodes(diagram)).sort().forEach((node) => {
    if (!positions[node]) {
      positions[node] = {
        ...contactCenter,
        kind: nodeKind(node, diagram),
        labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
      };
    }
  });

  return { width, height, positions, options: layoutOptions };
}

export function layoutSymmetricUnclassifiedRefinement(diagram, layoutOptions, prepared) {
  const refinement = prepared.symmetricUnclassified;
  const { width, height, marginX, marginY } = layoutOptions;
  const positions = initialFixedPositions(diagram, diagramAxes(layoutOptions));
  const center = { x: width / 2, y: height / 2 };
  const axes = diagramAxes(layoutOptions);
  const vertical = axes.orientation === "vertical" || axes.orientation === "vertical-reverse";

  if (refinement.kind === "twoCenterTree") {
    const leftCenter = refinement.leftCenter;
    const rightCenter = refinement.rightCenter;
    const leftLeaves = orderedLeafNodes(prepared, refinement.leftLeaves);
    const rightLeaves = orderedLeafNodes(prepared, refinement.rightLeaves);

    if (vertical) {
      placeSymmetricTwoCenterTreeVertical(
        positions,
        diagram,
        layoutOptions,
        axes,
        leftCenter,
        rightCenter,
        leftLeaves,
        rightLeaves,
        refinement
      );
    } else {
      placeSymmetricTwoCenterTreeHorizontal(
        positions,
        diagram,
        layoutOptions,
        axes,
        leftCenter,
        rightCenter,
        leftLeaves,
        rightLeaves,
        refinement
      );
    }
  } else if (refinement.kind === "twoPointLoop") {
    const [endpointA, endpointB] = refinement.loopEndpoints;
    const legA = refinement.externalLegs.find((leg) => leg.internal === endpointA);
    const legB = refinement.externalLegs.find((leg) => leg.internal === endpointB);

    if (vertical) {
      placeSymmetricTwoPointLoopVertical(
        positions,
        diagram,
        layoutOptions,
        axes,
        endpointA,
        endpointB,
        legA,
        legB
      );
    } else {
      placeSymmetricTwoPointLoopHorizontal(
        positions,
        diagram,
        layoutOptions,
        axes,
        endpointA,
        endpointB,
        legA,
        legB
      );
    }
  }

  Array.from(collectNodes(diagram)).sort().forEach((node) => {
    if (!positions[node]) {
      positions[node] = {
        ...center,
        kind: nodeKind(node, diagram),
        labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
      };
    }
  });

  return { width, height, positions, options: layoutOptions };
}

export function layoutSymmetricTree(diagram, layoutOptions, prepared) {
  const { width, height, marginX, marginY } = layoutOptions;
  const positions = initialFixedPositions(diagram, diagramAxes(layoutOptions));
  const allNodes = Array.from(collectNodes(diagram)).sort();
  const centerNode = prepared.topology.graphCenters[0] || allNodes[0];
  const center = { x: width / 2, y: height / 2 };
  const adjacency = visibleAdjacencyForLayout(diagram, allNodes);
  const depths = breadthFirstLayoutDepths(adjacency, centerNode);
  const maxDepth = Math.max(1, ...Array.from(depths.values()));
  const maxRadius = Math.max(60, Math.min(width - 2 * marginX, height - 2 * marginY) * 0.42);
  const nodesByDepth = new Map();

  allNodes.forEach((node) => {
    const depth = depths.get(node) ?? maxDepth;

    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }

    nodesByDepth.get(depth).push(node);
  });

  nodesByDepth.forEach((nodes, depth) => {
    const sortedNodes = nodes.sort((left, right) => semanticOrder(prepared, left, right));

    if (depth === 0) {
      sortedNodes.forEach((node) => {
        if (!positions[node]) {
          positions[node] = {
            ...center,
            kind: nodeKind(node, diagram),
            labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
          };
        }
      });
      return;
    }

    const radius = (maxRadius * depth) / maxDepth;
    const startAngle = sortedNodes.length === 1 ? 0 : -Math.PI / 2;

    placeNodesOnRing(sortedNodes, center, radius, positions, diagram, layoutOptions, startAngle);
  });

  return { width, height, positions, options: layoutOptions };
}

function contactStarStartAngle(count) {
  if (count % 2 === 1) {
    const medianIndex = Math.floor(count / 2);

    return -Math.PI / 2 - (2 * Math.PI * medianIndex) / count;
  }

  return -Math.PI / 2 - Math.PI / Math.max(count, 1);
}

function orderedLeafNodes(prepared, leaves) {
  return leaves.slice().sort((left, right) => compareExternalOrdering(prepared.externalOrdering, left, right));
}

function placeSymmetricTwoCenterTreeHorizontal(positions, diagram, layoutOptions, axes, leftCenter, rightCenter, leftLeaves, rightLeaves, refinement = {}) {
  const { width, height, marginY } = layoutOptions;

  if (refinement.centerExternal) {
    placeSymmetricCenterExternalHorizontal(
      positions,
      diagram,
      layoutOptions,
      width,
      height,
      marginY,
      refinement.centerExternal,
      refinement.centerAttachedCenter === leftCenter
    );
  }

  placeExternalNodes(leftLeaves, axes.layerStart, axes.crossStart, axes.crossEnd, "unclassified", axes, positions);
  placeExternalNodes(rightLeaves, axes.layerEnd, axes.crossStart, axes.crossEnd, "unclassified", axes, positions);

  const layerSpan = axes.layerEnd - axes.layerStart;
  const terminalGap = Math.min(84, Math.max(48, Math.abs(layerSpan) * 0.24));
  const direction = Math.sign(layerSpan) || 1;
  const leftLayer = axes.layerStart + direction * terminalGap;
  const rightLayer = axes.layerEnd - direction * terminalGap;
  const leftCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === leftCenter
    ? [...leftLeaves, refinement.centerExternal]
    : leftLeaves;
  const rightCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === rightCenter
    ? [...rightLeaves, refinement.centerExternal]
    : rightLeaves;

  placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, axes, leftCenter, leftLayer, leftCrossLeaves);
  placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, axes, rightCenter, rightLayer, rightCrossLeaves);
}

function placeSymmetricTwoCenterTreeVertical(positions, diagram, layoutOptions, axes, leftCenter, rightCenter, leftLeaves, rightLeaves, refinement = {}) {
  const { width, marginX } = layoutOptions;
  const sideAxes = {
    ...axes,
    crossOf: (position) => position.x,
    setCross: (position, cross) => {
      position.x = cross;
    },
    point: (cross, layer, kind) => ({
      x: cross,
      y: layer,
      kind,
      labelSide: labelSideForKind(kind, layoutOptions.orientation),
    }),
  };

  if (refinement.centerExternal) {
    placeSymmetricCenterExternalVertical(
      positions,
      diagram,
      layoutOptions,
      width,
      marginX,
      refinement.centerExternal,
      refinement.centerAttachedCenter === leftCenter
    );
  }

  placeExternalNodes(leftLeaves, axes.crossStart, axes.layerStart, axes.layerEnd, "unclassified", sideAxes, positions);
  placeExternalNodes(rightLeaves, axes.crossEnd, axes.layerStart, axes.layerEnd, "unclassified", sideAxes, positions);

  const layerSpan = axes.layerEnd - axes.layerStart;
  const terminalGap = Math.min(84, Math.max(48, Math.abs(layerSpan) * 0.24));
  const direction = Math.sign(layerSpan) || 1;
  const leftLayer = axes.layerStart + direction * terminalGap;
  const rightLayer = axes.layerEnd - direction * terminalGap;
  const verticalAxes = {
    crossOf: (position) => position.x,
    point: (cross, layer, kind) => ({
      x: cross,
      y: layer,
      kind,
      labelSide: labelSideForKind(kind, layoutOptions.orientation),
    }),
  };

  const leftCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === leftCenter
    ? [...leftLeaves, refinement.centerExternal]
    : leftLeaves;
  const rightCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === rightCenter
    ? [...rightLeaves, refinement.centerExternal]
    : rightLeaves;

  placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, verticalAxes, leftCenter, leftLayer, leftCrossLeaves, "y");
  placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, verticalAxes, rightCenter, rightLayer, rightCrossLeaves, "y");
}

function placeSymmetricCenterExternalHorizontal(positions, diagram, layoutOptions, width, height, marginY, node, useTopMiddle) {
  if (!node || positions[node]) {
    return;
  }

  positions[node] = {
    x: width / 2,
    y: useTopMiddle ? marginY : height - marginY,
    kind: nodeKind(node, diagram),
    labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
  };
}

function placeSymmetricCenterExternalVertical(positions, diagram, layoutOptions, width, marginX, node, useStartMiddle) {
  if (!node || positions[node]) {
    return;
  }

  positions[node] = {
    x: useStartMiddle ? marginX : width - marginX,
    y: layoutOptions.height / 2,
    kind: nodeKind(node, diagram),
    labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
  };
}

function symmetricTwoPointLoopLayers(axes) {
  const span = Math.abs(axes.layerEnd - axes.layerStart);
  const minLeg = 48;
  const loopChord = Math.min(span - 2 * minLeg, Math.max(120, span * 0.452));
  const legLength = (span - loopChord) / 2;
  const direction = Math.sign(axes.layerEnd - axes.layerStart) || 1;

  return {
    centerCross: (axes.crossStart + axes.crossEnd) / 2,
    externalStart: axes.layerStart,
    externalEnd: axes.layerEnd,
    internalStart: axes.layerStart + direction * legLength,
    internalEnd: axes.layerEnd - direction * legLength,
  };
}

function placeSymmetricTwoPointLoopHorizontal(positions, diagram, layoutOptions, axes, endpointA, endpointB, legA, legB) {
  const layers = symmetricTwoPointLoopLayers(axes);

  if (legA && !positions[legA.external]) {
    positions[legA.external] = axes.point(layers.externalStart, layers.centerCross, "unclassified");
  }

  if (legB && !positions[legB.external]) {
    positions[legB.external] = axes.point(layers.externalEnd, layers.centerCross, "unclassified");
  }

  if (!positions[endpointA]) {
    positions[endpointA] = axes.point(layers.internalStart, layers.centerCross, "internal");
  }

  if (!positions[endpointB]) {
    positions[endpointB] = axes.point(layers.internalEnd, layers.centerCross, "internal");
  }
}

function placeSymmetricTwoPointLoopVertical(positions, diagram, layoutOptions, axes, endpointA, endpointB, legA, legB) {
  const verticalAxes = {
    orientation: axes.orientation,
    layerStart: axes.crossStart,
    layerEnd: axes.crossEnd,
    crossStart: axes.layerStart,
    crossEnd: axes.layerEnd,
    crossOf: (position) => position.x,
    setCross: (position, cross) => {
      position.x = cross;
    },
    point: (cross, layer, kind) => ({
      x: cross,
      y: layer,
      kind,
      labelSide: labelSideForKind(kind, layoutOptions.orientation),
    }),
  };
  const layers = symmetricTwoPointLoopLayers(verticalAxes);

  if (legA && !positions[legA.external]) {
    positions[legA.external] = verticalAxes.point(layers.centerCross, layers.externalStart, "unclassified");
  }

  if (legB && !positions[legB.external]) {
    positions[legB.external] = verticalAxes.point(layers.centerCross, layers.externalEnd, "unclassified");
  }

  if (!positions[endpointA]) {
    positions[endpointA] = verticalAxes.point(layers.centerCross, layers.internalStart, "internal");
  }

  if (!positions[endpointB]) {
    positions[endpointB] = verticalAxes.point(layers.centerCross, layers.internalEnd, "internal");
  }
}

function placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, axes, centerNode, layer, leaves, layerAxis = "x") {
  if (positions[centerNode]) {
    return;
  }

  const crosses = leaves
    .map((leaf) => positions[leaf])
    .filter(Boolean)
    .map((position) => axes.crossOf(position));
  const cross = crosses.length
    ? crosses.reduce((sum, value) => sum + value, 0) / crosses.length
    : (layoutOptions.marginY + (layoutOptions.height - layoutOptions.marginY)) / 2;

  positions[centerNode] = layerAxis === "y"
    ? axes.point(cross, layer, "internal")
    : axes.point(layer, cross, "internal");
}

function orderedSemanticExternalNodes(prepared) {
  return prepared.externalOrdering.all.map((entry) => entry.id);
}

function semanticOrder(prepared, left, right) {
  const leftExternal = prepared.semantic.externalVertices.includes(left);
  const rightExternal = prepared.semantic.externalVertices.includes(right);

  if (leftExternal || rightExternal) {
    return compareExternalOrdering(prepared.externalOrdering, left, right);
  }

  const vertexById = new Map(prepared.semantic.vertices.map((vertex) => [vertex.id, vertex]));
  const leftIndex = vertexById.get(left)?.metadata?.declarationIndex ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = vertexById.get(right)?.metadata?.declarationIndex ?? Number.MAX_SAFE_INTEGER;

  return leftIndex - rightIndex || left.localeCompare(right);
}
