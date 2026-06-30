import {
  blobVertexRadii,
  vertexDefinitionShape,
} from "../../geometry/vertex-shapes.js";
import {
  applyManualPositions,
  boundsForAxis,
  boundsForNodes,
  collectNodes,
  diagramAxes,
  fallbackRawPosition,
  nodeKind,
  placeExternalNodes,
  scaleCoordinate,
} from "../coordinates.js";

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

export function normalizeElkLayout(diagram, layoutOptions, elkGraph, applyNormalizations = () => {}) {
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
  applyNormalizations(diagram, positions, axes, layoutOptions);

  return { width, height, positions, options: layoutOptions };
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
