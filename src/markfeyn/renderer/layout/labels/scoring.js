import {
  buildEdgeSamples,
  buildLabelBoxes,
  buildVertexBounds,
} from "./boxes.js";
import {
  boundsCorners,
  curvePlanMap,
  expandBounds,
  overlapArea,
  pointInsideBounds,
} from "./geometry.js";
import {
  buildLoopRegions,
  outsidePlacementAvailable,
  pointInsideLoopRegion,
} from "./regions.js";

export const LABEL_SCORE_FIELDS = Object.freeze([
  "nodeLabelOverlap",
  "edgeLabelOverlap",
  "labelLabelOverlap",
  "labelsInsideLoops",
  "momentumLoopCollision",
]);

export function scoreLabelGeometry(layout, prepared, candidate = {}) {
  return analyzeLabelGeometry(layout, prepared, candidate).breakdown;
}

export function analyzeLabelGeometry(layout, prepared, candidate = {}) {
  const curvePlan = curvePlanMap(prepared, candidate);
  const loopRegions = buildLoopRegions(layout, prepared, candidate, curvePlan);
  const vertexBounds = buildVertexBounds(layout, prepared.semantic);
  const edgeSamples = buildEdgeSamples(layout, prepared, curvePlan);
  const boxes = buildLabelBoxes(layout, prepared, candidate, curvePlan);
  const breakdown = {
    nodeLabelOverlap: scoreNodeLabelOverlap(boxes, vertexBounds),
    edgeLabelOverlap: scoreEdgeLabelOverlap(boxes, vertexBounds, edgeSamples),
    labelLabelOverlap: scoreLabelLabelOverlap(boxes),
    labelsInsideLoops: scoreLabelsInsideLoops(boxes, loopRegions, layout),
    momentumLoopCollision: scoreMomentumLoopCollision(boxes, loopRegions, vertexBounds),
  };

  return {
    boxes,
    loopRegions,
    breakdown,
    details: {
      labelCount: boxes.length,
      loopRegionCount: loopRegions.length,
    },
  };
}

export function labelScoreTotal(scoreOrBreakdown = {}) {
  const breakdown = scoreOrBreakdown.breakdown || scoreOrBreakdown;

  return LABEL_SCORE_FIELDS.reduce((sum, field) => sum + (breakdown[field] || 0), 0);
}

export function nonLabelScoreTotal(scoreOrBreakdown = {}) {
  const breakdown = scoreOrBreakdown.breakdown || scoreOrBreakdown;
  const labelFields = new Set(LABEL_SCORE_FIELDS);

  return Object.entries(breakdown).reduce((sum, [field, value]) => (
    labelFields.has(field) ? sum : sum + value
  ), 0);
}

export function scoreNodeLabelOverlap(boxes, vertexBounds) {
  let penalty = 0;

  boxes
    .filter((box) => box.type === "node-label")
    .forEach((box) => {
      vertexBounds.forEach((vertex) => {
        const overlap = overlapArea(box.bounds, vertex.bounds);

        if (overlap > 0) {
          penalty += overlap / 18;
        }
      });
    });

  return penalty;
}

export function scoreEdgeLabelOverlap(boxes, vertexBounds, edgeSamples) {
  let penalty = 0;

  boxes
    .filter((box) => (
      box.type === "node-label"
      || box.type === "edge-label"
      || box.type === "loop-edge-label"
      || box.type === "momentum-label"
      || box.type === "momentum-arrow"
    ))
    .forEach((box) => {
      vertexBounds.forEach((vertex) => {
        const overlap = overlapArea(box.bounds, vertex.bounds);

        if (overlap > 0) {
          penalty += overlap / 18;
        }
      });

      edgeSamples.forEach((edge) => {
        if (box.type !== "node-label" && edge.edgeId === box.edgeId) {
          return;
        }

        if (edge.samples.some((point) => pointInsideBounds(point, expandBounds(box.bounds, 4)))) {
          penalty += box.type === "node-label" ? 22 : 10;
        }
      });
    });

  return penalty;
}

export function scoreLabelLabelOverlap(boxes) {
  const labelBoxes = boxes.filter((box) => box.type !== "momentum-arrow");
  let penalty = 0;

  for (let leftIndex = 0; leftIndex < labelBoxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < labelBoxes.length; rightIndex += 1) {
      const overlap = overlapArea(labelBoxes[leftIndex].bounds, labelBoxes[rightIndex].bounds);

      if (overlap > 0) {
        penalty += overlap / 28;
      }
    }
  }

  return penalty;
}

export function scoreLabelsInsideLoops(boxes, loopRegions, layout) {
  if (!loopRegions.length) {
    return 0;
  }

  let penalty = 0;

  boxes
    .filter((box) => box.type !== "momentum-arrow")
    .forEach((box) => {
      loopRegions.forEach((region) => {
        if (!pointInsideLoopRegion(box.center, region)) {
          return;
        }

        if (outsidePlacementAvailable(box, region, layout)) {
          penalty += box.loopEdge ? 65 : 38;
        }
      });
    });

  return penalty;
}

export function scoreMomentumLoopCollision(boxes, loopRegions, vertexBounds) {
  const momentumBoxes = boxes.filter((box) => box.type === "momentum-label" || box.type === "momentum-arrow");
  let penalty = 0;

  momentumBoxes.forEach((box) => {
    loopRegions.forEach((region) => {
      const centerInside = pointInsideLoopRegion(box.center, region);
      const cornersInside = boundsCorners(box.bounds).some((corner) => pointInsideLoopRegion(corner, region));
      const arrowInside = (box.points || []).some((point) => pointInsideLoopRegion(point, region));

      if (centerInside || cornersInside || arrowInside) {
        penalty += box.type === "momentum-arrow" ? 90 : 70;
      }
    });

    vertexBounds.forEach((vertex) => {
      const overlap = overlapArea(box.bounds, vertex.bounds);
      const arrowNearVertex = (box.points || []).some((point) => (
        Math.hypot(point.x - vertex.center.x, point.y - vertex.center.y) < vertex.radius + 8
      ));

      if (overlap > 0 || arrowNearVertex) {
        penalty += 36 + overlap / 24;
      }
    });
  });

  return penalty;
}
