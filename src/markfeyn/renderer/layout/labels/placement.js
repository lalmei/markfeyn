import { LABEL_METRICS as METRICS } from "../../geometry/metrics.js";
import { compareStable } from "../model.js";
import {
  buildEdgeSamples,
  buildVertexBounds,
  decorateLoopLabelBoxes,
  edgeLabelBox,
  findEdgeByLabelTarget,
  momentumArrowBox,
} from "./boxes.js";
import {
  boundsCenter,
  boundsCorners,
  curvePlanMap,
  edgeGeometry,
  edgeTangentShifts,
  expandBounds,
  geometrySample,
  isMomentumEdge,
  labelOffset,
  nodeSideShifts,
  normalizePlacementSide,
  normalizeVector,
  orderedSides,
  overlapArea,
  pointInsideBounds,
  roundBounds,
  roundPlacement,
  shiftBoxWithAnchor,
  textBounds,
  viewOverflow,
} from "./geometry.js";
import {
  buildLoopRegions,
  outsidePlacementAvailable,
  pointInsideLoopRegion,
} from "./regions.js";
import {
  labelScoreTotal,
  scoreEdgeLabelOverlap,
  scoreLabelLabelOverlap,
  scoreLabelsInsideLoops,
  scoreMomentumLoopCollision,
  scoreNodeLabelOverlap,
} from "./scoring.js";

export function resolveLabelPlacement(layout, prepared, candidate = {}) {
  const curvePlan = curvePlanMap(prepared, candidate);
  const loopRegions = buildLoopRegions(layout, prepared, candidate, curvePlan);
  const vertexBounds = buildVertexBounds(layout, prepared.semantic);
  const edgeSamples = buildEdgeSamples(layout, prepared, curvePlan);
  const specs = buildPlacementSpecs(layout, prepared, candidate, curvePlan);
  const placedBoxes = [];
  const entries = [];

  specs.forEach((spec) => {
    const selected = spec.candidates
      .map((placement, index) => scorePlacementCandidate(placement, {
        edgeSamples,
        loopRegions,
        placedBoxes,
        vertexBounds,
        layout,
      }, index))
      .sort(comparePlacementCandidates)[0];

    if (!selected) {
      return;
    }

    const boxes = selected.boxes.map((box) => ({
      ...box,
      selected: true,
    }));
    const labelBox = boxes.find((box) => box.type !== "momentum-arrow") || boxes[0];
    const arrowBox = boxes.find((box) => box.type === "momentum-arrow");

    placedBoxes.push(...boxes);
    entries.push({
      id: labelBox.id,
      type: labelBox.type,
      target: labelBox.target,
      node: labelBox.node,
      edgeId: labelBox.edgeId,
      edgeIndex: labelBox.edgeIndex,
      source: labelBox.source,
      targetNode: labelBox.targetNode,
      text: labelBox.text,
      x: roundPlacement(labelBox.x),
      y: roundPlacement(labelBox.y),
      anchor: labelBox.anchor,
      side: labelBox.side,
      defaultSide: labelBox.defaultSide,
      explicitSide: Boolean(labelBox.explicitSide),
      bounds: roundBounds(labelBox.bounds),
      score: roundPlacement(selected.rawScore),
      hardInvalid: selected.hardInvalid,
      collisionCount: selected.collisionCount,
      fallback: selected.index !== 0,
      ...(arrowBox ? {
        arrowBounds: roundBounds(arrowBox.bounds),
        arrowPoints: (arrowBox.points || []).map((point) => ({
          x: roundPlacement(point.x),
          y: roundPlacement(point.y),
        })),
      } : {}),
    });
  });

  const finalBoxes = decorateLoopLabelBoxes(placedBoxes, prepared, candidate);
  const breakdown = {
    nodeLabelOverlap: scoreNodeLabelOverlap(finalBoxes, vertexBounds),
    edgeLabelOverlap: scoreEdgeLabelOverlap(finalBoxes, vertexBounds, edgeSamples),
    labelLabelOverlap: scoreLabelLabelOverlap(finalBoxes),
    labelsInsideLoops: scoreLabelsInsideLoops(finalBoxes, loopRegions, layout),
    momentumLoopCollision: scoreMomentumLoopCollision(finalBoxes, loopRegions, vertexBounds),
  };
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  const hardCollisionCount = entries.filter((entry) => entry.hardInvalid).length;

  return {
    applied: entries.length > 0,
    entries,
    byId,
    summary: {
      labelCount: specs.length,
      placedCount: entries.length,
      fallbackCount: entries.filter((entry) => entry.fallback).length,
      hardCollisionCount,
      residualScore: roundPlacement(labelScoreTotal(breakdown)),
      breakdown: Object.fromEntries(
        Object.entries(breakdown).map(([field, value]) => [field, roundPlacement(value)])
      ),
    },
  };
}

export function labelPlacementDiagnostic(placement) {
  const summary = placement?.summary || {};
  const placedCount = summary.placedCount || 0;
  const hardCollisionCount = summary.hardCollisionCount || 0;
  const residualScore = summary.residualScore || 0;

  return {
    stage: "label-placement",
    severity: hardCollisionCount || residualScore ? "warning" : "info",
    message: hardCollisionCount
      ? `Placed ${placedCount} labels with ${hardCollisionCount} residual hard collisions`
      : `Placed ${placedCount} labels`,
    data: {
      ...summary,
      entries: (placement?.entries || []).map((entry) => ({
        id: entry.id,
        type: entry.type,
        target: entry.target,
        side: entry.side,
        x: entry.x,
        y: entry.y,
        score: entry.score,
        hardInvalid: entry.hardInvalid,
        fallback: entry.fallback,
      })),
    },
  };
}

function buildPlacementSpecs(layout, prepared, candidate, curvePlan) {
  const labels = prepared.semantic.source.labels || {};
  const specs = [];

  Object.entries(labels)
    .sort(([left], [right]) => compareStable(left, right))
    .forEach(([target, text]) => {
      if (target.includes("->")) {
        const edge = findEdgeByLabelTarget(target, prepared.semantic.propagators);
        const spec = edgePlacementSpec(edge, text, layout, curvePlan, {
          id: `declared-edge:${target}`,
          target,
          forceNormal: true,
          declaredTarget: target,
          explicitSide: Boolean(edge?.metadata?.labelSide),
        });

        if (spec) {
          specs.push(spec);
        }

        return;
      }

      const spec = nodePlacementSpec(target, text, layout.positions?.[target]);

      if (spec) {
        specs.push(spec);
      }
    });

  prepared.semantic.propagators
    .slice()
    .sort((left, right) => left.metadata.edgeIndex - right.metadata.edgeIndex || compareStable(left.id, right.id))
    .forEach((edge) => {
      if (edge.metadata.hidden) {
        return;
      }

      const text = edge.momentumLabel || edge.particleLabel;

      if (!text) {
        return;
      }

      const spec = edgePlacementSpec(edge, text, layout, curvePlan, {
        id: `edge:${edge.id}`,
        target: edge.id,
        explicitSide: Boolean(edge.metadata.labelSide),
      });

      if (spec) {
        specs.push(spec);
      }
    });

  return specs;
}

function nodePlacementSpec(target, text, position) {
  if (!position) {
    return null;
  }

  const id = `node:${target}`;
  const defaultSide = normalizePlacementSide(position.labelSide || position.kind);
  const candidates = orderedSides(defaultSide, ["top", "bottom", "left", "right"])
    .flatMap((side, sideIndex) => nodeSideShifts(side).map((shift, shiftIndex) => {
      const offset = labelOffset(side);
      const anchor = {
        x: position.x + offset.x + shift.x,
        y: position.y + offset.y + shift.y,
        anchor: offset.anchor,
      };
      const bounds = textBounds(anchor, text || target, METRICS.nodeFontSize);
      const box = {
        id,
        type: "node-label",
        target,
        node: target,
        text,
        x: anchor.x,
        y: anchor.y,
        anchor: anchor.anchor,
        side,
        defaultSide,
        bounds,
        center: boundsCenter(bounds),
        fontSize: METRICS.nodeFontSize,
      };

      return {
        id,
        boxes: [box],
        rank: sideIndex * 10 + shiftIndex,
        defaultCandidate: sideIndex === 0 && shiftIndex === 0,
      };
    }));

  return { id, type: "node-label", candidates };
}

function edgePlacementSpec(edge, text, layout, curvePlan, options = {}) {
  if (!edge) {
    return null;
  }

  const from = layout.positions?.[edge.source];
  const to = layout.positions?.[edge.target];

  if (!from || !to) {
    return null;
  }

  const id = options.id || `edge:${edge.id}`;
  const defaultSide = normalizePlacementSide(edge.metadata.labelSide || "left");
  const sides = options.explicitSide
    ? [defaultSide]
    : orderedSides(defaultSide, ["left", "right"]);
  const geometry = edgeGeometry(edge, from, to, curvePlan);
  const sample = geometrySample(geometry, 0.5);
  const tangent = normalizeVector(sample.tangent.x, sample.tangent.y);
  const candidates = sides.flatMap((side, sideIndex) => (
    edgeTangentShifts().map((shift, shiftIndex) => {
      const box = edgeLabelBox(edge, text, layout, curvePlan, {
        ...options,
        placementId: id,
        sideOverride: side,
      });

      if (!box) {
        return null;
      }

      const shifted = shiftBoxWithAnchor(box, tangent.ux * shift, tangent.uy * shift);
      const boxes = [shifted];
      const arrow = !options.forceNormal && isMomentumEdge(edge)
        ? momentumArrowBox(edge, layout, curvePlan, { sideOverride: side })
        : null;

      if (arrow) {
        boxes.push(arrow);
      }

      return {
        id,
        boxes,
        rank: sideIndex * 10 + shiftIndex + Math.abs(shift) / 100,
        defaultCandidate: sideIndex === 0 && shiftIndex === 0,
      };
    }).filter(Boolean)
  ));

  return { id, type: "edge-label", candidates };
}

function scorePlacementCandidate(candidate, context, index) {
  let rawScore = candidate.rank * 0.08;
  let collisionCount = 0;

  candidate.boxes.forEach((box) => {
    context.vertexBounds.forEach((vertex) => {
      const overlap = overlapArea(box.bounds, vertex.bounds);

      if (overlap <= 0) {
        return;
      }

      rawScore += overlap / (box.type === "momentum-arrow" ? 20 : 8);

      if (pointInsideBounds(box.center, vertex.bounds)) {
        collisionCount += 1;
      }
    });

    context.edgeSamples.forEach((edge) => {
      if (box.type !== "node-label" && edge.edgeId === box.edgeId) {
        return;
      }

      const hitCount = edge.samples.filter((point) => pointInsideBounds(point, expandBounds(box.bounds, 5))).length;

      if (!hitCount) {
        return;
      }

      rawScore += hitCount * (box.type === "node-label" ? 85 : 28);

      if (box.type === "node-label") {
        collisionCount += hitCount;
      }
    });
  });

  const labelBoxes = candidate.boxes.filter((box) => box.type !== "momentum-arrow");

  labelBoxes.forEach((box) => {
    context.placedBoxes
      .filter((placed) => placed.type !== "momentum-arrow")
      .forEach((placed) => {
        const overlap = overlapArea(box.bounds, placed.bounds);

        if (overlap <= 0) {
          return;
        }

        rawScore += 80 + overlap / 9;
        collisionCount += 1;
      });

    context.loopRegions.forEach((region) => {
      if (!pointInsideLoopRegion(box.center, region)) {
        return;
      }

      if (outsidePlacementAvailable(box, region, context.layout)) {
        rawScore += box.loopEdge ? 65 : 38;
      }
    });
  });

  candidate.boxes
    .filter((box) => box.type === "momentum-label" || box.type === "momentum-arrow")
    .forEach((box) => {
      context.loopRegions.forEach((region) => {
        const centerInside = pointInsideLoopRegion(box.center, region);
        const cornersInside = boundsCorners(box.bounds).some((corner) => pointInsideLoopRegion(corner, region));
        const arrowInside = (box.points || []).some((point) => pointInsideLoopRegion(point, region));

        if (centerInside || cornersInside || arrowInside) {
          rawScore += box.type === "momentum-arrow" ? 90 : 70;
          collisionCount += 1;
        }
      });
    });

  candidate.boxes.forEach((box) => {
    const overflow = viewOverflow(box.bounds, context.layout);

    if (overflow > 0) {
      rawScore += overflow * 2;

      if (overflow > 8) {
        collisionCount += 1;
      }
    }
  });

  const hardInvalid = collisionCount > 0;

  return {
    ...candidate,
    index,
    rawScore,
    score: rawScore + (hardInvalid ? collisionCount * 10000 : 0),
    hardInvalid,
    collisionCount,
  };
}

function comparePlacementCandidates(left, right) {
  return left.score - right.score
    || left.rank - right.rank
    || left.index - right.index
    || compareStable(left.id, right.id);
}
