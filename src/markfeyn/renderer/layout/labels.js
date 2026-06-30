import { LABEL_METRICS as METRICS } from "../geometry/metrics.js";
import { compareStable } from "./model.js";

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

function buildLabelBoxes(layout, prepared, candidate, curvePlan) {
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

function edgeLabelBox(edge, text, layout, curvePlan, options = {}) {
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

function momentumArrowBox(edge, layout, curvePlan, options = {}) {
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

function buildLoopRegions(layout, prepared, candidate, curvePlan) {
  const regions = [];
  const loop = candidate.loop || prepared.topology.loopCandidate;

  if (loop) {
    const loopRegion = loopRegionForLoop(layout, loop, candidate, curvePlan);

    if (loopRegion) {
      regions.push(loopRegion);
    }
  }

  (prepared.topology.selfEnergyBubbles || [])
    .slice()
    .sort((left, right) => compareStable(left.id, right.id))
    .forEach((group) => {
      const region = selfEnergyRegion(layout, group, curvePlan);

      if (region) {
        regions.push(region);
      }
    });

  return regions;
}

function loopRegionForLoop(layout, loop, candidate, curvePlan) {
  if (loop.type === "tadpole") {
    const node = loop.nodes[0];
    const position = layout.positions?.[node];

    if (!position) {
      return null;
    }

    const assignment = loop.edges
      .map((edge) => curvePlan.get(edge))
      .find(Boolean);
    const side = assignment?.side || candidate.variant?.loopSide || "top";
    const amount = assignment?.amount || 0.72;
    const radius = 68 * amount;
    const sideVector = selfLoopSideVector(side);
    const center = {
      x: position.x + sideVector.x * radius * 1.05,
      y: position.y + sideVector.y * radius * 1.05,
    };

    return {
      id: loop.id,
      type: "tadpole",
      nodes: loop.nodes.slice(),
      edges: new Set(loop.edges),
      center,
      radiusX: radius * 1.15,
      radiusY: radius * 1.15,
      bounds: {
        x1: center.x - radius * 1.15,
        x2: center.x + radius * 1.15,
        y1: center.y - radius * 1.15,
        y2: center.y + radius * 1.15,
      },
    };
  }

  const points = loop.nodes
    .map((node) => layout.positions?.[node])
    .filter(Boolean);

  if (points.length !== loop.nodes.length || points.length < 3) {
    return null;
  }

  return {
    id: loop.id,
    type: "polygon",
    nodes: loop.nodes.slice(),
    edges: new Set(loop.edges),
    points,
    center: averagePoint(points),
    bounds: pointsBounds(points),
  };
}

function selfEnergyRegion(layout, group, curvePlan) {
  const [firstNode, secondNode] = group.nodes;
  const first = layout.positions?.[firstNode];
  const second = layout.positions?.[secondNode];

  if (!first || !second) {
    return null;
  }

  const vector = lineVector(first, second);
  const maxAmount = Math.max(
    ...group.edges.map((edge) => curvePlan.get(edge.id)?.amount || edge.curveAmount || 0.5),
    0.5
  );
  const center = {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };

  return {
    id: `self-energy:${group.id}`,
    type: "self-energy",
    nodes: group.nodes.slice(),
    edges: new Set(group.edges.map((edge) => edge.id)),
    center,
    axis: { x: vector.ux, y: vector.uy },
    normal: { x: vector.px, y: vector.py },
    radiusX: Math.max(24, vector.length / 2),
    radiusY: Math.max(24, vector.length * maxAmount * 0.72),
    bounds: expandBounds(pointsBounds([first, second]), vector.length * maxAmount),
  };
}

function buildVertexBounds(layout, semantic) {
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

function buildEdgeSamples(layout, prepared, curvePlan) {
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

function scoreNodeLabelOverlap(boxes, vertexBounds) {
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

function scoreEdgeLabelOverlap(boxes, vertexBounds, edgeSamples) {
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

function scoreLabelLabelOverlap(boxes) {
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

function scoreLabelsInsideLoops(boxes, loopRegions, layout) {
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

function scoreMomentumLoopCollision(boxes, loopRegions, vertexBounds) {
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

function outsidePlacementAvailable(box, region, layout) {
  const options = layout.options || {};
  const marginX = Math.max(0, options.marginX ?? 0) / 2;
  const marginY = Math.max(0, options.marginY ?? 0) / 2;
  const width = layout.width ?? options.width ?? 0;
  const height = layout.height ?? options.height ?? 0;
  let dx = box.center.x - region.center.x;
  let dy = box.center.y - region.center.y;

  if (Math.hypot(dx, dy) < 0.001) {
    dx = 0;
    dy = -1;
  }

  const length = Math.hypot(dx, dy) || 1;
  const shift = Math.max(box.bounds.x2 - box.bounds.x1, box.bounds.y2 - box.bounds.y1, 32);
  const moved = translateBounds(box.bounds, (dx / length) * shift, (dy / length) * shift);

  return moved.x1 >= marginX
    && moved.y1 >= marginY
    && (!width || moved.x2 <= width - marginX)
    && (!height || moved.y2 <= height - marginY);
}

function edgeLabelPosition(edge, from, to, side, curvePlan, options = {}) {
  const sample = geometrySample(edgeGeometry(edge, from, to, curvePlan), 0.5);
  const tangent = normalizeVector(sample.tangent.x, sample.tangent.y);
  const resolvedSide = normalizePlacementSide(options.sideOverride || side);

  if (isMomentumEdge(edge)) {
    if (!options.forceNormal) {
      return momentumLabelPosition(edge, sample.point, tangent, resolvedSide);
    }

    const momentumNormal = momentumNormalForTangent(edge, tangent, resolvedSide);

    return {
      x: sample.point.x - momentumNormal.x * METRICS.edgeLabelOffset,
      y: sample.point.y - momentumNormal.y * METRICS.edgeLabelOffset,
      anchor: "middle",
    };
  }

  const normalSign = resolvedSide === "right" ? 1 : -1;

  return {
    x: sample.point.x + tangent.px * METRICS.edgeLabelOffset * normalSign,
    y: sample.point.y + tangent.py * METRICS.edgeLabelOffset * normalSign,
    anchor: "middle",
  };
}

function momentumLabelPosition(edge, point, tangent, sideOverride) {
  const normal = momentumNormalForTangent(edge, tangent, sideOverride);
  const offset = momentumArrowDistance(edge)
    + METRICS.momentumLabelGap
    + momentumLabelDistance(edge);

  return {
    x: point.x + normal.x * offset,
    y: point.y + normal.y * offset,
    anchor: "middle",
  };
}

function momentumArrowGeometry(edge, from, to, curvePlan, options = {}) {
  const geometry = edgeGeometry(edge, from, to, curvePlan);
  const shorten = momentumArrowShorten(edge);
  const reverse = edge.momentumDirection === "target-to-source";
  const start = reverse ? 1 - shorten : shorten;
  const end = reverse ? shorten : 1 - shorten;
  const steps = geometry.kind === "cubic" ? 8 : 1;
  const midpoint = geometrySample(geometry, 0.5);
  const normal = momentumNormalForTangent(
    edge,
    normalizeVector(midpoint.tangent.x, midpoint.tangent.y),
    options.sideOverride
  );
  const offset = momentumArrowDistance(edge);
  const points = [];

  for (let step = 0; step <= steps; step += 1) {
    const t = start + ((end - start) * step) / steps;
    const point = geometryPoint(geometry, t);

    points.push({
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    });
  }

  return { points };
}

function edgeGeometry(edge, from, to, curvePlan) {
  const outAngle = Number(edge.metadata.outAngle);
  const inAngle = Number(edge.metadata.inAngle);

  if (samePoint(from, to)) {
    return selfLoopGeometry(edge, from, outAngle, inAngle, curvePlan);
  }

  if (Number.isFinite(outAngle) || Number.isFinite(inAngle)) {
    return angleCurveGeometry(edge, from, to, outAngle, inAngle);
  }

  const curve = edgeCurve(edge, curvePlan);

  if (curve) {
    return offsetCurveGeometry({ ...edge, curve }, from, to);
  }

  return {
    kind: "line",
    from,
    to,
  };
}

function edgeCurve(edge, curvePlan) {
  return edge.metadata.curve || curvePlan.get(edge.id) || null;
}

function selfLoopGeometry(edge, point, outAngle, inAngle, curvePlan) {
  const curve = edgeCurve(edge, curvePlan);
  const amount = clamp(curve?.amount ?? 0.72, 0.28, 1.1);
  const radius = 68 * amount;

  if (Number.isFinite(outAngle) || Number.isFinite(inAngle)) {
    const outVector = angleUnitVector(Number.isFinite(outAngle) ? outAngle : 135);
    const inVector = angleUnitVector(Number.isFinite(inAngle) ? inAngle : 45);

    return {
      kind: "cubic",
      from: point,
      c1: {
        x: point.x + outVector.x * radius * 1.65,
        y: point.y + outVector.y * radius * 1.65,
      },
      c2: {
        x: point.x + inVector.x * radius * 1.65,
        y: point.y + inVector.y * radius * 1.65,
      },
      to: point,
    };
  }

  const side = selfLoopSideVector(curve?.side);
  const tangent = { x: -side.y, y: side.x };

  return {
    kind: "cubic",
    from: point,
    c1: {
      x: point.x - tangent.x * radius + side.x * radius * 1.7,
      y: point.y - tangent.y * radius + side.y * radius * 1.7,
    },
    c2: {
      x: point.x + tangent.x * radius + side.x * radius * 1.7,
      y: point.y + tangent.y * radius + side.y * radius * 1.7,
    },
    to: point,
  };
}

function offsetCurveGeometry(edge, from, to) {
  const vector = lineVector(from, to);
  const normal = leftNormalVector(vector);
  const side = edge.curve.side === "right" ? -1 : 1;
  const looseness = edge.metadata.looseness ?? 1;
  const offset = vector.length * edge.curve.amount * looseness * side;

  if (edge.curve.shape === "semicircle") {
    return {
      kind: "cubic",
      from,
      c1: {
        x: from.x + normal.x * offset,
        y: from.y + normal.y * offset,
      },
      c2: {
        x: to.x + normal.x * offset,
        y: to.y + normal.y * offset,
      },
      to,
    };
  }

  return {
    kind: "cubic",
    from,
    c1: {
      x: from.x + vector.dx * 0.33 + normal.x * offset,
      y: from.y + vector.dy * 0.33 + normal.y * offset,
    },
    c2: {
      x: from.x + vector.dx * 0.67 + normal.x * offset,
      y: from.y + vector.dy * 0.67 + normal.y * offset,
    },
    to,
  };
}

function angleCurveGeometry(edge, from, to, outAngle, inAngle) {
  const vector = lineVector(from, to);
  const looseness = edge.metadata.looseness ?? 1;
  const handle = vector.length * 0.46 * looseness;
  const relativeBase = edge.metadata.relativeAngles ? vectorAngle(vector) : 0;
  const resolvedOut = Number.isFinite(outAngle) ? relativeBase + outAngle : vectorAngle(vector);
  const resolvedIn = Number.isFinite(inAngle) ? relativeBase + inAngle : vectorAngle(vector) + 180;
  const outVector = angleUnitVector(resolvedOut);
  const inVector = angleUnitVector(resolvedIn);

  return {
    kind: "cubic",
    from,
    c1: {
      x: from.x + outVector.x * handle,
      y: from.y + outVector.y * handle,
    },
    c2: {
      x: to.x + inVector.x * handle,
      y: to.y + inVector.y * handle,
    },
    to,
  };
}

function geometryPoint(geometry, t) {
  if (geometry.kind === "cubic") {
    return cubicPoint(geometry.from, geometry.c1, geometry.c2, geometry.to, t);
  }

  return {
    x: geometry.from.x + (geometry.to.x - geometry.from.x) * t,
    y: geometry.from.y + (geometry.to.y - geometry.from.y) * t,
  };
}

function geometryTangent(geometry, t) {
  if (geometry.kind === "cubic") {
    return cubicTangent(geometry.from, geometry.c1, geometry.c2, geometry.to, t);
  }

  return {
    x: geometry.to.x - geometry.from.x,
    y: geometry.to.y - geometry.from.y,
  };
}

function geometrySample(geometry, t) {
  return {
    point: geometryPoint(geometry, t),
    tangent: geometryTangent(geometry, t),
  };
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;

  return {
    x: (mt ** 3) * p0.x + 3 * (mt ** 2) * t * p1.x + 3 * mt * (t ** 2) * p2.x + (t ** 3) * p3.x,
    y: (mt ** 3) * p0.y + 3 * (mt ** 2) * t * p1.y + 3 * mt * (t ** 2) * p2.y + (t ** 3) * p3.y,
  };
}

function cubicTangent(p0, p1, p2, p3, t) {
  const mt = 1 - t;

  return {
    x: 3 * (mt ** 2) * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * (t ** 2) * (p3.x - p2.x),
    y: 3 * (mt ** 2) * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * (t ** 2) * (p3.y - p2.y),
  };
}

function labelOffset(kind) {
  if (kind === "left" || kind === "incoming") {
    return { x: -METRICS.labelHorizontalOffset, y: 0, anchor: "end" };
  }

  if (kind === "right" || kind === "outgoing") {
    return { x: METRICS.labelHorizontalOffset, y: 0, anchor: "start" };
  }

  if (kind === "bottom") {
    return { x: 0, y: METRICS.labelBottomOffset, anchor: "middle" };
  }

  return { x: 0, y: -METRICS.labelTopOffset, anchor: "middle" };
}

function textBounds(anchor, text, fontSize) {
  const width = estimateTextWidth(text, fontSize);
  const height = fontSize * 1.1;
  let x1 = anchor.x - width / 2;
  let x2 = anchor.x + width / 2;

  if (anchor.anchor === "start") {
    x1 = anchor.x;
    x2 = anchor.x + width;
  } else if (anchor.anchor === "end") {
    x1 = anchor.x - width;
    x2 = anchor.x;
  }

  return {
    x1,
    x2,
    y1: anchor.y - height / 2,
    y2: anchor.y + height / 2,
  };
}

function estimateTextWidth(text, fontSize) {
  const plain = plainLabelText(text);
  const chars = Array.from(plain).length;
  const narrow = (plain.match(/[.,:+\-_=]/g) || []).length;
  const wide = (plain.match(/[MWmw]/g) || []).length;
  const units = Math.max(1, chars - narrow * 0.35 + wide * 0.25);

  return units * fontSize * 0.56;
}

function plainLabelText(text) {
  return String(text || "")
    .replace(/\\overline\{([^}]*)\}/g, "$1")
    .replace(/\\([A-Za-z]+)/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/[_^]/g, "")
    .trim();
}

function curvePlanMap(prepared, candidate) {
  const map = new Map();

  (prepared.parallelCurvePlan || []).forEach((assignment) => {
    map.set(assignment.propagator, {
      side: assignment.side,
      amount: assignment.amount,
      shape: assignment.shape,
    });
  });

  (candidate.curvePlan || []).forEach((assignment) => {
    map.set(assignment.edge, {
      side: assignment.side,
      amount: assignment.amount,
      shape: assignment.shape,
    });
  });

  return map;
}

function findEdgeByLabelTarget(target, edges) {
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

function pointInsideLoopRegion(point, region) {
  if (region.type === "polygon") {
    return pointInsidePolygon(point, region.points);
  }

  if (region.type === "self-energy") {
    const dx = point.x - region.center.x;
    const dy = point.y - region.center.y;
    const along = dx * region.axis.x + dy * region.axis.y;
    const cross = dx * region.normal.x + dy * region.normal.y;

    return (along / region.radiusX) ** 2 + (cross / region.radiusY) ** 2 <= 1;
  }

  const normalized = ((point.x - region.center.x) / region.radiusX) ** 2
    + ((point.y - region.center.y) / region.radiusY) ** 2;

  return normalized <= 1;
}

function pointInsidePolygon(point, polygon) {
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || 1) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function boundsCenter(bounds) {
  return {
    x: (bounds.x1 + bounds.x2) / 2,
    y: (bounds.y1 + bounds.y2) / 2,
  };
}

function boundsCorners(bounds) {
  return [
    { x: bounds.x1, y: bounds.y1 },
    { x: bounds.x2, y: bounds.y1 },
    { x: bounds.x2, y: bounds.y2 },
    { x: bounds.x1, y: bounds.y2 },
  ];
}

function pointsBounds(points) {
  return {
    x1: Math.min(...points.map((point) => point.x)),
    x2: Math.max(...points.map((point) => point.x)),
    y1: Math.min(...points.map((point) => point.y)),
    y2: Math.max(...points.map((point) => point.y)),
  };
}

function expandBounds(bounds, amount) {
  return {
    x1: bounds.x1 - amount,
    x2: bounds.x2 + amount,
    y1: bounds.y1 - amount,
    y2: bounds.y2 + amount,
  };
}

function translateBounds(bounds, dx, dy) {
  return {
    x1: bounds.x1 + dx,
    x2: bounds.x2 + dx,
    y1: bounds.y1 + dy,
    y2: bounds.y2 + dy,
  };
}

function shiftBoxWithAnchor(box, dx, dy) {
  return {
    ...box,
    x: box.x + dx,
    y: box.y + dy,
    bounds: translateBounds(box.bounds, dx, dy),
    center: {
      x: box.center.x + dx,
      y: box.center.y + dy,
    },
  };
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

function decorateLoopLabelBoxes(boxes, prepared, candidate) {
  return boxes.map((box) => {
    const loopEdge = isLoopEdge(box.edgeId, prepared, candidate);

    return {
      ...box,
      type: loopEdge && box.type === "edge-label" ? "loop-edge-label" : box.type,
      loopEdge,
    };
  });
}

function cloneBounds(bounds) {
  return {
    x1: bounds.x1,
    x2: bounds.x2,
    y1: bounds.y1,
    y2: bounds.y2,
  };
}

function orderedSides(preferred, sides) {
  const normalized = normalizePlacementSide(preferred);

  return [
    normalized,
    ...sides.filter((side) => side !== normalized),
  ];
}

function normalizePlacementSide(side) {
  if (side === "incoming" || side === "left") {
    return "left";
  }

  if (side === "outgoing" || side === "right") {
    return "right";
  }

  if (side === "bottom") {
    return "bottom";
  }

  return "top";
}

function nodeSideShifts(side) {
  if (side === "left" || side === "right") {
    return [
      { x: 0, y: 0 },
      { x: 0, y: -16 },
      { x: 0, y: 16 },
    ];
  }

  return [
    { x: 0, y: 0 },
    { x: -18, y: 0 },
    { x: 18, y: 0 },
  ];
}

function edgeTangentShifts() {
  return [0, -18, 18];
}

function viewOverflow(bounds, layout) {
  const width = layout.width ?? layout.options?.width ?? 0;
  const height = layout.height ?? layout.options?.height ?? 0;

  if (!width || !height) {
    return 0;
  }

  return Math.max(0, -bounds.x1)
    + Math.max(0, -bounds.y1)
    + Math.max(0, bounds.x2 - width)
    + Math.max(0, bounds.y2 - height);
}

function roundBounds(bounds) {
  return {
    x1: roundPlacement(bounds.x1),
    x2: roundPlacement(bounds.x2),
    y1: roundPlacement(bounds.y1),
    y2: roundPlacement(bounds.y2),
  };
}

function roundPlacement(value) {
  return Number(value.toFixed(6));
}

function pointInsideBounds(point, bounds) {
  return point.x >= bounds.x1
    && point.x <= bounds.x2
    && point.y >= bounds.y1
    && point.y <= bounds.y2;
}

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x2, right.x2) - Math.max(left.x1, right.x1));
  const height = Math.max(0, Math.min(left.y2, right.y2) - Math.max(left.y1, right.y1));

  return width * height;
}

function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function samePoint(from, to) {
  return Math.abs(from.x - to.x) < 0.001 && Math.abs(from.y - to.y) < 0.001;
}

function isMomentumEdge(edge) {
  return edge.metadata.labelPlacement === "momentum" || edge.metadata.labelPlacement === "momentum-prime";
}

function momentumNormalForTangent(edge, tangent, sideOverride) {
  const normal = canonicalMomentumNormal(tangent);
  const normalSign = normalizePlacementSide(sideOverride || (
    edge.metadata.labelPlacement === "momentum-prime" ? "right" : "left"
  )) === "right" ? 1 : -1;

  return {
    x: normal.x * normalSign,
    y: normal.y * normalSign,
  };
}

function canonicalMomentumNormal(tangent) {
  let ux = tangent.ux;
  let uy = tangent.uy;

  if (Math.abs(ux) >= Math.abs(uy)) {
    if (ux < 0) {
      ux *= -1;
      uy *= -1;
    }
  } else if (uy < 0) {
    ux *= -1;
    uy *= -1;
  }

  return {
    x: -uy,
    y: ux,
  };
}

function momentumArrowDistance(edge) {
  return edge.metadata.momentum?.arrowDistance ?? METRICS.momentumArrowOffset;
}

function momentumLabelDistance(edge) {
  return edge.metadata.momentum?.labelDistance ?? 0;
}

function momentumArrowShorten(edge) {
  return edge.metadata.momentum?.arrowShorten ?? METRICS.momentumArrowShorten;
}

function lineVector(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    dx,
    dy,
    length,
    ux: dx / length,
    uy: dy / length,
    px: -dy / length,
    py: dx / length,
  };
}

function normalizeVector(dx, dy) {
  const length = Math.hypot(dx, dy) || 1;

  return {
    ux: dx / length,
    uy: dy / length,
    px: -dy / length,
    py: dx / length,
  };
}

function leftNormalVector(vector) {
  return {
    x: vector.dy / vector.length,
    y: -vector.dx / vector.length,
  };
}

function vectorAngle(vector) {
  return (Math.atan2(-vector.dy, vector.dx) * 180) / Math.PI;
}

function angleUnitVector(degrees) {
  const radians = (degrees * Math.PI) / 180;

  return {
    x: Math.cos(radians),
    y: -Math.sin(radians),
  };
}

function selfLoopSideVector(side) {
  if (side === "right") {
    return { x: 1, y: 0 };
  }

  if (side === "bottom") {
    return { x: 0, y: 1 };
  }

  if (side === "left") {
    return { x: -1, y: 0 };
  }

  return { x: 0, y: -1 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
