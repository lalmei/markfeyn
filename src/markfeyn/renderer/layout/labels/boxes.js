import { LABEL_METRICS as METRICS } from "../../geometry/metrics.js";
import { compareStable } from "../model.js";
import {
  boundsCenter,
  cloneBounds,
  edgeLabelPosition,
  edgeGeometry,
  expandBounds,
  geometryPoint,
  isMomentumEdge,
  labelOffset,
  momentumArrowGeometry,
  normalizePlacementSide,
  pointsBounds,
  textBounds,
} from "./geometry.js";

export function buildLabelBoxes(layout, prepared, candidate, curvePlan) {
  const placedBoxes = buildPlacedLabelBoxes(layout.labelPlacement);

  if (placedBoxes) {
    return decorateLoopLabelBoxes(placedBoxes, prepared, candidate);
  }

  const labels = prepared.semantic.source.labels || {};
  const boxes = [];

  Object.entries(labels)
    .sort(([left], [right]) => compareStable(left, right))
    .forEach(([target, text]) => {
      if (target.includes("->")) {
        const edge = findEdgeByLabelTarget(target, prepared.semantic.propagators);
        const placementId = `declared-edge:${target}`;
        const box = edgeLabelBox(edge, text, layout, curvePlan, {
          forceNormal: true,
          declaredTarget: target,
          placementId,
          placement: layout.labelPlacement?.byId?.[placementId],
        });

        if (box) {
          boxes.push(box);
        }

        return;
      }

      const position = layout.positions?.[target];

      if (!position) {
        return;
      }

      const placementId = `node:${target}`;
      const placement = layout.labelPlacement?.byId?.[placementId];
      const offset = labelOffset(position.labelSide || position.kind);
      const anchor = {
        x: placement?.x ?? position.x + offset.x,
        y: placement?.y ?? position.y + offset.y,
        anchor: placement?.anchor || offset.anchor,
      };
      const bounds = textBounds(anchor, text || target, METRICS.nodeFontSize);

      boxes.push({
        id: placementId,
        type: "node-label",
        target,
        node: target,
        text,
        x: anchor.x,
        y: anchor.y,
        anchor: anchor.anchor,
        side: placement?.side || normalizePlacementSide(position.labelSide || position.kind),
        bounds,
        center: boundsCenter(bounds),
        fontSize: METRICS.nodeFontSize,
      });
    });

  prepared.semantic.propagators
    .slice()
    .sort((left, right) => left.metadata.edgeIndex - right.metadata.edgeIndex || compareStable(left.id, right.id))
    .forEach((edge) => {
      if (edge.metadata.hidden) {
        return;
      }

      if (edge.momentumLabel) {
        const placementId = `edge:${edge.id}`;
        const placement = layout.labelPlacement?.byId?.[placementId];
        const labelBox = edgeLabelBox(edge, edge.momentumLabel, layout, curvePlan, {
          placementId,
          placement,
          sideOverride: placement?.side,
        });
        const arrowBox = momentumArrowBox(edge, layout, curvePlan, {
          sideOverride: placement?.side,
        });

        if (labelBox) {
          boxes.push(labelBox);
        }

        if (arrowBox) {
          boxes.push(arrowBox);
        }

        return;
      }

      if (edge.particleLabel) {
        const placementId = `edge:${edge.id}`;
        const box = edgeLabelBox(edge, edge.particleLabel, layout, curvePlan, {
          placementId,
          placement: layout.labelPlacement?.byId?.[placementId],
        });

        if (box) {
          boxes.push(box);
        }
      }
    });

  return decorateLoopLabelBoxes(boxes, prepared, candidate);
}

export function edgeLabelBox(edge, text, layout, curvePlan, options = {}) {
  if (!edge) {
    return null;
  }

  const from = layout.positions?.[edge.source];
  const to = layout.positions?.[edge.target];

  if (!from || !to) {
    return null;
  }

  const id = options.placementId || `${options.declaredTarget ? "declared-edge" : "edge"}:${edge.id}`;
  const side = normalizePlacementSide(options.placement?.side || options.sideOverride || edge.metadata.labelSide || "left");
  const position = edgeLabelPosition(edge, from, to, side, curvePlan, options);
  const anchor = options.placement
    ? {
      x: options.placement.x,
      y: options.placement.y,
      anchor: options.placement.anchor || position.anchor,
    }
    : position;
  const bounds = textBounds(anchor, text, METRICS.edgeFontSize);
  const type = isMomentumEdge(edge) && !options.forceNormal
    ? "momentum-label"
    : "edge-label";

  return {
    id,
    type,
    target: options.declaredTarget || edge.id,
    edgeId: edge.id,
    edgeIndex: edge.metadata.edgeIndex,
    source: edge.source,
    targetNode: edge.target,
    text,
    x: anchor.x,
    y: anchor.y,
    anchor: anchor.anchor,
    side,
    defaultSide: normalizePlacementSide(edge.metadata.labelSide || "left"),
    explicitSide: Boolean(options.explicitSide ?? edge.metadata.labelSide),
    bounds,
    center: boundsCenter(bounds),
    fontSize: METRICS.edgeFontSize,
    forceNormal: Boolean(options.forceNormal),
  };
}

export function momentumArrowBox(edge, layout, curvePlan, options = {}) {
  const from = layout.positions?.[edge.source];
  const to = layout.positions?.[edge.target];

  if (!from || !to || !isMomentumEdge(edge)) {
    return null;
  }

  const arrow = momentumArrowGeometry(edge, from, to, curvePlan, options);
  const bounds = expandBounds(pointsBounds(arrow.points), Math.max(
    METRICS.momentumArrowHeadLength,
    METRICS.momentumArrowHeadWidth
  ));

  return {
    id: `momentum-arrow:${edge.id}`,
    type: "momentum-arrow",
    edgeId: edge.id,
    edgeIndex: edge.metadata.edgeIndex,
    source: edge.source,
    targetNode: edge.target,
    bounds,
    center: boundsCenter(bounds),
    points: arrow.points,
  };
}

export function buildVertexBounds(layout, semantic) {
  return semantic.vertices
    .map((vertex) => {
      const position = layout.positions?.[vertex.id];

      if (!position) {
        return null;
      }

      const radii = vertexRadii(vertex);

      return {
        id: vertex.id,
        bounds: {
          x1: position.x - radii.rx,
          x2: position.x + radii.rx,
          y1: position.y - radii.ry,
          y2: position.y + radii.ry,
        },
        center: position,
        radius: Math.max(radii.rx, radii.ry),
        rx: radii.rx,
        ry: radii.ry,
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareStable(left.id, right.id));
}

export function buildEdgeSamples(layout, prepared, curvePlan) {
  return prepared.semantic.propagators
    .filter((edge) => !edge.metadata.hidden)
    .map((edge) => {
      const from = layout.positions?.[edge.source];
      const to = layout.positions?.[edge.target];

      if (!from || !to) {
        return null;
      }

      const geometry = edgeGeometry(edge, from, to, curvePlan);
      const samples = [];
      const steps = geometry.kind === "cubic" ? 8 : 2;

      for (let step = 0; step <= steps; step += 1) {
        samples.push(geometryPoint(geometry, step / steps));
      }

      return {
        edgeId: edge.id,
        edgeIndex: edge.metadata.edgeIndex,
        samples,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.edgeIndex - right.edgeIndex || compareStable(left.edgeId, right.edgeId));
}

function buildPlacedLabelBoxes(placement) {
  if (!placement?.entries?.length) {
    return null;
  }

  return placement.entries.flatMap((entry) => {
    const labelBox = {
      id: entry.id,
      type: entry.type,
      target: entry.target,
      node: entry.node,
      edgeId: entry.edgeId,
      edgeIndex: entry.edgeIndex,
      source: entry.source,
      targetNode: entry.targetNode,
      text: entry.text,
      x: entry.x,
      y: entry.y,
      anchor: entry.anchor,
      side: entry.side,
      defaultSide: entry.defaultSide,
      explicitSide: entry.explicitSide,
      bounds: cloneBounds(entry.bounds),
      center: boundsCenter(entry.bounds),
      fontSize: entry.type === "node-label" ? METRICS.nodeFontSize : METRICS.edgeFontSize,
    };

    if (!entry.arrowBounds) {
      return [labelBox];
    }

    return [
      labelBox,
      {
        id: `momentum-arrow:${entry.edgeId}`,
        type: "momentum-arrow",
        edgeId: entry.edgeId,
        edgeIndex: entry.edgeIndex,
        source: entry.source,
        targetNode: entry.targetNode,
        bounds: cloneBounds(entry.arrowBounds),
        center: boundsCenter(entry.arrowBounds),
        points: (entry.arrowPoints || []).map((point) => ({ ...point })),
      },
    ];
  });
}

export function decorateLoopLabelBoxes(boxes, prepared, candidate) {
  return boxes.map((box) => {
    const loopEdge = isLoopEdge(box.edgeId, prepared, candidate);

    return {
      ...box,
      type: loopEdge && box.type === "edge-label" ? "loop-edge-label" : box.type,
      loopEdge,
    };
  });
}

export function findEdgeByLabelTarget(target, edges) {
  const match = String(target || "").match(/^([A-Za-z0-9_.-]+)->([A-Za-z0-9_.-]+)(?:#([0-9]+))?$/);

  if (!match) {
    return null;
  }

  const [, from, to, rawIndex] = match;
  const matches = edges
    .filter((edge) => edge.source === from && edge.target === to)
    .sort((left, right) => left.metadata.edgeIndex - right.metadata.edgeIndex || compareStable(left.id, right.id));
  const index = rawIndex ? Number(rawIndex) - 1 : 0;

  return matches[index] || null;
}

function isLoopEdge(edgeId, prepared, candidate) {
  const loop = candidate.loop || prepared.topology?.loopCandidate;

  return Boolean(edgeId && loop?.edges?.includes(edgeId));
}

function vertexRadii(vertex) {
  const definition = vertex.metadata.vertexShape;
  const shape = typeof definition === "object" ? definition.shape : definition;
  const defaultRadius = defaultVertexRadius(shape);

  if (!definition || typeof definition !== "object") {
    return { rx: defaultRadius, ry: defaultRadius };
  }

  const radius = Number.isFinite(definition.size) ? definition.size : defaultRadius;

  return {
    rx: Math.max(4, Number.isFinite(definition.rx) ? definition.rx : radius),
    ry: Math.max(4, Number.isFinite(definition.ry) ? definition.ry : radius),
  };
}

function defaultVertexRadius(shape) {
  if (shape === "blob") {
    return 18;
  }

  if (shape === "disk" || shape === "large-blob") {
    return 44;
  }

  return 5;
}
