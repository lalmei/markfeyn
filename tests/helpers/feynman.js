const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");
const feynman = require("../../src/markfeyn/assets/feynman-diagrams.js");

const LAYOUT_FIXTURE_DIR = path.join(__dirname, "..", "layout", "fixtures");

function readLayoutFixture(name) {
  return fs.readFileSync(path.join(LAYOUT_FIXTURE_DIR, name), "utf8");
}

async function renderDiagramSvg(source) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const testDocument = env.document;
  const pre = testDocument.createElement("pre");
  const code = testDocument.createElement("code");

  try {
    globalThis.document = testDocument;
    globalThis.window = env.window;
    code.className = "language-feynman";
    code.textContent = source.trim();
    pre.appendChild(code);
    testDocument.body.appendChild(pre);

    feynman.renderAll(testDocument);

    // Wait on a time budget, not a tick count: ELK and canvas auto-growth
    // may need many event-loop turns on a loaded machine.
    for (const deadline = Date.now() + 10000; Date.now() < deadline;) {
      await new Promise((resolve) => setImmediate(resolve));

      const svg = testDocument.querySelector("svg.feynman-diagram__svg");

      if (svg) {
        return svg;
      }
    }

    throw new Error("Timed out waiting for diagram render");
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }

    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

function pathNumbers(path) {
  return path.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi).map(Number);
}

function cubicMidpoint(path) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = pathNumbers(path);

  return {
    x: (x0 + 3 * x1 + 3 * x2 + x3) / 8,
    y: (y0 + 3 * y1 + 3 * y2 + y3) / 8,
  };
}

function angleDegrees(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
}

function pointDistance(from, to) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function approximatelyEqual(left, right, tolerance = 0.001) {
  return Math.abs(left - right) <= tolerance;
}

function normalizeAngleDegrees(angle) {
  return ((angle % 360) + 360) % 360;
}

function contactAnglesDegrees(layout, center, nodes) {
  return nodes
    .map((node) => normalizeAngleDegrees(angleDegrees(center, layout.positions[node])))
    .sort((left, right) => left - right);
}

function angularGapsDegrees(angles) {
  return angles.map((angle, index) => {
    const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? 360 : 0);

    return next - angle;
  });
}

function assertContactStarUniform(layout, centerNode, leaves, tolerance = 0.001) {
  const center = layout.positions[centerNode];
  const distances = leaves.map((node) => pointDistance(layout.positions[node], center));
  const angles = contactAnglesDegrees(layout, center, leaves);
  const gaps = angularGapsDegrees(angles);

  assert.ok(range(distances) < tolerance, `${centerNode} external radii should match`);
  assert.ok(range(gaps) < tolerance, `${centerNode} angular gaps should be uniform`);
}

function assertMirroredAcrossVertical(center, left, right, tolerance = 0.001) {
  assert.ok(approximatelyEqual(left.y, right.y, tolerance), "mirrored leaves should share y");
  assert.ok(
    approximatelyEqual(left.x - center.x, center.x - right.x, tolerance),
    "mirrored leaves should be balanced across the vertical axis",
  );
}

function positionSignature(layout) {
  return Object.fromEntries(
    Object.entries(layout.positions)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([node, position]) => [
        node,
        {
          x: Number(position.x.toFixed(6)),
          y: Number(position.y.toFixed(6)),
          kind: position.kind,
        },
      ])
  );
}

function acuteLineAngleDegrees(from, to) {
  return Math.atan2(Math.abs(to.y - from.y), Math.abs(to.x - from.x)) * 180 / Math.PI;
}

function signedNormalDistance(point, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const normal = { x: -dy / length, y: dx / length };

  return (point.x - midpoint.x) * normal.x + (point.y - midpoint.y) * normal.y;
}

function polygonArea(points) {
  let area = 0;

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];

    area += point.x * next.y - next.x * point.y;
  });

  return area / 2;
}

function polygonCenter(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function boundingBox(points) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function boxesOverlap(left, right, padding = 0) {
  return left.minX - padding <= right.maxX
    && left.maxX + padding >= right.minX
    && left.minY - padding <= right.maxY
    && left.maxY + padding >= right.minY;
}

function sharedMemberCount(left, right) {
  const rightSet = new Set(right);

  return left.filter((value) => rightSet.has(value)).length;
}

function selectedLoopRegions(layout) {
  const selectedIds = new Set(layout.multiloopCandidate?.regions || []);

  return (layout.analysis.topology.loopRegions || [])
    .filter((region) => selectedIds.has(region.id));
}

function assertSelectedLoopRegionsNonDegenerate(layout) {
  selectedLoopRegions(layout).forEach((region) => {
    const points = region.nodes.map((node) => layout.positions[node]);

    assert.ok(
      Math.abs(polygonArea(points)) > 200,
      `${region.id} should have a non-degenerate polygon`,
    );
  });
}

function assertSelectedDisjointRegionsDoNotOverlap(layout) {
  const regions = selectedLoopRegions(layout).map((region) => ({
    region,
    box: boundingBox(region.nodes.map((node) => layout.positions[node])),
  }));

  for (let leftIndex = 0; leftIndex < regions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < regions.length; rightIndex += 1) {
      const left = regions[leftIndex];
      const right = regions[rightIndex];

      if (sharedMemberCount(left.region.nodes, right.region.nodes)) {
        continue;
      }

      assert.equal(
        boxesOverlap(left.box, right.box, 6),
        false,
        `${left.region.id} and ${right.region.id} should not overlap`,
      );
    }
  }
}

function range(values) {
  return Math.max(...values) - Math.min(...values);
}

function pointInsidePolygon(point, points) {
  let inside = false;

  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index, index += 1) {
    const current = points[index];
    const previous = points[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || 1) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function loopPoints(layout) {
  return layout.analysis.topology.loopCandidate.nodes.map((node) => layout.positions[node]);
}

function loopCandidateDiagnostic(layout) {
  return layout.diagnostics.find((diagnostic) => diagnostic.stage === "loop-candidate");
}

function symmetricUnclassifiedDiagnostic(layout) {
  return layout.diagnostics.find((diagnostic) => diagnostic.stage === "symmetric-unclassified");
}

function labelPlacementEntry(layout, id) {
  return layout.labelPlacement?.byId?.[id];
}

function assertFiniteLabelPlacement(layout) {
  assert.ok(layout.labelPlacement);
  assert.ok(Number.isFinite(layout.labelPlacement.summary.residualScore));
  Object.entries(layout.labelPlacement.summary.breakdown).forEach(([field, value]) => {
    assert.equal(typeof value, "number", `${field} label summary should be numeric`);
    assert.ok(Number.isFinite(value), `${field} label summary should be finite`);
  });
  layout.labelPlacement.entries.forEach((entry) => {
    assert.ok(Number.isFinite(entry.x), `${entry.id}.x should be finite`);
    assert.ok(Number.isFinite(entry.y), `${entry.id}.y should be finite`);
    assert.ok(Number.isFinite(entry.score), `${entry.id}.score should be finite`);
  });
}

function assertFiniteScore(layout) {
  Object.entries(layout.score.breakdown).forEach(([field, value]) => {
    assert.equal(typeof value, "number", `${field} should be numeric`);
    assert.ok(Number.isFinite(value), `${field} should be finite`);
  });
  assert.equal(typeof layout.score.total, "number");
  assert.ok(Number.isFinite(layout.score.total));
}

function edgePathBounds(diagram, layout) {
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };

  diagram.edges.forEach((edge) => {
    const from = layout.positions[edge.from];
    const to = layout.positions[edge.to];

    if (!from || !to) {
      return;
    }

    const path = feynman.edgePath(edge, from, to);
    const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);

    for (let index = 0; index < numbers.length; index += 2) {
      bounds.minX = Math.min(bounds.minX, numbers[index]);
      bounds.maxX = Math.max(bounds.maxX, numbers[index]);
      bounds.minY = Math.min(bounds.minY, numbers[index + 1]);
      bounds.maxY = Math.max(bounds.maxY, numbers[index + 1]);
    }
  });

  return bounds;
}

module.exports = {
  LAYOUT_FIXTURE_DIR,
  readLayoutFixture,
  renderDiagramSvg,
  pathNumbers,
  cubicMidpoint,
  angleDegrees,
  pointDistance,
  approximatelyEqual,
  normalizeAngleDegrees,
  contactAnglesDegrees,
  angularGapsDegrees,
  assertContactStarUniform,
  assertMirroredAcrossVertical,
  positionSignature,
  acuteLineAngleDegrees,
  signedNormalDistance,
  polygonArea,
  polygonCenter,
  boundingBox,
  boxesOverlap,
  sharedMemberCount,
  selectedLoopRegions,
  assertSelectedLoopRegionsNonDegenerate,
  assertSelectedDisjointRegionsDoNotOverlap,
  range,
  pointInsidePolygon,
  loopPoints,
  loopCandidateDiagnostic,
  symmetricUnclassifiedDiagnostic,
  labelPlacementEntry,
  assertFiniteLabelPlacement,
  assertFiniteScore,
  edgePathBounds,
};
