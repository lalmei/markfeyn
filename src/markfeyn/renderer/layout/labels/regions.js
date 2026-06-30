import { compareStable } from "../model.js";
import {
  averagePoint,
  clamp,
  expandBounds,
  lineVector,
  pointsBounds,
  selfLoopSideVector,
  translateBounds,
} from "./geometry.js";

export function buildLoopRegions(layout, prepared, candidate, curvePlan) {
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

export function pointInsideLoopRegion(point, region) {
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

export function outsidePlacementAvailable(box, region, layout) {
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
