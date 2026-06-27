const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

const LAYOUT_FIXTURE_DIR = path.join(__dirname, "layout", "fixtures");

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

    for (let attempt = 0; attempt < 100; attempt += 1) {
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

async function testSampleDiagram() {
  const source = `
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
fermion i2->v1 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1->v2:γ
`;

  const diagram = feynman.parseFeynman(source);
  assert.equal(diagram.errors.length, 0);
  assert.deepEqual(diagram.incoming, ["i1", "i2"]);
  assert.deepEqual(diagram.outgoing, ["o1", "o2"]);
  assert.equal(diagram.edges.length, 5);
  assert.equal(diagram.labels.i1, "e⁻");
  assert.equal(diagram.labels["v1->v2"], "γ");

  const layout = await feynman.layoutFeynman(diagram);
  assert.equal(layout.options.layout, "spring");
  assert.equal(layout.width, 520);
  assert.equal(layout.height, 330);
  ["i1", "i2", "v1", "v2", "o1", "o2"].forEach((node) => {
    assert.ok(layout.positions[node], `${node} should have a position`);
  });
  assert.equal(layout.positions.i1.kind, "incoming");
  assert.equal(layout.positions.o1.kind, "outgoing");
  assert.equal(layout.positions.v1.kind, "internal");

  assert.ok(layout.positions.i1.x < layout.positions.v1.x);
  assert.ok(layout.positions.v2.x < layout.positions.o1.x);
  assert.ok(layout.width / layout.height < 1.7);
  assert.ok(
    (layout.positions.v1.x - layout.positions.i1.x)
      / (layout.positions.v1.y - layout.positions.i1.y)
      < 1.2
  );
  assert.match(
    feynman.wavePath(layout.positions.v1, layout.positions.v2, 7, 18),
    /^M\s/
  );
  assert.match(
    feynman.gluonPath(layout.positions.v1, layout.positions.v2, 5.5, 13),
    /^M\s/
  );
}

async function testParserValidation() {
  const diagram = feynman.parseFeynman(`
# comments and blank lines are ignored
incoming i1
outgoing o1
fermion i1=>v1
bogus v1->o1
label i1:"incoming electron" o1:'outgoing muon'
`);

  assert.equal(diagram.incoming[0], "i1");
  assert.equal(diagram.labels.i1, "incoming electron");
  assert.equal(diagram.labels.o1, "outgoing muon");
  assert.equal(diagram.errors.length, 2);
  assert.match(diagram.errors[0], /invalid fermion edge/);
  assert.match(diagram.errors[1], /unknown command/);
}

async function testTikzOrientationParser() {
  const cases = [
    ["tikz horizontal a to b", { axis: "horizontal", from: "a", to: "b", flip: false, angle: 0 }],
    ["tikz horizontal' a to b", { axis: "horizontal", from: "a", to: "b", flip: true, angle: 0 }],
    ["tikz vertical a to b", { axis: "vertical", from: "a", to: "b", flip: false, angle: 90 }],
    ["tikz vertical' a to b", { axis: "vertical", from: "a", to: "b", flip: true, angle: 90 }],
  ];

  cases.forEach(([line, expected]) => {
    const diagram = feynman.parseFeynman(`${line}\nfermion a->b`);

    assert.deepEqual(diagram.errors, []);
    assert.deepEqual(diagram.warnings, []);
    assert.deepEqual(diagram.options.tikzOrientation, expected);
  });

  const deprecated = feynman.parseFeynman("vertical a to b\nfermion a->b");

  assert.deepEqual(deprecated.errors, []);
  assert.match(deprecated.warnings[0], /deprecated/);
  assert.deepEqual(deprecated.options.tikzOrientation, { axis: "vertical", from: "a", to: "b", flip: false, angle: 90 });
}

async function testNativeAlignmentParser() {
  const diagram = feynman.parseFeynman(`
align vertical lepton_vertex struck
align horizontal pql parton struck jet
fermion pql->parton parton->struck struck->jet
`);

  assert.deepEqual(diagram.errors, []);
  assert.deepEqual(diagram.options.alignments, [
    { axis: "vertical", nodes: ["lepton_vertex", "struck"] },
    { axis: "horizontal", nodes: ["pql", "parton", "struck", "jet"] },
  ]);
}

async function testTikzPostLayoutOrientation() {
  const horizontal = feynman.parseFeynman(`
layout layered
tikz horizontal a to b
fermion a->b a->c
`);
  const horizontalPrimed = feynman.parseFeynman(`
layout layered
tikz horizontal' a to b
fermion a->b a->c
`);
  const vertical = feynman.parseFeynman(`
layout layered
tikz vertical a to b
fermion a->b a->c
`);
  const verticalPrimed = feynman.parseFeynman(`
layout layered
tikz vertical' a to b
fermion a->b a->c
`);
  const horizontalLayout = await feynman.layoutFeynman(horizontal);
  const horizontalPrimedLayout = await feynman.layoutFeynman(horizontalPrimed);
  const verticalLayout = await feynman.layoutFeynman(vertical);
  const verticalPrimedLayout = await feynman.layoutFeynman(verticalPrimed);

  assert.ok(Math.abs(angleDegrees(horizontalLayout.positions.a, horizontalLayout.positions.b)) < 0.001);
  assert.ok(Math.abs(angleDegrees(horizontalPrimedLayout.positions.a, horizontalPrimedLayout.positions.b)) < 0.001);
  assert.ok(Math.abs(angleDegrees(verticalLayout.positions.a, verticalLayout.positions.b) - 90) < 0.001);
  assert.ok(Math.abs(angleDegrees(verticalPrimedLayout.positions.a, verticalPrimedLayout.positions.b) - 90) < 0.001);
  assert.ok(
    signedNormalDistance(horizontalLayout.positions.c, horizontalLayout.positions.a, horizontalLayout.positions.b)
      * signedNormalDistance(horizontalPrimedLayout.positions.c, horizontalPrimedLayout.positions.a, horizontalPrimedLayout.positions.b)
      < 0
  );
  assert.ok(
    signedNormalDistance(verticalLayout.positions.c, verticalLayout.positions.a, verticalLayout.positions.b)
      * signedNormalDistance(verticalPrimedLayout.positions.c, verticalPrimedLayout.positions.a, verticalPrimedLayout.positions.b)
      < 0
  );
}

async function testTikzVerticalOrientationFansMixedTerminalPairs() {
  const diagram = feynman.parseFeynman(`
tikz vertical a to b
incoming e positron
outgoing electron positron2
fermion e->a a->electron
photon a->b
anti fermion positron2->b b->positron
label e:e^- positron:e^+ electron:e^- positron2:e^+ a->b:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);
  const { a, b, e, electron, positron, positron2 } = layout.positions;

  assert.deepEqual(diagram.errors, []);
  assert.ok(layout.width < layout.height);
  assert.ok(Math.abs(angleDegrees(a, b) - 90) < 0.001);
  assert.ok(pointDistance(e, a) > 120);
  assert.ok(pointDistance(a, electron) > 120);
  assert.ok(pointDistance(b, positron) > 100);
  assert.ok(pointDistance(positron2, b) > 100);
  assert.ok(acuteLineAngleDegrees(e, a) < 42);
  assert.ok(acuteLineAngleDegrees(a, electron) < 42);
  assert.ok(e.y < a.y);
  assert.ok(electron.y < a.y);
  assert.ok(e.y < positron.y);
  assert.ok(electron.y < positron2.y);
  assert.ok(e.x < a.x);
  assert.ok(electron.x > a.x);
  assert.ok(positron.x < b.x);
  assert.ok(positron2.x > b.x);
  assert.ok(signedNormalDistance(e, a, b) * signedNormalDistance(electron, a, b) < 0);
  assert.ok(signedNormalDistance(positron, a, b) * signedNormalDistance(positron2, a, b) < 0);
}

async function testHorizontalOrientationKeepsAnnihilationFans() {
  const diagram = feynman.parseFeynman(`
tikz horizontal ann to prod
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\\mu^+ mu_minus:\\mu^- ann->prod:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);
  const ann = layout.positions.ann;
  const prod = layout.positions.prod;
  const incomingCenter = (layout.positions.e_minus.y + layout.positions.e_plus.y) / 2;
  const outgoingCenter = (layout.positions.mu_minus.y + layout.positions.mu_plus.y) / 2;

  assert.deepEqual(diagram.errors, []);
  assert.ok(Math.abs(angleDegrees(ann, prod)) < 0.001);
  assert.ok(Math.abs(ann.y - incomingCenter) < 0.001);
  assert.ok(Math.abs(prod.y - outgoingCenter) < 0.001);
  assert.ok(Math.abs(layout.positions.e_plus.y - ann.y) > 40);
  assert.ok(Math.abs(layout.positions.mu_plus.y - prod.y) > 40);
  assert.ok(layout.positions.e_minus.y < ann.y);
  assert.ok(layout.positions.e_plus.y > ann.y);
  assert.ok(layout.positions.mu_plus.y < prod.y);
  assert.ok(layout.positions.mu_minus.y > prod.y);
}

async function testDefaultSpringKeepsAnnihilationFans() {
  const diagram = feynman.parseFeynman(`
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\\mu^+ mu_minus:\\mu^- ann->prod:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);
  const ann = layout.positions.ann;
  const prod = layout.positions.prod;
  const incomingCenter = (layout.positions.e_minus.y + layout.positions.e_plus.y) / 2;
  const outgoingCenter = (layout.positions.mu_minus.y + layout.positions.mu_plus.y) / 2;

  assert.deepEqual(diagram.errors, []);
  assert.equal(layout.options.layout, "spring");
  assert.ok(Math.abs(angleDegrees(ann, prod)) < 0.001);
  assert.ok(Math.abs(ann.y - incomingCenter) < 0.001);
  assert.ok(Math.abs(prod.y - outgoingCenter) < 0.001);
  assert.ok(layout.positions.e_minus.y > ann.y);
  assert.ok(layout.positions.e_plus.y < ann.y);
  assert.ok(layout.positions.mu_plus.y < prod.y);
  assert.ok(layout.positions.mu_minus.y > prod.y);
}

async function testUnclassifiedExternalTerminalsDoNotInventProcessRoles() {
  const diagram = feynman.parseFeynman(`
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\\mu^+ mu_minus:\\mu^- ann->prod:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.deepEqual(diagram.incoming, []);
  assert.deepEqual(diagram.outgoing, []);
  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(layout.analysis.topology.detectedTopology, "tree");
  ["e_minus", "e_plus", "mu_plus", "mu_minus"].forEach((node) => {
    assert.equal(layout.positions[node].kind, "unclassified");
  });
  assert.equal(layout.positions.ann.kind, "internal");
  assert.equal(layout.positions.prod.kind, "internal");
}

async function testMilestoneThreeCSymmetricUnclassifiedAnnihilationTree() {
  const diagram = feynman.parseFeynman(`
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\\mu^+ mu_minus:\\mu^- ann->prod:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);
  const ann = layout.positions.ann;
  const prod = layout.positions.prod;

  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.kind, "twoCenterTree");
  assert.ok(Math.abs(ann.y - prod.y) < 0.001);
  assert.ok(ann.x < prod.x);
  assert.ok(layout.positions.e_minus.x < ann.x);
  assert.ok(layout.positions.e_plus.x < ann.x);
  assert.ok(prod.x < layout.positions.mu_plus.x);
  assert.ok(prod.x < layout.positions.mu_minus.x);
  assert.ok(Math.abs(layout.positions.e_minus.x - layout.options.marginX) < 0.001);
  assert.ok(Math.abs(layout.positions.mu_plus.x - (layout.width - layout.options.marginX)) < 0.001);
  assert.ok(layout.positions.e_minus.y < ann.y);
  assert.ok(layout.positions.e_plus.y > ann.y);
  assert.ok(layout.positions.mu_plus.y < prod.y);
  assert.ok(layout.positions.mu_minus.y > prod.y);
  assert.ok(Math.abs(pointDistance(layout.positions.e_minus, ann) - pointDistance(layout.positions.e_plus, ann)) < 0.001);
  assert.ok(Math.abs(pointDistance(layout.positions.mu_plus, prod) - pointDistance(layout.positions.mu_minus, prod)) < 0.001);
  assertFiniteScore(layout);
}

async function testMilestoneThreeCExplicitRoleAnnihilationStillProcess() {
  const diagram = feynman.parseFeynman(`
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\\mu^+ mu_minus:\\mu^- ann->prod:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(layout.analysis.orientation.mode, "process");
  assert.equal(diagnostic.data.applicable, false);
  assert.ok(layout.positions.e_minus.x < layout.positions.ann.x);
  assert.ok(layout.positions.prod.x < layout.positions.mu_plus.x);
}

async function testMilestoneThreeCSymmetricUnclassifiedGammaLoop() {
  const diagram = feynman.parseFeynman(`
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);
  const a = layout.positions.a;
  const b = layout.positions.b;

  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(layout.analysis.topology.detectedTopology, "selfEnergy");
  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.kind, "twoPointLoop");
  assert.ok(Math.abs(a.y - b.y) < 0.001);
  assert.ok(layout.positions.gamma1.x < a.x);
  assert.ok(b.x < layout.positions.gamma2.x);
  assert.ok(Math.abs(layout.positions.gamma1.x - layout.options.marginX) < 0.001);
  assert.ok(Math.abs(layout.positions.gamma2.x - (layout.width - layout.options.marginX)) < 0.001);
  assert.ok(Math.abs(layout.positions.gamma1.y - a.y) < 0.001);
  assert.ok(Math.abs(layout.positions.gamma2.y - b.y) < 0.001);
  assert.ok(Math.abs(pointDistance(layout.positions.gamma1, a) - pointDistance(layout.positions.gamma2, b)) < 0.001);
  assertFiniteScore(layout);
}

async function testMilestoneThreeCNoRoleGammaLoopMatchesExplicitRoleGeometry() {
  const noRole = feynman.parseFeynman(`
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`);
  const withRole = feynman.parseFeynman(`
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`);
  const noRoleLayout = await feynman.layoutFeynman(noRole);
  const withRoleLayout = await feynman.layoutFeynman(withRole);

  ["gamma1", "gamma2", "a", "b"].forEach((node) => {
    const left = noRoleLayout.positions[node];
    const right = withRoleLayout.positions[node];

    assert.ok(Math.abs(left.x - right.x) < 3, `${node}.x should match explicit-role layout`);
    assert.ok(Math.abs(left.y - right.y) < 3, `${node}.y should match explicit-role layout`);
  });
}

async function testMilestoneThreeCExplicitRoleGammaLoopStillProcess() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(layout.analysis.orientation.mode, "process");
  assert.equal(diagnostic.data.applicable, false);
  assert.equal(layout.positions.gamma1.kind, "incoming");
  assert.equal(layout.positions.gamma2.kind, "outgoing");
  assert.ok(layout.positions.gamma1.x < layout.positions.a.x);
  assert.ok(layout.positions.b.x < layout.positions.gamma2.x);
}

async function testMilestoneThreeCFermionArrowsDoNotChangeSymmetricRefinement() {
  const treeForward = feynman.parseFeynman(`
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
`);
  const treeReverse = feynman.parseFeynman(`
anti fermion e_minus->ann
fermion e_plus->ann
photon ann->prod
fermion prod->mu_plus
anti fermion prod->mu_minus
`);
  const loopForward = feynman.parseFeynman(`
photon gamma1->a b->gamma2
fermion a->b[half left] b->a[half left]
`);
  const loopReverse = feynman.parseFeynman(`
photon gamma1->a b->gamma2
anti fermion a->b[half left] fermion b->a[half left]
`);
  const treeForwardLayout = await feynman.layoutFeynman(treeForward);
  const treeReverseLayout = await feynman.layoutFeynman(treeReverse);
  const loopForwardLayout = await feynman.layoutFeynman(loopForward);
  const loopReverseLayout = await feynman.layoutFeynman(loopReverse);

  assert.deepEqual(positionSignature(treeForwardLayout), positionSignature(treeReverseLayout));
  assert.deepEqual(positionSignature(loopForwardLayout), positionSignature(loopReverseLayout));
}

async function testMilestoneThreeCMomentumDoesNotChangeSymmetricRefinement() {
  const withoutMomentum = feynman.parseFeynman(`
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
`);
  const withMomentum = feynman.parseFeynman(`
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum=k]
anti fermion prod->mu_plus
fermion prod->mu_minus[momentum'=p]
`);
  const withoutLayout = await feynman.layoutFeynman(withoutMomentum);
  const withLayout = await feynman.layoutFeynman(withMomentum);

  assert.deepEqual(positionSignature(withoutLayout), positionSignature(withLayout));
}

async function testMilestoneThreeCManualPositionsPreserved() {
  const diagram = feynman.parseFeynman(`
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
position e_minus 42 88
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(layout.positions.e_minus.x, 42);
  assert.equal(layout.positions.e_minus.y, 88);
}

async function testMilestoneThreeCExplicitCurveAndLabelSidePreserved() {
  const diagram = feynman.parseFeynman(`
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.edges[2].curve.side, "left");
  assert.equal(diagram.edges[2].labelSide, "left");
  assert.equal(diagram.edges[3].labelSide, "right");
  assert.equal(diagram.edges[3].labelPlacement, "momentum-prime");
  assert.ok(symmetricUnclassifiedDiagnostic(layout).data.applicable);
}

async function testMilestoneThreeCOneToOneTwoCenterUsesLeftRightPlacement() {
  const diagram = feynman.parseFeynman(`
fermion root->a root->b b->c
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.kind, "twoCenterTree");
  assert.ok(Math.abs(layout.positions.a.x - layout.options.marginX) < 0.001);
  assert.ok(Math.abs(layout.positions.c.x - (layout.width - layout.options.marginX)) < 0.001);
  assert.ok(layout.positions.a.x < layout.positions.root.x);
  assert.ok(layout.positions.root.x < layout.positions.b.x);
  assert.ok(layout.positions.b.x < layout.positions.c.x);
}

async function testMilestoneThreeCThreeToThreeTwoCenterUsesLeftRightPlacement() {
  const diagram = feynman.parseFeynman(`
fermion l1->ann l2->ann l3->ann
photon ann->prod
fermion prod->r1 prod->r2 prod->r3
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.kind, "twoCenterTree");
  assert.equal(diagnostic.data.leftLeaves.length, 3);
  assert.equal(diagnostic.data.rightLeaves.length, 3);
  assert.equal(diagnostic.data.centerExternal, null);
  ["l1", "l2", "l3"].forEach((node) => {
    assert.ok(Math.abs(layout.positions[node].x - layout.options.marginX) < 0.001);
  });
  ["r1", "r2", "r3"].forEach((node) => {
    assert.ok(Math.abs(layout.positions[node].x - (layout.width - layout.options.marginX)) < 0.001);
  });
}

async function testMilestoneThreeCOddTwoCenterPlacesMedianAtCenter() {
  const diagram = feynman.parseFeynman(`
fermion root->a root->b b->c b->d
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.kind, "twoCenterTree");
  assert.equal(diagnostic.data.centerExternal, "c");
  assert.equal(layout.positions.c.x, layout.width / 2);
  assert.equal(layout.positions.c.y, layout.height - layout.options.marginY);
  assert.ok(Math.abs(layout.positions.a.x - layout.options.marginX) < 0.001);
  assert.ok(Math.abs(layout.positions.d.x - (layout.width - layout.options.marginX)) < 0.001);
}

async function testMilestoneThreeCOddTotalPlacesMedianAtCenter() {
  const diagram = feynman.parseFeynman(`
fermion l1->ann l2->ann l3->ann
photon ann->prod
fermion prod->r1 prod->r2 prod->r3
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.centerExternal, null);
  ["l1", "l2", "l3"].forEach((node) => {
    assert.ok(Math.abs(layout.positions[node].x - layout.options.marginX) < 0.001);
  });
  ["r1", "r2", "r3"].forEach((node) => {
    assert.ok(Math.abs(layout.positions[node].x - (layout.width - layout.options.marginX)) < 0.001);
  });
}

async function testMilestoneThreeCUnequalTwoCenterSkipsWhenImbalanced() {
  const diagram = feynman.parseFeynman(`
fermion root->a root->b b->c b->d b->e
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(diagnostic.data.applicable, false);
}

async function testMilestoneThreeCAsymmetricTreeSkipsSymmetricRefinement() {
  await testMilestoneThreeCUnequalTwoCenterSkipsWhenImbalanced();
}

async function testMilestoneThreeCSymmetricRefinementScoreFieldsAndDiagnostics() {
  const treeLayout = await feynman.layoutFeynman(feynman.parseFeynman(`
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
`));
  const loopLayout = await feynman.layoutFeynman(feynman.parseFeynman(`
photon gamma1->a b->gamma2
fermion a->b[half left] b->a[half left]
`));

  [
    "symmetricUnclassifiedBranchLengths",
    "symmetricUnclassifiedBranchAngles",
    "symmetricUnclassifiedMirrorDeviation",
    "symmetricUnclassifiedCenteredInteraction",
    "symmetricUnclassifiedExternalLegBalance",
  ].forEach((field) => {
    assert.ok(field in treeLayout.score.breakdown, `${field} should exist`);
    assert.ok(field in loopLayout.score.breakdown, `${field} should exist`);
  });

  assert.ok(symmetricUnclassifiedDiagnostic(treeLayout).data.applicable);
  assert.ok(symmetricUnclassifiedDiagnostic(loopLayout).data.applicable);
  assert.match(symmetricUnclassifiedDiagnostic(treeLayout).message, /Applied symmetric unclassified refinement/);
  assert.match(symmetricUnclassifiedDiagnostic(loopLayout).message, /Applied symmetric unclassified refinement/);
  assertFiniteScore(treeLayout);
  assertFiniteScore(loopLayout);
}

async function testDeclaredExternalTerminalsDoNotClassifyOtherLeaves() {
  const diagram = feynman.parseFeynman(`
incoming mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.deepEqual(diagram.outgoing, []);
  assert.equal(layout.positions.mu_plus.kind, "incoming");
  assert.equal(layout.positions.mu_minus.kind, "incoming");
  assert.equal(layout.positions.e_minus.kind, "unclassified");
  assert.equal(layout.positions.e_plus.kind, "unclassified");
  assert.equal(layout.analysis.orientation.mode, "symmetric");
}

async function testMilestoneOneExplicitDecayProcessMode() {
  const diagram = feynman.parseFeynman(`
incoming h
outgoing a b
scalar h->v v->a v->b
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "decay");
  assert.equal(layout.analysis.orientation.mode, "process");
  assert.ok(layout.positions.h.x < layout.positions.v.x);
  assert.ok(layout.positions.v.x < layout.positions.a.x);
  assert.ok(layout.positions.v.x < layout.positions.b.x);
  assert.ok(layout.debug.elkGraph);
  assert.ok(layout.debug.inferredPorts.h.length > 0);
}

async function testMilestoneOneExplicitTwoToTwoProcessMode() {
  const diagram = feynman.parseFeynman(`
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });

  assert.equal(layout.analysis.topology.detectedTopology, "scattering");
  assert.equal(layout.analysis.orientation.mode, "process");
  assert.deepEqual(layout.analysis.orientation.evidence, ["explicit incoming and outgoing external roles"]);
  assert.ok(layout.positions.e_minus.x < layout.positions.ann.x);
  assert.ok(layout.positions.prod.x < layout.positions.mu_plus.x);
  assert.ok(layout.debug.compiledElkGraph);
  assert.ok(layout.debug.constraints.ports.ann.length >= 2);
}

async function testFermionFlowConservationDetectsExternalFermionsAndCustomGraphs() {
  const conserving = feynman.parseFeynman(`
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
`);
  const violating = feynman.parseFeynman(`
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus
fermion prod->mu_minus
`);

  const conservingLayout = await feynman.layoutFeynman(conserving);
  const violatingLayout = await feynman.layoutFeynman(violating);
  const conservingFlow = conservingLayout.analysis.topology.fermionFlow;
  const violatingFlow = violatingLayout.analysis.topology.fermionFlow;

  assert.equal(conservingLayout.analysis.topology.detectedTopology, "scattering");
  assert.equal(conservingFlow.conserved, true);
  assert.equal(conservingFlow.customGraph, false);
  assert.equal(conservingFlow.violations.length, 0);
  assert.equal(conservingFlow.externalFermionCount, 4);

  assert.equal(violatingLayout.analysis.topology.detectedTopology, "scattering");
  assert.equal(violatingFlow.conserved, false);
  assert.equal(violatingFlow.customGraph, true);
  assert.ok(violatingFlow.violations.some((violation) => violation.vertex === "ann"));

  const limitationCodes = violatingLayout.diagnostics
    .filter((diagnostic) => diagnostic.stage === "topology")
    .map((diagnostic) => diagnostic.data?.code);
  assert.ok(limitationCodes.includes("fermion-number-not-conserved"));
}

async function testFermionFlowContactStarStaysRecognized() {
  const diagram = feynman.parseFeynman(`
fermion a->v b->v c->v d->v
`);
  const layout = await feynman.layoutFeynman(diagram);
  const flow = layout.analysis.topology.fermionFlow;

  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(flow.conserved, false);
  assert.equal(flow.customGraph, false);
  assert.equal(flow.externalFermionCount, 4);
}

async function testMilestoneOneSymmetricUnclassifiedContact() {
  const diagram = feynman.parseFeynman(`
fermion a->v b->v c->v d->v
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const center = layout.positions.v;
  const distances = ["a", "b", "c", "d"].map((node) => pointDistance(layout.positions[node], center));

  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(layout.analysis.orientation.mode, "symmetric");
  ["a", "b", "c", "d"].forEach((node) => {
    assert.equal(layout.positions[node].kind, "unclassified");
  });
  assert.ok(Math.max(...distances) - Math.min(...distances) < 0.001);
  assertContactStarUniform(layout, "v", ["a", "b", "c", "d"]);
  assert.ok(layout.positions.a.x < center.x);
  assert.ok(layout.positions.b.x > center.x);
  assert.ok(layout.positions.c.y > center.y);
  assert.ok(layout.positions.d.x < center.x);
}

async function testMilestoneThreeEOddContactStarUsesReflectionAxis() {
  const source = `
fermion l1->hub1 l2->hub1 l3->hub1
fermion hub1->r2 hub1->r3
label l1:a_1 l2:a_2 l3:a_3 r2:b_2 r3:b_3
vertex hub1:blob
`;
  const diagram = feynman.parseFeynman(source);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const rerun = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const leaves = ["l1", "l2", "l3", "r2", "r3"];
  const center = layout.positions.hub1;

  assert.deepEqual(diagram.errors, []);
  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.deepEqual(layout.analysis.externalOrdering.unclassified.map((entry) => entry.id), leaves);
  leaves.forEach((node) => {
    assert.equal(layout.positions[node].kind, "unclassified");
  });
  assert.ok(approximatelyEqual(center.x, layout.width / 2));
  assert.ok(approximatelyEqual(center.y, layout.height / 2));
  assertContactStarUniform(layout, "hub1", leaves);
  assert.ok(approximatelyEqual(layout.positions.l3.x, center.x));
  assert.ok(layout.positions.l3.y < center.y);
  assertMirroredAcrossVertical(center, layout.positions.l2, layout.positions.r2);
  assertMirroredAcrossVertical(center, layout.positions.l1, layout.positions.r3);
  assertFiniteLabelPlacement(layout);
  assertFiniteScore(layout);
  assert.deepEqual(positionSignature(layout), positionSignature(rerun));
}

async function testMilestoneThreeESixLegContactStarIsUniformAndDeterministic() {
  const source = `
fermion a->v b->v c->v d->v e->v f->v
`;
  const layout = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const rerun = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const center = layout.positions.v;

  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assertContactStarUniform(layout, "v", ["a", "b", "c", "d", "e", "f"]);
  assert.ok(approximatelyEqual(layout.positions.c.y, center.y));
  assert.ok(layout.positions.c.x > center.x);
  assert.ok(approximatelyEqual(layout.positions.f.y, center.y));
  assert.ok(layout.positions.f.x < center.x);
  assert.deepEqual(positionSignature(layout), positionSignature(rerun));
}

async function testMilestoneThreeEExplicitRolesKeepProcessContactLayout() {
  const diagram = feynman.parseFeynman(`
incoming l1 l2 l3
outgoing r2 r3
fermion l1->hub1 l2->hub1 l3->hub1
fermion hub1->r2 hub1->r3
vertex hub1:blob
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.deepEqual(diagram.errors, []);
  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(layout.analysis.orientation.mode, "process");
  ["l1", "l2", "l3"].forEach((node) => {
    assert.equal(layout.positions[node].kind, "incoming");
    assert.ok(layout.positions[node].x < layout.positions.hub1.x);
  });
  ["r2", "r3"].forEach((node) => {
    assert.equal(layout.positions[node].kind, "outgoing");
    assert.ok(layout.positions.hub1.x < layout.positions[node].x);
  });
}

async function testMilestoneThreeEContactArrowsAndEdgeSpellingDoNotInferProcess() {
  const forward = `
fermion l1->hub1 l2->hub1 l3->hub1
fermion hub1->r2 hub1->r3
vertex hub1:blob
`;
  const reversedArrows = `
anti fermion l1->hub1 l2->hub1 l3->hub1
anti fermion hub1->r2 hub1->r3
vertex hub1:blob
`;
  const reversedSpelling = `
fermion hub1->l1 hub1->l2 hub1->l3
fermion r2->hub1 r3->hub1
vertex hub1:blob
`;
  const forwardLayout = await feynman.layoutFeynman(feynman.parseFeynman(forward));
  const arrowLayout = await feynman.layoutFeynman(feynman.parseFeynman(reversedArrows));
  const spellingLayout = await feynman.layoutFeynman(feynman.parseFeynman(reversedSpelling));

  [forwardLayout, arrowLayout, spellingLayout].forEach((layout) => {
    assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
    assert.equal(layout.analysis.orientation.mode, "symmetric");
    ["l1", "l2", "l3", "r2", "r3"].forEach((node) => {
      assert.equal(layout.positions[node].kind, "unclassified");
    });
  });
  assert.deepEqual(positionSignature(forwardLayout), positionSignature(arrowLayout));
  assert.deepEqual(positionSignature(forwardLayout), positionSignature(spellingLayout));
}

async function testMilestoneThreeEManualContactCenterPreserved() {
  const diagram = feynman.parseFeynman(`
position hub1 230 150
fermion l1->hub1 l2->hub1 l3->hub1
fermion hub1->r2 hub1->r3
label hub1:C l1:a_1 l2:a_2 l3:a_3 r2:b_2 r3:b_3
vertex hub1:disk
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const center = layout.positions.hub1;

  assert.deepEqual(diagram.errors, []);
  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(center.x, 230);
  assert.equal(center.y, 150);
  assertContactStarUniform(layout, "hub1", ["l1", "l2", "l3", "r2", "r3"]);
  assert.ok(approximatelyEqual(layout.positions.l3.x, center.x));
  assert.ok(layout.positions.l3.y < center.y);
  assert.ok(labelPlacementEntry(layout, "node:hub1"));
  assertFiniteLabelPlacement(layout);
  assertFiniteScore(layout);
}

async function testMilestoneThreeETikzVerticalRotatesContactStarWithoutSpringFallback() {
  const diagram = feynman.parseFeynman(`
tikz vertical l3 to hub1
fermion l1->hub1 l2->hub1 l3->hub1 l4->hub1 l5->hub1
fermion hub1->r2 hub1->r3
label l1:a_1 l2:a_2 l3:a_3 r2:b_2 r3:b_3
vertex hub1:blob
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const leaves = ["l1", "l2", "l3", "l4", "l5", "r2", "r3"];
  const center = layout.positions.hub1;

  assert.deepEqual(diagram.errors, []);
  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(layout.analysis.orientation.mode, "fixed");
  assert.deepEqual(layout.analysis.orientation.evidence, ["explicit TikZ-Feynman orientation command"]);
  leaves.forEach((node) => {
    assert.equal(layout.positions[node].kind, "unclassified");
  });
  assert.ok(approximatelyEqual(layout.positions.l3.x, center.x));
  assert.ok(layout.positions.l3.y < center.y);
  assert.ok(approximatelyEqual(Math.abs(angleDegrees(layout.positions.l3, center)), 90));
  assertContactStarUniform(layout, "hub1", leaves);
  assertFiniteScore(layout);
}

async function testMilestoneOneAsymmetricUnclassifiedTree() {
  const diagram = feynman.parseFeynman(`
fermion root->a root->b b->c b->d
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(layout.analysis.topology.detectedTopology, "tree");
  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.centerExternal, "c");
}

async function testMilestoneOneFermionFlowDoesNotControlLayoutDirection() {
  const forward = feynman.parseFeynman(`
incoming a
outgoing b
fermion a->v v->b
`);
  const reverse = feynman.parseFeynman(`
incoming a
outgoing b
anti fermion a->v
fermion v->b
`);
  const forwardLayout = await feynman.layoutFeynman(forward);
  const reverseLayout = await feynman.layoutFeynman(reverse);

  assert.equal(forwardLayout.positions.a.x, reverseLayout.positions.a.x);
  assert.equal(forwardLayout.positions.v.x, reverseLayout.positions.v.x);
  assert.equal(forwardLayout.positions.b.x, reverseLayout.positions.b.x);
  assert.equal(forwardLayout.positions.a.kind, "incoming");
  assert.equal(reverse.edges[0].arrow, "reverse");
}

async function testMilestoneOneValidationAndDeterminism() {
  const invalid = feynman.parseFeynman(`
incoming a
outgoing a
fermion a->v
`);
  const invalidLayout = await feynman.layoutFeynman(invalid);

  assert.ok(invalidLayout.diagnostics.some((diagnostic) => (
    diagnostic.severity === "error"
    && /both incoming and outgoing/.test(diagnostic.message)
  )));

  const source = `
fermion a->v b->v c->v d->v
`;
  const first = await feynman.layoutFeynman(feynman.parseFeynman(source));
  const second = await feynman.layoutFeynman(feynman.parseFeynman(source));

  assert.deepEqual(positionSignature(first), positionSignature(second));
}

async function testMilestoneTwoDeclaredProcessExternalOrder() {
  const diagram = feynman.parseFeynman(`
layout layered
incoming i2 i1
outgoing o2 o1
fermion i2->ann i1->ann
photon ann->prod
fermion prod->o2 prod->o1
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });

  assert.equal(layout.analysis.orientation.mode, "process");
  assert.deepEqual(
    layout.analysis.externalOrdering.incoming.map((entry) => entry.id),
    ["i2", "i1"]
  );
  assert.deepEqual(
    layout.analysis.externalOrdering.outgoing.map((entry) => entry.id),
    ["o2", "o1"]
  );
  assert.deepEqual(
    layout.analysis.externalOrdering.all.map((entry) => entry.id),
    ["i2", "i1", "o2", "o1"]
  );
  assert.ok(layout.positions.i2.y > layout.positions.i1.y);
  assert.ok(layout.positions.o2.y < layout.positions.o1.y);
  assert.equal(layout.score.breakdown.externalAlignment, 0);
}

async function testDeclaredProcessExternalOrderUsesCyclicBoundaryTraversal() {
  const diagram = feynman.parseFeynman(`
options width=330 height=520
tikz vertical upper to lower
incoming e_plus e_minus
outgoing e_plus_out e_minus_out
fermion e_minus->upper upper->e_minus_out
photon upper->lower[edge label=\\gamma]
anti fermion e_plus_out->lower lower->e_plus
label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });

  assert.deepEqual(diagram.errors, []);
  assert.deepEqual(
    layout.analysis.externalOrdering.incoming.map((entry) => entry.id),
    ["e_plus", "e_minus"]
  );
  assert.deepEqual(
    layout.analysis.externalOrdering.outgoing.map((entry) => entry.id),
    ["e_plus_out", "e_minus_out"]
  );
  assert.deepEqual(
    layout.analysis.externalOrdering.all.map((entry) => entry.id),
    ["e_plus", "e_minus", "e_plus_out", "e_minus_out"]
  );
  assert.ok(layout.positions.e_plus.y < layout.positions.e_minus.y);
  assert.ok(layout.positions.e_plus_out.y < layout.positions.e_minus_out.y);
  assert.ok(layout.positions.e_plus.y < layout.positions.lower.y);
  assert.ok(layout.positions.e_minus.y > layout.positions.upper.y);
  assert.ok(layout.positions.e_plus_out.y < layout.positions.lower.y);
  assert.ok(layout.positions.e_minus_out.y > layout.positions.upper.y);
  assert.equal(layout.score.breakdown.externalAlignment, 0);
}

async function testMilestoneTwoFermionArrowDoesNotMirrorProcessLayout() {
  const forward = feynman.parseFeynman(`
layout layered
incoming i1 i2
outgoing o1 o2
fermion i1->ann i2->ann
photon ann->prod
fermion prod->o1 prod->o2
`);
  const reversed = feynman.parseFeynman(`
layout layered
incoming i1 i2
outgoing o1 o2
anti fermion i1->ann i2->ann
photon ann->prod
fermion prod->o1 prod->o2
`);
  const forwardLayout = await feynman.layoutFeynman(forward);
  const reversedLayout = await feynman.layoutFeynman(reversed);

  assert.deepEqual(positionSignature(forwardLayout), positionSignature(reversedLayout));
  assert.equal(reversed.edges[0].arrow, "reverse");
  assert.deepEqual(reversed.incoming, ["i1", "i2"]);
  assert.deepEqual(reversed.outgoing, ["o1", "o2"]);
}

async function testMilestoneTwoMomentumDirectionDoesNotMoveLayout() {
  const forward = feynman.parseFeynman(`
layout layered
incoming a
outgoing b
fermion a->v1
photon v1->v2[momentum=k]
fermion v2->b
`);
  const reversed = feynman.parseFeynman(`
layout layered
incoming a
outgoing b
fermion a->v1
photon v1->v2[reversed momentum=k]
fermion v2->b
`);
  const forwardLayout = await feynman.layoutFeynman(forward);
  const reversedLayout = await feynman.layoutFeynman(reversed);

  assert.deepEqual(positionSignature(forwardLayout), positionSignature(reversedLayout));
  assert.equal(forward.edges[1].momentumDirection, "forward");
  assert.equal(reversed.edges[1].momentumDirection, "reverse");
}

async function testMilestoneTwoLayeredPortDiagnosticsAreDeterministic() {
  const diagram = feynman.parseFeynman(`
layout layered
incoming inA inB
outgoing outA outB
fermion v1->inA inB->v1
photon v1->v2
fermion outA->v2 v2->outB
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const ports = layout.debug.portConstraints.constraints;
  const portDiagnostic = layout.diagnostics.find((diagnostic) => diagnostic.stage === "port-constraints");

  assert.equal(layout.debug.portConstraints.applied, true);
  assert.equal(layout.debug.portConstraints.direction, "RIGHT");
  assert.equal(portDiagnostic.data.applied, true);
  assert.deepEqual(ports.inA.map((port) => port.side), ["EAST"]);
  assert.deepEqual(ports.inB.map((port) => port.side), ["EAST"]);
  assert.deepEqual(ports.outA.map((port) => port.side), ["WEST"]);
  assert.deepEqual(ports.outB.map((port) => port.side), ["WEST"]);
  assert.deepEqual(
    ports.v1.filter((port) => port.side === "WEST").map((port) => port.order),
    [0, 1]
  );
  assert.deepEqual(
    ports.v2.filter((port) => port.side === "EAST").map((port) => port.order),
    [1, 2]
  );
}

async function testMilestoneTwoSelfEnergyBubblePlacesParallelArcsOppositeSides() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming p
outgoing p2
fermion p->a b->p2
photon a->b a->b
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const a = layout.positions.a;
  const b = layout.positions.b;
  const firstMidpoint = cubicMidpoint(feynman.edgePath(diagram.edges[2], a, b));
  const secondMidpoint = cubicMidpoint(feynman.edgePath(diagram.edges[3], a, b));
  const firstDistance = signedNormalDistance(firstMidpoint, a, b);
  const secondDistance = signedNormalDistance(secondMidpoint, a, b);

  assert.equal(layout.analysis.topology.detectedTopology, "selfEnergy");
  assert.equal(layout.analysis.topology.parallelEdgeGroups.length, 1);
  assert.equal(layout.analysis.topology.selfEnergyBubbles.length, 1);
  assert.equal(layout.analysis.topology.loopCandidate, null);
  assert.equal(loopCandidateDiagnostic(layout), undefined);
  assert.equal(diagram.edges[2].autoParallelCurve, true);
  assert.equal(diagram.edges[3].autoParallelCurve, true);
  assert.ok(firstDistance * secondDistance < 0);
}

async function testMilestoneTwoParallelPropagatorsAreSeparatedAndDeterministic() {
  const source = `
layout spring
incoming p
outgoing p2
fermion p->a b->p2
photon a->b a->b
`;
  const firstDiagram = feynman.parseFeynman(source);
  const secondDiagram = feynman.parseFeynman(source);
  const first = await feynman.layoutFeynman(firstDiagram);
  const second = await feynman.layoutFeynman(secondDiagram);
  const firstCurves = firstDiagram.edges.slice(2).map((edge) => edge.curve);
  const secondCurves = secondDiagram.edges.slice(2).map((edge) => edge.curve);

  assert.deepEqual(firstCurves, secondCurves);
  assert.deepEqual(positionSignature(first), positionSignature(second));
  assert.notDeepEqual(firstCurves[0], firstCurves[1]);
}

async function testMilestoneTwoScoreBreakdownIsFinite() {
  const diagram = feynman.parseFeynman(`
layout layered
incoming a
outgoing b
fermion a->v v->b
`);
  const layout = await feynman.layoutFeynman(diagram);
  const fields = [
    "missingCoordinates",
    "nonFiniteCoordinates",
    "externalBoundaryRoleViolations",
    "parallelEdgeOverlap",
    "externalAlignment",
    "symmetry",
    "edgeOverlap",
    "loopReadability",
    "loopSymmetry",
    "externalLegStraightness",
    "nodeLabelOverlap",
    "edgeLabelOverlap",
    "labelLabelOverlap",
    "labelsInsideLoops",
    "momentumLoopCollision",
  ];

  assert.equal(typeof layout.score.total, "number");
  assert.ok(Number.isFinite(layout.score.total));
  fields.forEach((field) => {
    assert.equal(typeof layout.score.breakdown[field], "number");
    assert.ok(Number.isFinite(layout.score.breakdown[field]), `${field} should be finite`);
  });
  assert.ok(layout.diagnostics.some((diagnostic) => diagnostic.stage === "score"));
}

async function testMilestoneThreeTriangleLoopCandidateLayout() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b b->c c->a
scalar c->h
label g1:g g2:g h:H
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const loopPoints = ["a", "b", "c"].map((node) => layout.positions[node]);
  const diagnostic = loopCandidateDiagnostic(layout);

  assert.deepEqual(diagram.errors, []);
  assert.deepEqual(diagram.manualPositions, {});
  assert.equal(layout.analysis.topology.detectedTopology, "triangleLoop");
  assert.equal(layout.analysis.topology.loopCandidate.type, "triangle");
  assert.equal(layout.loopCandidate.type, "triangle");
  assert.equal(diagnostic.data.id, layout.loopCandidate.id);
  assert.equal(layout.debug.loopCandidates.selected.id, layout.loopCandidate.id);
  assert.ok(Math.abs(polygonArea(loopPoints)) > 4000);
  assert.equal(layout.positions.g1.x, layout.options.marginX);
  assert.equal(layout.positions.h.x, layout.width - layout.options.marginX);
  assert.ok(layout.positions.g1.y > layout.positions.g2.y);
  assert.ok(Math.abs(layout.positions.h.y - layout.positions.c.y) < 0.001);
  assertFiniteScore(layout);
}

async function testMilestoneThreeBoxLoopCandidateLayout() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming i1 i2
outgoing o1 o2
fermion i1->a i2->d
fermion a->b b->c c->d d->a
fermion b->o1 c->o2
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const loopPoints = ["a", "b", "c", "d"].map((node) => layout.positions[node]);

  assert.deepEqual(diagram.errors, []);
  assert.deepEqual(diagram.manualPositions, {});
  assert.equal(layout.analysis.topology.detectedTopology, "boxLoop");
  assert.equal(layout.analysis.topology.loopCandidate.type, "box");
  assert.equal(layout.loopCandidate.type, "box");
  assert.ok(loopCandidateDiagnostic(layout));
  assert.ok(Math.abs(polygonArea(loopPoints)) > 7000);
  assert.ok(layout.positions.i1.x < layout.positions.a.x);
  assert.ok(layout.positions.i2.x < layout.positions.d.x);
  assert.ok(layout.positions.b.x < layout.positions.o1.x);
  assert.ok(layout.positions.c.x < layout.positions.o2.x);
  assert.ok(layout.positions.i1.y > layout.positions.i2.y);
  assert.ok(layout.positions.o1.y < layout.positions.o2.y);
  assertFiniteScore(layout);
}

async function testMilestoneThreeTadpoleLoopCandidateLayout() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming p
outgoing p2
scalar p->v v->p2
scalar v->v[momentum=k]
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const path = feynman.edgePath(diagram.edges[2], layout.positions.v, layout.positions.v);
  const numbers = pathNumbers(path);

  assert.deepEqual(diagram.errors, []);
  assert.deepEqual(diagram.manualPositions, {});
  assert.equal(layout.analysis.topology.detectedTopology, "tadpole");
  assert.equal(layout.analysis.topology.loopCandidate.type, "tadpole");
  assert.equal(layout.loopCandidate.type, "tadpole");
  assert.equal(diagram.edges[2].autoLoopCurve, true);
  assert.equal(diagram.edges[2].curve.shape, "self-loop");
  assert.match(path, /^M .* C /);
  assert.ok(new Set(numbers.map((value) => value.toFixed(3))).size > 2);
  assert.equal(layout.positions.p.y, layout.positions.v.y);
  assert.equal(layout.positions.p2.y, layout.positions.v.y);
  assertFiniteScore(layout);
}

async function testMilestoneThreeLoopCandidateSelectionIsDeterministic() {
  const source = `
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b b->c c->a
scalar c->h
`;
  const first = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const second = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });

  assert.equal(first.loopCandidate.id, second.loopCandidate.id);
  assert.deepEqual(positionSignature(first), positionSignature(second));
  assert.deepEqual(first.debug.loopCandidates.selected, second.debug.loopCandidates.selected);
}

async function testMilestoneThreeFermionArrowsDoNotMoveLoopLayout() {
  const forward = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b b->c c->a
scalar c->h
`);
  const reversed = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
anti fermion a->b b->c c->a
scalar c->h
`);
  const forwardLayout = await feynman.layoutFeynman(forward);
  const reversedLayout = await feynman.layoutFeynman(reversed);

  assert.equal(forwardLayout.analysis.topology.detectedTopology, "triangleLoop");
  assert.equal(reversedLayout.analysis.topology.detectedTopology, "triangleLoop");
  assert.equal(reversed.edges[2].arrow, "reverse");
  assert.deepEqual(positionSignature(forwardLayout), positionSignature(reversedLayout));
}

async function testMilestoneThreeMomentumDirectionDoesNotMoveLoopLayout() {
  const forward = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[momentum=k] b->c c->a
scalar c->h
`);
  const reversed = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[reversed momentum=k] b->c c->a
scalar c->h
`);
  const forwardLayout = await feynman.layoutFeynman(forward);
  const reversedLayout = await feynman.layoutFeynman(reversed);

  assert.equal(forwardLayout.analysis.topology.detectedTopology, "triangleLoop");
  assert.equal(reversedLayout.analysis.topology.detectedTopology, "triangleLoop");
  assert.equal(forward.edges[2].momentumDirection, "forward");
  assert.equal(reversed.edges[2].momentumDirection, "reverse");
  assert.deepEqual(positionSignature(forwardLayout), positionSignature(reversedLayout));
}

async function testMilestoneThreeBGenericPentagonLoopCandidateLayout() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming i
outgoing o
fermion i->a
fermion a->b b->c c->d d->e e->a
fermion c->o
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const points = loopPoints(layout);
  const center = polygonCenter(points);
  const edgeLengths = points.map((point, index) => pointDistance(point, points[(index + 1) % points.length]));

  assert.deepEqual(diagram.errors, []);
  assert.equal(layout.analysis.topology.detectedTopology, "polygonLoop");
  assert.equal(layout.analysis.topology.loopCandidate.type, "polygon");
  assert.equal(layout.loopCandidate.type, "polygon");
  assert.match(layout.loopCandidate.variant.shape, /^regular/);
  assert.ok(Math.abs(polygonArea(points)) > 16000);
  assert.ok(range(edgeLengths) < 45);
  assert.ok(Math.abs(center.x - layout.width / 2) < 0.001);
  assertFiniteScore(layout);
}

async function testMilestoneThreeBVacuumOneLoopIsCenteredAndSymmetric() {
  const source = `
layout spring
fermion a->b b->c c->d d->e e->a
`;
  const first = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const second = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const center = polygonCenter(loopPoints(first));
  const warning = first.diagnostics.find((diagnostic) => (
    diagnostic.severity === "warning"
    && diagnostic.data?.code === "vacuum-one-loop-centered-only"
  ));

  assert.equal(first.analysis.orientation.mode, "symmetric");
  assert.equal(first.analysis.topology.detectedTopology, "polygonLoop");
  assert.equal(first.analysis.topology.loopCandidate.type, "polygon");
  assert.ok(Math.abs(center.x - first.width / 2) < 0.001);
  assert.ok(Math.abs(center.y - first.height / 2) < 0.001);
  assert.ok(warning);
  assert.deepEqual(positionSignature(first), positionSignature(second));
}

async function testMilestoneThreeBLoopLabelsPreferOutsideTriangleAndBox() {
  const triangle = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[edge label=k] b->c c->a
scalar c->h
`);
  const triangleLayout = await feynman.layoutFeynman(triangle, { debug: true });
  const triangleEdge = triangle.edges[2];
  const triangleLabel = feynman.edgeLabelPosition(
    triangleEdge,
    triangleLayout.positions[triangleEdge.from],
    triangleLayout.positions[triangleEdge.to],
    triangleEdge.labelSide
  );
  const triangleDiagnostic = loopCandidateDiagnostic(triangleLayout);

  assert.equal(triangleLayout.analysis.topology.detectedTopology, "triangleLoop");
  assert.equal(pointInsidePolygon(triangleLabel, loopPoints(triangleLayout)), false);
  assert.equal(triangleLayout.loopCandidate.labelAware, true);
  assert.match(triangleDiagnostic.message, /Selected label-aware loop candidate/);

  const box = feynman.parseFeynman(`
layout spring
incoming i1 i2
outgoing o1 o2
fermion i1->a i2->d
fermion a->b[edge label=p] b->c c->d d->a
fermion b->o1 c->o2
`);
  const boxLayout = await feynman.layoutFeynman(box, { debug: true });
  const boxEdge = box.edges[2];
  const boxLabel = feynman.edgeLabelPosition(
    boxEdge,
    boxLayout.positions[boxEdge.from],
    boxLayout.positions[boxEdge.to],
    boxEdge.labelSide
  );

  assert.equal(boxLayout.analysis.topology.detectedTopology, "boxLoop");
  assert.equal(pointInsidePolygon(boxLabel, loopPoints(boxLayout)), false);
  assert.equal(boxLayout.loopCandidate.labelAware, true);
  assert.equal(typeof boxLayout.loopCandidate.score.breakdown.labelsInsideLoops, "number");
}

async function testMilestoneThreeBMomentumLabelsPreferOutsideLoopEdges() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming i1 i2
outgoing o1 o2
fermion i1->a i2->d
fermion a->b[momentum=p] b->c c->d d->a
fermion b->o1 c->o2
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const edge = diagram.edges[2];
  const label = feynman.edgeLabelPosition(edge, layout.positions[edge.from], layout.positions[edge.to], edge.labelSide);
  const arrow = feynman.momentumArrowGeometry(edge, layout.positions[edge.from], layout.positions[edge.to]);
  const points = loopPoints(layout);

  assert.equal(layout.analysis.topology.detectedTopology, "boxLoop");
  assert.equal(pointInsidePolygon(label, points), false);
  assert.equal(arrow.points.some((point) => pointInsidePolygon(point, points)), false);
  assert.equal(typeof layout.score.breakdown.momentumLoopCollision, "number");
  assert.ok(Number.isFinite(layout.score.breakdown.momentumLoopCollision));
}

async function testMilestoneThreeBLabelScoreFieldsAndDiagnosticsAreFinite() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[edge label=k] b->c[momentum=q] c->a
scalar c->h
label g1:g g2:g h:H
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const scoreDiagnostic = layout.diagnostics.find((diagnostic) => diagnostic.stage === "score");
  const fields = [
    "nodeLabelOverlap",
    "edgeLabelOverlap",
    "labelLabelOverlap",
    "labelsInsideLoops",
    "momentumLoopCollision",
  ];

  fields.forEach((field) => {
    assert.equal(typeof layout.score.breakdown[field], "number");
    assert.ok(Number.isFinite(layout.score.breakdown[field]), `${field} should be finite`);
    assert.equal(typeof scoreDiagnostic.data.breakdown[field], "number");
    assert.ok(Number.isFinite(scoreDiagnostic.data.breakdown[field]), `${field} diagnostic should be finite`);
  });
  assert.equal(layout.debug.loopCandidates.selected.labelAware, true);
  assert.equal(typeof layout.debug.loopCandidates.selected.score.labelTotal, "number");
}

async function testMilestoneThreeBAddingLabelsDoesNotChangeTopologyClassification() {
  const unlabeled = feynman.parseFeynman(`
layout spring
incoming i
outgoing o
fermion i->a
fermion a->b b->c c->d d->e e->a
fermion c->o
`);
  const labeled = feynman.parseFeynman(`
layout spring
incoming i
outgoing o
fermion i->a
fermion a->b[edge label=k] b->c c->d d->e e->a
fermion c->o
label i:i o:o
`);
  const unlabeledLayout = await feynman.layoutFeynman(unlabeled);
  const labeledLayout = await feynman.layoutFeynman(labeled);

  assert.equal(unlabeledLayout.analysis.topology.detectedTopology, "polygonLoop");
  assert.equal(labeledLayout.analysis.topology.detectedTopology, "polygonLoop");
  assert.deepEqual(unlabeledLayout.analysis.topology.loopCandidate.nodes, labeledLayout.analysis.topology.loopCandidate.nodes);
  assert.deepEqual(unlabeledLayout.analysis.topology.loopCandidate.edges, labeledLayout.analysis.topology.loopCandidate.edges);
}

async function testMilestoneThreeBManualPositionsSurviveLabelScoring() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming g1
outgoing h
position a 180 110
position b 320 110
position c 250 240
gluon g1->a
fermion a->b[edge label=k] b->c c->a
scalar c->h
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });

  assert.equal(layout.analysis.topology.detectedTopology, "triangleLoop");
  assert.equal(layout.positions.a.x, 180);
  assert.equal(layout.positions.a.y, 110);
  assert.equal(layout.positions.b.x, 320);
  assert.equal(layout.positions.b.y, 110);
  assert.equal(layout.positions.c.x, 250);
  assert.equal(layout.positions.c.y, 240);
}

async function testMilestoneThreeBExplicitCurveAndLabelSideArePreserved() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion b->c c->a a->b[half right, edge label'=k]
scalar c->h
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const edge = diagram.edges[4];

  assert.equal(layout.analysis.topology.detectedTopology, "triangleLoop");
  assert.deepEqual(edge.curve, { side: "right", amount: 2 / 3, shape: "semicircle" });
  assert.equal(edge.labelSide, "right");
  assert.equal(edge.autoLoopCurve, undefined);
  assert.equal(edge.autoParallelCurve, undefined);
}

async function testMilestoneThreeDLabelPlacementRunsAndReportsDiagnostics() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[edge label=k] b->c[momentum=q] c->a
scalar c->h
label g1:g g2:g h:H a:a
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true, profile: true });
  const diagnostic = layout.diagnostics.find((entry) => entry.stage === "label-placement");

  assert.equal(layout.labelPlacement.applied, true);
  assert.equal(layout.labelPlacement.summary.labelCount, layout.labelPlacement.entries.length);
  assert.equal(diagnostic.data.placedCount, layout.labelPlacement.entries.length);
  assert.equal(layout.debug.labelPlacement.summary.placedCount, layout.labelPlacement.summary.placedCount);
  assert.ok(layout.debug.profile.some((entry) => entry.stage === "label-placement"));
  assert.ok(labelPlacementEntry(layout, "node:a"));
  assert.ok(labelPlacementEntry(layout, "edge:a->b#3"));
  assert.ok(Number.isFinite(layout.labelPlacement.summary.residualScore));
  assertFiniteScore(layout);
}

async function testMilestoneThreeDNodeLabelAvoidsPropagator() {
  const diagram = feynman.parseFeynman(`
options width=360 height=220
position a 70 62
position b 290 62
position c 180 86
plain a->b
vertex c:dot
label c:CENTRAL_LABEL
`);
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const entry = labelPlacementEntry(layout, "node:c");

  assert.deepEqual(diagram.errors, []);
  assert.equal(layout.positions.a.x, 70);
  assert.equal(layout.positions.b.y, 62);
  assert.equal(layout.positions.c.x, 180);
  assert.equal(entry.defaultSide, "top");
  assert.equal(entry.side, "bottom");
  assert.equal(entry.hardInvalid, false);
  assert.equal(layout.score.breakdown.edgeLabelOverlap, 0);
  assert.equal(layout.labelPlacement.summary.breakdown.edgeLabelOverlap, 0);
}

async function testMilestoneThreeDExplicitMomentumSideIsPreserved() {
  const diagram = feynman.parseFeynman(`
options width=360 height=200
position a 70 100
position b 290 100
photon a->b[momentum'=k]
`);
  const layout = await feynman.layoutFeynman(diagram);
  const entry = labelPlacementEntry(layout, "edge:a->b#1");

  assert.deepEqual(diagram.errors, []);
  assert.equal(diagram.edges[0].labelSide, "right");
  assert.equal(entry.type, "momentum-label");
  assert.equal(entry.side, "right");
  assert.equal(entry.explicitSide, true);
  assert.ok(entry.y > layout.positions.a.y);
  assert.ok(entry.arrowBounds.y1 > layout.positions.a.y);
}

async function testMilestoneThreeDPlacementIsDeterministicAndDoesNotChangeTopology() {
  const source = `
layout spring
incoming i
outgoing o
position a 170 120
fermion i->a
fermion a->b b->c c->d d->e e->a
fermion c->o
label i:i o:o a:A b:B c:C d:D e:E a->b:k
`;
  const unlabeled = feynman.parseFeynman(`
layout spring
incoming i
outgoing o
position a 170 120
fermion i->a
fermion a->b b->c c->d d->e e->a
fermion c->o
`);
  const first = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const second = await feynman.layoutFeynman(feynman.parseFeynman(source), { debug: true });
  const unlabeledLayout = await feynman.layoutFeynman(unlabeled);

  assert.equal(first.analysis.topology.detectedTopology, unlabeledLayout.analysis.topology.detectedTopology);
  assert.equal(first.positions.a.x, 170);
  assert.equal(first.positions.a.y, 120);
  assert.deepEqual(first.labelPlacement.entries, second.labelPlacement.entries);
  assert.deepEqual(positionSignature(first), positionSignature(second));
}

async function testMilestoneFourMultiloopTopologyDecomposition() {
  const sharedVertex = feynman.parseFeynman(`
scalar a->b b->c c->a
scalar c->d d->e e->c
`);
  const sharedVertexLayout = await feynman.layoutFeynman(sharedVertex);

  assert.equal(sharedVertex.errors.length, 0);
  assert.equal(sharedVertexLayout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(sharedVertexLayout.analysis.topology.loopOrder, 2);
  assert.equal(sharedVertexLayout.analysis.topology.multiLoop.kind, "overlapping");
  assert.ok(sharedVertexLayout.analysis.topology.biconnectedComponents.length >= 2);
  assert.ok(sharedVertexLayout.analysis.topology.loopRegions.length >= 2);

  const overlapping = feynman.parseFeynman(`
scalar a->b b->c c->a
scalar b->d d->c
`);
  const overlappingLayout = await feynman.layoutFeynman(overlapping);

  assert.equal(overlapping.errors.length, 0);
  assert.equal(overlappingLayout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(overlappingLayout.analysis.topology.loopOrder, 2);
  assert.equal(overlappingLayout.analysis.topology.multiLoop.kind, "overlapping");
  assert.ok(overlappingLayout.analysis.topology.cycles.length >= 2);
}

async function testMilestoneFourSharedVertexTwoLoopLayoutCandidate() {
  const diagram = feynman.parseFeynman(`
scalar a->b b->c c->a
scalar c->d d->e e->c
`);
  const layout = await feynman.layoutFeynman(diagram);
  const cycles = layout.analysis.topology.cycles.filter((cycle) => cycle.nodes.length >= 3);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.multiLoop.kind, "overlapping");
  assert.ok(layout.multiloopCandidate);
  assertFiniteScore(layout);
  cycles.slice(0, 2).forEach((cycle) => {
    const points = cycle.nodes.map((node) => layout.positions[node]);
    assert.ok(Math.abs(polygonArea(points)) > 200, `${cycle.id} should be non-degenerate`);
  });

  const rerun = await feynman.layoutFeynman(diagram);
  assert.deepEqual(positionSignature(layout), positionSignature(rerun));
}

async function testMilestoneFourSharedVertexTwoLoopWithExternalLegsIsReadable() {
  const diagram = feynman.parseFeynman(`
incoming i
outgoing o1 o2
scalar i->a a->b b->c c->a
scalar c->d d->e e->c
scalar b->o1 e->o2
label i:i o1:o_1 o2:o_2 a:a b:b c:c d:d e:e
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.multiLoop.kind, "overlapping");
  assert.ok(layout.positions.a.x < layout.positions.c.x);
  assert.ok(layout.positions.d.x < layout.positions.c.x);
  assert.ok(layout.positions.c.x < layout.positions.b.x);
  assert.ok(layout.positions.c.x < layout.positions.e.x);
  assert.ok(layout.positions.i.x < layout.positions.a.x);
  assert.ok(layout.positions.b.x < layout.positions.o1.x);
  assert.ok(layout.positions.e.x < layout.positions.o2.x);
  assert.equal(layout.score.breakdown.topologyRecognizability, 0);
  assert.equal(layout.score.breakdown.labelLabelOverlap, 0);
}

async function testMilestoneFourOverlappingTwoLoopLayoutCandidate() {
  const diagram = feynman.parseFeynman(`
scalar a->b b->c c->a
scalar b->d d->c
`);
  const layout = await feynman.layoutFeynman(diagram);
  const cycles = layout.analysis.topology.cycles.filter((cycle) => cycle.nodes.length >= 3);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.multiLoop.kind, "overlapping");
  assert.ok(layout.multiloopCandidate);
  assert.ok(cycles.length >= 2);
  cycles.slice(0, 2).forEach((cycle) => {
    const points = cycle.nodes.map((node) => layout.positions[node]);
    assert.ok(Math.abs(polygonArea(points)) > 200, `${cycle.id} should have positive area`);
  });
  assert.ok(layout.positions.b);
  assert.ok(layout.positions.c);
}

async function testMilestoneFourDisconnectedVacuumMultiloopLayoutCandidate() {
  const diagram = feynman.parseFeynman(`
scalar a->b b->c c->a
scalar d->e e->f f->d
`);
  const layout = await feynman.layoutFeynman(diagram);
  const boxes = layout.analysis.topology.cycles.map((cycle) => (
    boundingBox(cycle.nodes.map((node) => layout.positions[node]))
  ));

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.multiLoop.kind, "disjoint");
  assert.equal(layout.analysis.topology.connectedComponents.length, 2);
  assert.ok(layout.multiloopCandidate);
  assert.ok(boxes.every((box) => Number.isFinite(box.minX) && Number.isFinite(box.maxX)));
}

async function testMilestoneFourThreeLoopChainFixturePacking() {
  const diagram = feynman.parseFeynman(readLayoutFixture("milestone-four-three-loop-chain.feynman"));
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const rerun = await feynman.layoutFeynman(diagram, { debug: true });

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.loopOrder, 3);
  assert.equal(layout.analysis.topology.multiLoop.kind, "overlapping");
  assert.equal(layout.multiloopCandidate.regions.length, 3);
  assert.deepEqual(selectedLoopRegions(layout).map((region) => region.kind), ["triangle", "triangle", "triangle"]);
  assertSelectedLoopRegionsNonDegenerate(layout);
  assertSelectedDisjointRegionsDoNotOverlap(layout);
  assert.equal(layout.score.breakdown.multiloopRegionOverlap, 0);
  assert.equal(layout.score.breakdown.topologyRecognizability, 0);
  assert.deepEqual(positionSignature(layout), positionSignature(rerun));
  assert.deepEqual(layout.multiloopCandidate, rerun.multiloopCandidate);
  assertFiniteScore(layout);
}

async function testMilestoneFourContainedLoopsWithExternalLegsFixture() {
  const diagram = feynman.parseFeynman(readLayoutFixture("milestone-four-contained-external.feynman"));
  const layout = await feynman.layoutFeynman(diagram, { debug: true });
  const containingRegions = layout.analysis.topology.loopRegions
    .filter((region) => region.contains.length >= 2);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.loopOrder, 2);
  assert.equal(layout.analysis.topology.multiLoop.kind, "overlapping");
  assert.ok(containingRegions.length >= 1, "composite region should record contained loops");
  assert.equal(layout.multiloopCandidate.regions.length, 2);
  assert.deepEqual(selectedLoopRegions(layout).map((region) => region.kind), ["box", "box"]);
  assert.ok(selectedLoopRegions(layout).every((region) => region.contains.length === 0));
  assert.ok(layout.positions.i.x < layout.positions.a.x);
  assert.ok(layout.positions.d.x < layout.positions.o.x);
  assertSelectedLoopRegionsNonDegenerate(layout);
  assert.equal(layout.score.breakdown.topologyRecognizability, 0);
  assertFiniteScore(layout);
}

async function testMilestoneFourOverlappingDenseLabelsFixture() {
  const diagram = feynman.parseFeynman(readLayoutFixture("milestone-four-overlapping-dense-labels.feynman"));
  const layout = await feynman.layoutFeynman(diagram, { debug: true });

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.loopOrder, 2);
  assert.equal(layout.analysis.topology.multiLoop.kind, "overlapping");
  assert.deepEqual(selectedLoopRegions(layout).map((region) => region.kind), ["triangle", "triangle"]);
  assertSelectedLoopRegionsNonDegenerate(layout);
  assert.equal(layout.labelPlacement.summary.labelCount, 13);
  assert.equal(layout.score.breakdown.labelLabelOverlap, 0);
  assert.equal(layout.score.breakdown.edgeLabelOverlap, 0);
  assert.equal(layout.score.breakdown.multiloopRegionOverlap, 0);
  assert.ok(Number.isFinite(layout.labelPlacement.summary.residualScore));
  assertFiniteScore(layout);
}

async function testMilestoneFourDisconnectedVacuumFixturePacking() {
  const diagram = feynman.parseFeynman(readLayoutFixture("milestone-four-disconnected-vacuum.feynman"));
  const layout = await feynman.layoutFeynman(diagram, { debug: true });

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.topology.detectedTopology, "multiLoop");
  assert.equal(layout.analysis.topology.loopOrder, 3);
  assert.equal(layout.analysis.topology.multiLoop.kind, "disjoint");
  assert.equal(layout.analysis.topology.connectedComponents.length, 3);
  assert.equal(layout.multiloopCandidate.regions.length, 3);
  assert.deepEqual(selectedLoopRegions(layout).map((region) => region.kind), ["triangle", "triangle", "triangle"]);
  assertSelectedLoopRegionsNonDegenerate(layout);
  assertSelectedDisjointRegionsDoNotOverlap(layout);
  assert.equal(layout.score.breakdown.multiloopRegionOverlap, 0);
  assert.equal(layout.score.breakdown.topologyRecognizability, 0);
  assertFiniteScore(layout);
}

async function testMilestoneFourIncrementalAddRemoveLoopRegionFixture() {
  const twoLoop = feynman.parseFeynman(readLayoutFixture("milestone-four-two-loop-chain.feynman"));
  const threeLoop = feynman.parseFeynman(readLayoutFixture("milestone-four-three-loop-chain.feynman"));
  const initial = await feynman.layoutFeynman(twoLoop, { debug: true });
  const added = await feynman.layoutFeynman(threeLoop, {
    debug: true,
    preservePreviousLayout: true,
    previousLayout: initial,
  });
  const removed = await feynman.layoutFeynman(twoLoop, {
    debug: true,
    preservePreviousLayout: true,
    previousLayout: added,
  });

  assert.equal(initial.analysis.topology.loopOrder, 2);
  assert.equal(added.analysis.topology.loopOrder, 3);
  assert.equal(removed.analysis.topology.loopOrder, 2);
  assert.equal(added.incremental.preserved, true);
  assert.equal(removed.incremental.preserved, true);
  Object.keys(initial.positions).forEach((node) => {
    assert.ok(pointDistance(initial.positions[node], added.positions[node]) < 0.000001);
    assert.ok(pointDistance(initial.positions[node], removed.positions[node]) < 0.000001);
  });
  assert.equal(added.score.breakdown.layoutInstability, 0);
  assert.equal(removed.score.breakdown.layoutInstability, 0);
  assertFiniteScore(added);
  assertFiniteScore(removed);
}

async function testMilestoneFourIncrementalLayoutPreservesSharedPositions() {
  const source = `
scalar a->b b->c c->a
scalar c->d d->e e->c
label a:A b:B c:C d:D e:E
`;
  const diagram = feynman.parseFeynman(source);
  const initial = await feynman.layoutFeynman(diagram);
  const relabeled = feynman.parseFeynman(`${source}\nlabel a:A'`);
  const stable = await feynman.layoutFeynman(relabeled, {
    preservePreviousLayout: true,
    previousLayout: initial,
  });

  assert.equal(relabeled.errors.length, 0);
  Object.keys(initial.positions).forEach((node) => {
    assert.ok(pointDistance(initial.positions[node], stable.positions[node]) < 0.000001);
  });
  assert.equal(stable.incremental.preserved, true);
  assert.equal(stable.score.breakdown.layoutInstability, 0);
}

async function testMilestoneFourProfileDebugIncludesStageTimings() {
  const diagram = feynman.parseFeynman(`
scalar a->b b->c c->a
scalar b->d d->c
`);
  const layout = await feynman.layoutFeynman(diagram, { profile: true });
  const stages = new Set((layout.debug.profile || []).map((entry) => entry.stage));

  assert.equal(diagram.errors.length, 0);
  assert.ok(stages.has("topology"));
  assert.ok(stages.has("multiloop"));
  assert.ok(stages.has("layout"));
  assert.ok(stages.has("score"));
  layout.debug.profile.forEach((entry) => {
    assert.equal(typeof entry.ms, "number");
    assert.ok(Number.isFinite(entry.ms));
  });
}

async function testLayoutApiAsyncAndFallbackSync() {
  const diagram = feynman.parseFeynman("fermion a->b");
  const promise = feynman.layoutFeynman(diagram);
  const fallback = feynman.layoutFeynmanFallbackSync(diagram);
  const layout = await promise;

  assert.equal(typeof promise.then, "function");
  assert.equal(typeof fallback.then, "undefined");
  assert.ok(layout.positions.a);
  assert.ok(fallback.positions.a);
}

async function testEdgeLabelsAndAllParticleTypes() {
  const diagram = feynman.parseFeynman(`
incoming q g
outgoing q2 h
plain p->q
fermion q->v1 v2->q2
gluon g->v1
photon v1->v2
scalar v2->h
label q:q g:g q2:q h:H v1->v2:γ
`);
  const layout = await feynman.layoutFeynman(diagram, { width: 600, height: 300 });

  assert.equal(diagram.errors.length, 0);
  assert.deepEqual(
    diagram.edges.map((edge) => edge.type),
    ["plain", "fermion", "fermion", "gluon", "photon", "scalar"]
  );
  assert.equal(diagram.edges[0].arrow, undefined);
  assert.equal(diagram.labels["v1->v2"], "γ");
  assert.equal(layout.width, 600);
  assert.equal(layout.height, 300);
  assert.ok(layout.positions.v1.x < layout.positions.v2.x);
}

async function testTriangleSquareDoubleEdges() {
  const diagram = feynman.parseFeynman(`
incoming a c e g i k
outgoing b d f h j l
triangle a->b
square c->d
double e->f
eikonal g->h
dashed i->j
dot-dashed k->l
`);

  assert.deepEqual(diagram.errors, []);
  assert.deepEqual(
    diagram.edges.map((edge) => edge.type),
    ["triangle", "square", "double", "double", "dashed", "dashdot"]
  );
  assert.equal(diagram.edges[2].arrow, undefined);
  assert.equal(diagram.edges[3].arrow, "forward");

  const from = { x: 0, y: 0 };
  const to = { x: 120, y: 0 };

  const triangle = pathNumbers(feynman.trianglePath(from, to, 7, 16));
  assert.deepEqual(triangle.slice(0, 2), [from.x, from.y]);
  assert.deepEqual(triangle.slice(-2), [to.x, to.y]);
  assert.ok(triangle.some((value, index) => index % 2 === 1 && Math.abs(value) > 6));

  const square = pathNumbers(feynman.squarePath(from, to, 6, 18));
  assert.deepEqual(square.slice(0, 2), [from.x, from.y]);
  assert.deepEqual(square.slice(-2), [to.x, to.y]);
  assert.ok(square.some((value, index) => index % 2 === 1 && Math.abs(value) > 5));

  const double = feynman.doubleLinePath(from, to, 4.6);
  const subpaths = double.split("M").filter((part) => part.trim().length > 0);
  assert.equal(subpaths.length, 2);
  const doubleNumbers = pathNumbers(double);
  assert.ok(doubleNumbers.some((value, index) => index % 2 === 1 && Math.abs(value - 2.3) < 0.001));
  assert.ok(doubleNumbers.some((value, index) => index % 2 === 1 && Math.abs(value + 2.3) < 0.001));
}

async function testGluonPathTouchesEndpoints() {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 0 };
  const path = pathNumbers(feynman.gluonPath(from, to, 5.5, 13));
  const curvedPath = pathNumbers(feynman.gluonPathForEdge({
    curve: { side: "left", amount: 0.35 },
  }, from, to, 5.5, 13));

  assert.deepEqual(path.slice(0, 2), [from.x, from.y]);
  assert.deepEqual(path.slice(-2), [to.x, to.y]);
  assert.ok(path.some((coordinate, index) => index % 2 === 1 && Math.abs(coordinate) > 1));
  assert.deepEqual(curvedPath.slice(0, 2), [from.x, from.y]);
  assert.deepEqual(curvedPath.slice(-2), [to.x, to.y]);
}

async function testGluonJunctionCaps() {
  const source = `
incoming q
outgoing q2 g
fermion q->v1 v1->q2
gluon v1->g
`;
  const diagram = feynman.parseFeynman(source);
  const layout = await feynman.layoutFeynman(diagram);
  const styled = feynman.parseFeynman(`${source}\nvertex v1:dot`);
  const styledLayout = await feynman.layoutFeynman(styled);
  const photonOnly = feynman.parseFeynman(`
incoming q
outgoing q2 gamma
fermion q->v1 v1->q2
photon v1->gamma
`);
  const photonOnlyLayout = await feynman.layoutFeynman(photonOnly);

  assert.deepEqual(feynman.junctionCapNodes(diagram, layout).map((cap) => cap.node), ["v1"]);
  assert.deepEqual(feynman.junctionCapNodes(styled, styledLayout), []);
  assert.deepEqual(feynman.junctionCapNodes(photonOnly, photonOnlyLayout), []);
}

async function testCyclicInternalLayoutStaysBounded() {
  const cyclic = feynman.parseFeynman(`
incoming i1
outgoing o1
fermion i1->v1
photon v1->v2 v2->v1
fermion v2->o1
`);
  const cyclicLayout = await feynman.layoutFeynman(cyclic);
  assert.ok(cyclicLayout.positions.v1.x > 0);
  assert.ok(cyclicLayout.positions.v1.x < cyclicLayout.width);
  assert.ok(cyclicLayout.positions.v2.x > 0);
  assert.ok(cyclicLayout.positions.v2.x < cyclicLayout.width);
}

async function testLatexLabelMarkup() {
  assert.deepEqual(feynman.parseLabelMarkup("\\mu^- p_{T} \\gamma"), [
    { kind: "normal", text: "μ" },
    { kind: "sup", text: "-" },
    { kind: "normal", text: " p" },
    { kind: "sub", text: "T" },
    { kind: "normal", text: " γ" },
  ]);

  assert.deepEqual(feynman.parseLabelMarkup("m_{\\mu}^{2}"), [
    { kind: "normal", text: "m" },
    { kind: "sub", text: "μ" },
    { kind: "sup", text: "2" },
  ]);

  assert.deepEqual(feynman.parseLabelMarkup("e⁻ μ⁺ p²"), [
    { kind: "normal", text: "e" },
    { kind: "sup", text: "-" },
    { kind: "normal", text: " μ" },
    { kind: "sup", text: "+" },
    { kind: "normal", text: " p" },
    { kind: "sup", text: "2" },
  ]);

  assert.equal(feynman.labelMarkupToText("\\nu_\\mu \\to e^-"), "νμ → e-");
  assert.equal(feynman.labelMarkupToText("e⁻ μ⁺ p²"), "e- μ+ p2");
  assert.equal(feynman.labelMarkupToText("\\unknown \\_literal"), "\\unknown _literal");
  assert.equal(feynman.labelSegmentText({ kind: "sup", text: "--" }), "−−");
  assert.equal(feynman.labelSegmentText({ kind: "sub", text: "p-q" }), "p−q");
  assert.equal(feynman.labelSegmentText({ kind: "normal", text: "p-q" }), "p-q");
  assert.equal(feynman.labelNeedsMathJax("g_{\\pi\\pi n}"), true);
  assert.equal(feynman.labelNeedsMathJax("g_{\\pi\\pi}"), true);
  assert.equal(feynman.labelNeedsMathJax("m_{\\mu}^{2}"), false);
  assert.equal(feynman.labelNeedsMathJax("\\mu^-"), false);
  assert.equal(feynman.labelNeedsMathJax("\\frac{a}{b}"), true);
  assert.deepEqual(feynman.parseLabelMarkup("g_{\\pi\\pi}"), [
    { kind: "normal", text: "g" },
    { kind: "sub", text: "ππ" },
  ]);
}

async function testLabelParserPreservesBracedSpaces() {
  const diagram = feynman.parseFeynman(`
label g1:g_{\\pi\\pi n} g2:g_{\\pi\\pi n} plain:ok tail:+...
`);
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.labels.g1, "g_{\\pi\\pi n}");
  assert.equal(diagram.labels.g2, "g_{\\pi\\pi n}");
  assert.equal(diagram.labels.plain, "ok");
  assert.equal(diagram.labels.tail, "+...");
  assert.equal(feynman.labelNeedsMathJax(diagram.labels.g1), true);
  assert.equal(
    feynman.mathJaxDisplayFontSize("feynman-diagram__label"),
    feynman.visualDefaults.labelFontSize * feynman.visualDefaults.mathLabelFontScale,
  );
  assert.equal(feynman.parseMathJaxSvgLength("2.5ex", 20), 20 * 2.5 * 0.431);
  assert.equal(feynman.parseMathJaxSvgLength("18px", 20), 18);
}

async function testLayoutOptionsManualPositionsAndInvisibleEdges() {
  const diagram = feynman.parseFeynman(`
options layout=spring orientation=vertical size=small width=500 height=420
incoming mu
outgoing nue e
fermion mu->w w->nue
anti fermion e->w
invisible nue->e
position w 250 210
label mu:\\mu^- nue:\\nu_\\mu e:e^- w:W^-
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.options.layout, "spring");
  assert.equal(diagram.options.orientation, "vertical");
  assert.equal(layout.width, 500);
  assert.equal(layout.height, 420);
  assert.equal(layout.positions.w.x, 250);
  assert.equal(layout.positions.w.y, 210);
  assert.ok(layout.positions.mu.y < layout.positions.e.y);
  assert.equal(diagram.edges[2].type, "fermion");
  assert.equal(diagram.edges[2].arrow, "reverse");
  assert.equal(diagram.edges[3].hidden, true);
}

async function testHiddenEdgesAffectElkLayoutButDoNotRender() {
  const withoutHint = feynman.parseFeynman(`
layout layered
vertex a:dot b:dot
`);
  const withHint = feynman.parseFeynman(`
layout layered
invisible a->b
vertex a:dot b:dot
`);
  const withoutHintLayout = await feynman.layoutFeynman(withoutHint);
  const withHintLayout = await feynman.layoutFeynman(withHint);

  assert.deepEqual(withHint.errors, []);
  assert.equal(withHint.edges[0].hidden, true);
  assert.equal(withHint.edges[0].type, "invisible");
  assert.ok(Math.abs(withoutHintLayout.positions.a.x - withoutHintLayout.positions.b.x) < 0.001);
  assert.ok(withHintLayout.positions.a.x < withHintLayout.positions.b.x);
}

async function testVerticalOrientationStacksScatteringVertices() {
  const diagram = feynman.parseFeynman(`
orientation vertical
size small
incoming e positron
outgoing electron positron2
fermion e->a a->electron
photon a->b
anti fermion positron2->b b->positron
label e:e^- positron:e^+ electron:e^- positron2:e^+ a->b:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.options.orientation, "vertical");
  assert.ok(layout.width < layout.height);
  assert.equal(layout.positions.e.x, layout.positions.positron.x);
  assert.equal(layout.positions.electron.x, layout.positions.positron2.x);
  assert.ok(layout.positions.e.x < layout.positions.a.x);
  assert.ok(layout.positions.b.x < layout.positions.positron2.x);
  assert.ok(layout.positions.a.x < layout.positions.b.x);
  assert.ok(layout.positions.a.y < layout.positions.b.y);
  assert.ok(Math.abs(layout.positions.e.y - layout.positions.b.y) < 0.001);
  assert.ok(Math.abs(layout.positions.positron.y - layout.positions.a.y) < 0.001);
  assert.equal(layout.positions.e.labelSide, "left");
  assert.equal(layout.positions.positron.labelSide, "left");
  assert.equal(layout.positions.electron.labelSide, "right");
  assert.equal(layout.positions.positron2.labelSide, "right");
}

async function testSpringElectricalLayoutIsDistinctFromSpring() {
  const source = `
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\\mu^- numu:\\nu_\\mu nue:\\nu_e e:e^- w->v:W^-
`;
  const spring = feynman.parseFeynman(`layout spring\n${source}`);
  const electrical = feynman.parseFeynman(`layout spring electrical\n${source}`);
  const dashedAlias = feynman.parseFeynman(`options layout=spring-electrical\n${source}`);
  const springLayout = await feynman.layoutFeynman(spring);
  const electricalLayout = await feynman.layoutFeynman(electrical);

  assert.equal(spring.errors.length, 0);
  assert.equal(electrical.errors.length, 0);
  assert.equal(dashedAlias.errors.length, 0);
  assert.equal(spring.options.layout, "spring");
  assert.equal(electrical.options.layout, "spring-electrical");
  assert.equal(dashedAlias.options.layout, "spring-electrical");
  assert.ok(Math.abs(electricalLayout.positions.v.y - springLayout.positions.v.y) > 1);
}

async function testTreeLayoutPlacesBranchesByDepth() {
  const diagram = feynman.parseFeynman(`
layout tree
incoming a
outgoing b c d
fermion a->v v->b v->c v->d
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(layout.positions.a.x < layout.positions.v.x);
  assert.ok(layout.positions.v.x < layout.positions.b.x);
  assert.equal(layout.positions.b.kind, "outgoing");
  assert.equal(layout.positions.c.labelSide, "right");
  assert.equal(layout.positions.a.y, layout.positions.v.y);
}

async function testTreeLayoutCentersParentsOverChildren() {
  const diagram = feynman.parseFeynman(`
layout tree
incoming a
outgoing c e f
fermion a->b b->c b->d d->e d->f
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(layout.positions.a.x < layout.positions.b.x);
  assert.ok(layout.positions.b.x < layout.positions.c.x);
  assert.notEqual(layout.positions.c.y, layout.positions.d.y);
  assert.notEqual(layout.positions.e.y, layout.positions.f.y);
  assert.ok(Math.abs(layout.positions.d.y - (layout.positions.e.y + layout.positions.f.y) / 2) < 0.001);
  assert.ok(Math.abs(layout.positions.b.y - (layout.positions.c.y + layout.positions.d.y) / 2) < 0.001);
}

async function testTreeLayoutKeepsDeclaredOutgoingLeavesOnOutgoingSide() {
  const diagram = feynman.parseFeynman(`
layout tree
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\\mu^- numu:\\nu_\\mu nue:\\nu_e e:e^- w->v:W^-
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.positions.mu.y, layout.positions.w.y);
  assert.ok(layout.positions.mu.x < layout.positions.w.x);
  assert.ok(layout.positions.w.x < layout.positions.v.x);
  assert.ok(layout.positions.v.x < layout.positions.numu.x);
  assert.ok(layout.positions.v.x < layout.positions.nue.x);
  assert.ok(layout.positions.v.x < layout.positions.e.x);
  assert.ok(layout.positions.numu.y < layout.positions.nue.y);
  assert.ok(layout.positions.nue.y < layout.positions.e.y);
}

async function testVertexShapes() {
  const diagram = feynman.parseFeynman(`
incoming a
outgoing b
fermion a->v v->blob blob->disk disk->x x->b
vertex v:dot blob:blob disk:large-blob x:crossed-dot a:empty-dot b:square-dot
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.vertices.v, "dot");
  assert.equal(diagram.vertices.blob, "blob");
  assert.equal(diagram.vertices.disk, "disk");
  assert.equal(diagram.vertices.x, "crossed-dot");
  assert.equal(diagram.vertices.a, "empty-dot");
  assert.equal(diagram.vertices.b, "square-dot");
  assert.ok(layout.positions.v);
  assert.ok(layout.positions.blob);
  assert.ok(layout.positions.disk);
  assert.ok(layout.positions.x);

  const unstyled = feynman.parseFeynman(`
incoming a
outgoing b
fermion a->v v->b
`);
  const unstyledLayout = await feynman.layoutFeynman(unstyled);

  assert.equal(unstyled.errors.length, 0);
  assert.equal(unstyled.vertices.v, undefined);
  assert.equal(unstyledLayout.positions.v.kind, "internal");

  const standalone = feynman.parseFeynman(`
options width=300 height=220
position c 150 110
vertex c:cross
label c:X
`);
  const standaloneLayout = await feynman.layoutFeynman(standalone);

  assert.equal(standalone.errors.length, 0);
  assert.equal(standalone.vertices.c, "cross");
  assert.equal(standaloneLayout.positions.c.x, 150);
  assert.equal(standaloneLayout.positions.c.y, 110);

  const customized = feynman.parseFeynman(`
position blob 120 110
position disk 240 110
position tall 360 110
position wide 480 110
position flat 600 110
vertex blob:blob[hatch=diagonal,size=24] disk:disk[pattern="north west lines",radius=52] tall:blob[hatch=grid,diameter=60] wide:blob[hatch=horizontal,width=96,height=40] flat:disk[rx=60,ry=22]
`);

  assert.deepEqual(customized.errors, []);
  assert.deepEqual(customized.vertices.blob, { shape: "blob", hatch: "diagonal", size: 24 });
  assert.deepEqual(customized.vertices.disk, { shape: "disk", hatch: "diagonal-reverse", size: 52 });
  assert.deepEqual(customized.vertices.tall, { shape: "blob", hatch: "grid", size: 30 });
  assert.deepEqual(customized.vertices.wide, { shape: "blob", hatch: "horizontal", rx: 48, ry: 20 });
  assert.deepEqual(customized.vertices.flat, { shape: "disk", rx: 60, ry: 22 });

  const svg = await renderDiagramSvg(`
options width=260 height=160
position ell 80 80
position circ 180 80
vertex ell:blob[hatch=vertical,width=96,height=40] circ:disk[rx=30,ry=30]
`);
  const ellipse = svg.querySelector("ellipse.feynman-diagram__vertex--blob");
  const ellipseBackdrop = svg.querySelector("ellipse.feynman-diagram__vertex-backdrop");
  const circle = svg.querySelector("circle.feynman-diagram__vertex--disk");

  assert.ok(ellipse);
  assert.equal(ellipse.getAttribute("rx"), "48");
  assert.equal(ellipse.getAttribute("ry"), "20");
  assert.ok(ellipseBackdrop);
  assert.equal(ellipseBackdrop.getAttribute("rx"), "49");
  assert.equal(ellipseBackdrop.getAttribute("ry"), "21");
  assert.ok(circle);
  assert.equal(circle.getAttribute("r"), "30");

  const invalid = feynman.parseFeynman(`
position v 100 100
vertex v:dot[hatch=cross] bad:blob[hatch=zigzag] tiny:blob[size=0] wide:blob[width=0] flat:blob[ry=bogus]
`);

  assert.equal(invalid.errors.length, 5);
  assert.match(invalid.errors[0], /only supported for blob and disk/);
  assert.match(invalid.errors[1], /unsupported blob hatch/);
  assert.match(invalid.errors[2], /size must be a positive number or preset/);
  assert.match(invalid.errors[3], /width must be a positive number or preset/);
  assert.match(invalid.errors[4], /y radius must be a positive number or preset/);
}

async function testCurvedEdgesInlineLabelsAndBraces() {
  const diagram = feynman.parseFeynman(`
options width=500 height=280
incoming a
outgoing c
position a 70 140
position b 210 140
position c 430 140
photon a->b[momentum={[arrow distance=24, arrow shorten=0.2, label distance=4]p}]
fermion b->c[half left, momentum=k] c->b[half left, momentum'=k-p]
brace a->b[left]:B^0
label a:\\overline{b} c:f b->c#1:q
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges[0].label, "p");
  assert.deepEqual(diagram.edges[0].momentum, {
    arrowDistance: 24,
    arrowShorten: 0.2,
    labelDistance: 4,
  });
  assert.equal(diagram.edges[1].curve.side, "left");
  assert.equal(diagram.edges[1].label, "k");
  assert.equal(diagram.edges[2].labelSide, "right");
  assert.equal(diagram.edges[2].labelPlacement, "momentum-prime");

  const overlay = feynman.parseFeynman(`
options width=220 height=160
position left 30 80
position blob 110 80
position right 190 80
fermion left->right[overlay]
vertex blob:blob[width=96,height=48]
`);
  assert.equal(overlay.errors.length, 0);
  assert.equal(overlay.edges[0].overlay, true);
  const overlaySvg = await renderDiagramSvg(`
options width=220 height=160
position left 30 80
position blob 110 80
position right 190 80
fermion left->right[overlay]
vertex blob:blob[width=96,height=48]
`);
  assert.ok(
    overlaySvg.innerHTML.indexOf("feynman-diagram__vertex-group") < overlaySvg.innerHTML.indexOf("feynman-diagram__edge-group"),
    "overlay edges should render after vertices",
  );

  const normalPhotonLabel = feynman.edgeLabelPosition(
    diagram.edges[0],
    layout.positions.a,
    layout.positions.b,
    "left",
    { forceNormal: true }
  );
  const momentumPhotonLabel = feynman.edgeLabelPosition(
    diagram.edges[0],
    layout.positions.a,
    layout.positions.b,
    "left"
  );

  assert.ok(normalPhotonLabel.y > momentumPhotonLabel.y);
  assert.equal(diagram.braces.length, 1);
  const brace = feynman.braceGeometry(layout.positions.a, layout.positions.b, "left");

  assert.equal(brace.kind, "tex-brace");
  assert.equal(brace.x, 16);
  assert.equal(brace.pieces.length, 3);
  assert.ok(brace.bounds.y1 < layout.positions.a.y);
  assert.ok(brace.bounds.y2 > layout.positions.b.y);
  assert.match(brace.pieces[0].path, /^M5\.021171 4\.513076C/);
  assert.match(brace.pieces[0].transform, /^matrix\(/);
  assert.equal(brace.label.anchor, "end");
  const tallBrace = feynman.braceGeometry({ x: 80, y: 90 }, { x: 80, y: 330 }, "left");

  assert.equal(tallBrace.kind, "tex-brace");
  assert.ok(tallBrace.extenderRepeats > 0);
  assert.equal(tallBrace.pieces.length, 3 + 2 * tallBrace.extenderRepeats);
  assert.match(feynman.edgePath(diagram.edges[1], layout.positions.b, layout.positions.c), /^M .* C /);
  assert.match(feynman.wavePathForEdge(diagram.edges[0], layout.positions.a, layout.positions.b, 7, 18), /^M\s/);
  assert.deepEqual(feynman.parseLabelMarkup("\\overline{b}"), [
    { kind: "normal", text: "b", overline: true },
  ]);
  assert.equal(feynman.labelMarkupToText("\\overline{b}"), "b");
}

async function testAutomaticLoopExamplesNeedNoManualPositions() {
  const examples = [
    `
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`,
    `
layout spring
incoming e
outgoing e2
fermion e->a a->b b->e2
photon a->b[half left, edge label=\\gamma]
fermion b->a[half left]
label e:e^- e2:e^-
`,
    `
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b b->c c->a
scalar c->h
label g1:g g2:g h:H
`,
  ];

  for (const source of examples) {
    const diagram = feynman.parseFeynman(source);
    const layout = await feynman.layoutFeynman(diagram);
    const internalNodes = Object.entries(layout.positions)
      .filter(([, position]) => position.kind === "internal")
      .map(([node, position]) => ({ node, position }));

    assert.equal(diagram.errors.length, 0);
    assert.deepEqual(diagram.manualPositions, {});
    assert.ok(internalNodes.length >= 2);

    internalNodes.forEach(({ node, position }) => {
      assert.ok(position.x > layout.options.marginX, `${node} should clear incoming side`);
      assert.ok(position.x < layout.width - layout.options.marginX, `${node} should clear outgoing side`);
    });
  }
}

async function testTwoEdgeLoopIsCircularAndKeepsMomentaOutside() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);
  const topEdge = diagram.edges[2];
  const bottomEdge = diagram.edges[3];
  const a = layout.positions.a;
  const b = layout.positions.b;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const baseline = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const along = { x: (b.x - a.x) / chord, y: (b.y - a.y) / chord };
  const normal = { x: -along.y, y: along.x };
  const normalDistance = (point) => (
    (point.x - baseline.x) * normal.x + (point.y - baseline.y) * normal.y
  );
  const alongDistance = (from, to) => (
    (to.x - from.x) * along.x + (to.y - from.y) * along.y
  );
  const topMidpoint = cubicMidpoint(feynman.edgePath(topEdge, a, b));
  const bottomMidpoint = cubicMidpoint(feynman.edgePath(bottomEdge, b, a));
  const topLabel = feynman.edgeLabelPosition(topEdge, a, b, topEdge.labelSide);
  const bottomLabel = feynman.edgeLabelPosition(bottomEdge, b, a, bottomEdge.labelSide);
  const topArrow = feynman.momentumArrowGeometry(topEdge, a, b);
  const bottomArrow = feynman.momentumArrowGeometry(bottomEdge, b, a);
  const topArrowMidpoint = topArrow.points[Math.floor(topArrow.points.length / 2)];
  const bottomArrowMidpoint = bottomArrow.points[Math.floor(bottomArrow.points.length / 2)];

  assert.equal(diagram.errors.length, 0);
  assert.ok(Math.abs(Math.abs(normalDistance(topMidpoint)) - chord / 2) < 0.25);
  assert.ok(Math.abs(Math.abs(normalDistance(bottomMidpoint)) - chord / 2) < 0.25);
  assert.ok(normalDistance(topMidpoint) < 0);
  assert.ok(normalDistance(bottomMidpoint) > 0);
  assert.ok(normalDistance(topLabel) < normalDistance(topMidpoint));
  assert.ok(normalDistance(bottomLabel) > normalDistance(bottomMidpoint));
  assert.ok(alongDistance(topArrow.start, topArrow.end) > 0);
  assert.ok(alongDistance(bottomArrow.start, bottomArrow.end) < 0);
  assert.ok(Math.abs(alongDistance(topArrow.start, topArrow.end)) < chord * 0.8);
  assert.ok(Math.abs(alongDistance(bottomArrow.start, bottomArrow.end)) < chord * 0.8);
  assert.ok(normalDistance(topLabel) < normalDistance(topArrow.end));
  assert.ok(normalDistance(bottomLabel) > normalDistance(bottomArrow.end));
  assert.ok(normalDistance(topArrowMidpoint) - normalDistance(topLabel) >= 18);
  assert.ok(normalDistance(bottomLabel) - normalDistance(bottomArrowMidpoint) >= 18);
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

async function testMinimalPhotonExchangeAlignsInternalsAndStaysInViewBox() {
  const source = `
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`;
  const diagram = feynman.parseFeynman(source);
  const layout = await feynman.layoutFeynman(diagram);
  const bounds = edgePathBounds(diagram, layout);
  const margin = layout.options.marginY;

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(layout.positions.gamma1.kind, "unclassified");
  assert.equal(layout.positions.gamma2.kind, "unclassified");
  assert.ok(Math.abs(layout.positions.a.y - layout.positions.b.y) < 0.5);
  assert.ok(layout.positions.gamma1.x < layout.positions.a.x);
  assert.ok(layout.positions.b.x < layout.positions.gamma2.x);
  assert.ok(bounds.minY >= margin - 1);
  assert.ok(bounds.maxY <= layout.height - margin + 1);
}

async function testReversedMomentumFlipsArrowDirectionOnly() {
  const from = { x: 10, y: 40 };
  const to = { x: 110, y: 40 };
  const forward = {
    type: "photon",
    from: "a",
    to: "b",
    labelPlacement: "momentum",
    momentumDirection: "forward",
  };
  const reversed = {
    ...forward,
    momentumDirection: "reverse",
  };
  const primed = {
    ...forward,
    labelPlacement: "momentum-prime",
  };
  const forwardArrow = feynman.momentumArrowGeometry(forward, from, to);
  const reversedArrow = feynman.momentumArrowGeometry(reversed, from, to);
  const forwardLabel = feynman.edgeLabelPosition(forward, from, to, "left");
  const primedLabel = feynman.edgeLabelPosition(primed, from, to, "right");

  assert.ok(forwardArrow.end.x > forwardArrow.start.x);
  assert.ok(reversedArrow.end.x < reversedArrow.start.x);
  assert.equal(forwardLabel.x, primedLabel.x);
  assert.ok(forwardLabel.y < from.y);
  assert.ok(primedLabel.y > from.y);
}

async function testLayeredLayoutUsesAvailableCrossAxisForExternalLegs() {
  const diagram = feynman.parseFeynman(`
layout layered
incoming a
outgoing b c d
fermion a->cross cross->b
photon cross->blob blob->c
scalar blob->d
vertex cross:crossed-dot blob:blob a:empty-dot
label a:e^- b:e^- c:\\gamma d:H
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(Math.abs(layout.positions.b.y - layout.options.marginY) < 4);
  assert.equal(layout.positions.c.y, layout.height / 2);
  assert.equal(layout.positions.d.y, layout.height - layout.options.marginY);
  assert.equal(layout.positions.a.y, layout.positions.cross.y);
  assert.ok(Math.abs(layout.positions.b.y - layout.positions.cross.y) < 4);
  assert.ok(layout.positions.d.y - layout.positions.b.y > 180);
  assert.ok(layout.positions.blob.y > layout.positions.cross.y);
}

async function testSpringLayoutPreservesDeclaredOutgoingBoundaryOrder() {
  const diagram = feynman.parseFeynman(`
layout spring
size small
incoming pi0
outgoing gamma1 gamma2
scalar pi0->t1
fermion t1->t2 t2->t3 t3->t1
photon t2->gamma1 t3->gamma2
invisible gamma1->gamma2
label pi0:\\pi^0 gamma1:\\gamma gamma2:\\gamma
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(Math.abs(layout.positions.pi0.y - layout.positions.t1.y) < 0.001);
  assert.ok(layout.positions.gamma1.y < layout.positions.gamma2.y);
  assert.ok(layout.positions.t2.x < layout.positions.gamma1.x);
  assert.ok(layout.positions.t3.x < layout.positions.gamma2.x);
}

async function testSpringLayoutAlignsSimpleScatteringLanes() {
  const diagram = feynman.parseFeynman(`
options width=760 height=400
align vertical lepton_vertex struck
incoming p1l p2l pql lepton_in
outgoing lepton_out jet p2r p1r
fermion pql->parton[overlay] lepton_in->lepton_vertex
fermion parton->struck
photon lepton_vertex->struck[edge label=\\gamma^*]
fermion lepton_vertex->lepton_out
fermion struck->jet
fermion p2l->p2r[overlay] p1l->p1r[overlay]
label lepton_in:\\ell lepton_out:\\ell' parton:q jet:X
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(approximatelyEqual(layout.positions.lepton_in.y, layout.positions.lepton_vertex.y));
  assert.ok(approximatelyEqual(layout.positions.lepton_vertex.y, layout.positions.lepton_out.y));
  assert.ok(approximatelyEqual(layout.positions.pql.y, layout.positions.parton.y));
  assert.ok(approximatelyEqual(layout.positions.parton.y, layout.positions.struck.y));
  assert.ok(approximatelyEqual(layout.positions.struck.y, layout.positions.jet.y));
  assert.ok(approximatelyEqual(layout.positions.p2l.y, layout.positions.p2r.y));
  assert.ok(approximatelyEqual(layout.positions.p1l.y, layout.positions.p1r.y));
  assert.ok(approximatelyEqual(layout.positions.lepton_vertex.x, layout.positions.struck.x));
  assert.ok(layout.positions.parton.x < layout.positions.lepton_vertex.x);
  assert.ok(layout.positions.struck.x < layout.positions.jet.x);
}

async function testAlignVerticalOrdersNamedNodesByDeclaration() {
  const bhabha = (first, second) => feynman.parseFeynman(`
options width=330 height=520
layout layered
align vertical ${first} ${second}
incoming e_minus e_plus
outgoing e_minus_out e_plus_out
fermion e_minus->upper upper->e_minus_out
photon upper->lower[edge label=\\gamma]
anti fermion e_plus_out->lower lower->e_plus
label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
`);

  const upperFirst = await feynman.layoutFeynman(bhabha("upper", "lower"));
  const lowerFirst = await feynman.layoutFeynman(bhabha("lower", "upper"));

  assert.equal(upperFirst.analysis.validation?.diagnostics?.some((entry) => entry.severity === "error") || false, false);

  assert.ok(approximatelyEqual(upperFirst.positions.upper.x, upperFirst.positions.lower.x));
  assert.ok(approximatelyEqual(lowerFirst.positions.upper.x, lowerFirst.positions.lower.x));

  assert.ok(upperFirst.positions.upper.y < upperFirst.positions.lower.y);
  assert.ok(lowerFirst.positions.lower.y < lowerFirst.positions.upper.y);

  const upperGap = Math.abs(upperFirst.positions.upper.y - upperFirst.positions.lower.y);
  assert.ok(upperGap > 100);
}

async function testAlignVerticalSameLineConstraintPreservesLaneOrder() {
  const diagram = feynman.parseFeynman(`
options width=760 height=400
align vertical lepton_vertex struck
incoming p1l p2l pql lepton_in
outgoing lepton_out jet p2r p1r
fermion pql->parton[overlay] lepton_in->lepton_vertex
fermion parton->struck
photon lepton_vertex->struck[edge label=\\gamma^*]
fermion lepton_vertex->lepton_out
fermion struck->jet
fermion p2l->p2r[overlay] p1l->p1r[overlay]
label lepton_in:\\ell lepton_out:\\ell' parton:q jet:X
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(approximatelyEqual(layout.positions.lepton_vertex.x, layout.positions.struck.x));
  assert.ok(approximatelyEqual(layout.positions.lepton_vertex.y, layout.positions.lepton_in.y));
  assert.ok(approximatelyEqual(layout.positions.struck.y, layout.positions.parton.y));
  assert.ok(layout.positions.lepton_vertex.y < layout.positions.struck.y);
}

async function testSpringLayoutKeepsDrellYanJunctionInsidePartonCorridor() {
  const diagram = feynman.parseFeynman(`
options width=760 height=380
incoming h2s2l h2s1l h2ql h1ql h1s2l h1s1l
outgoing h1s1r h1s2r lminus lplus h2s1r h2s2r
fermion h1s1l->h1s1r[overlay] h1ql->q[overlay] h1s2l->h1s2r[overlay]
anti fermion h2s1l->h2s1r[overlay] h2ql->qbar[overlay] h2s2l->h2s2r[overlay]
anti fermion qbar->ann
fermion q->ann
photon ann->boson[edge label=\\gamma^*/Z]
fermion boson->lminus
anti fermion boson->lplus
vertex ann:dot boson:dot
label q:q qbar:\\overline{q} lminus:\\ell^- lplus:\\ell^+
`);
  const layout = await feynman.layoutFeynman(diagram);
  const { ann, boson, h1ql, h2ql, lminus, lplus, q, qbar } = layout.positions;
  const lowerRow = Math.min(q.y, qbar.y);
  const upperRow = Math.max(q.y, qbar.y);
  const partonCenter = (q.y + qbar.y) / 2;
  const leptonCenter = (lminus.y + lplus.y) / 2;

  assert.equal(diagram.errors.length, 0);
  assert.ok(approximatelyEqual(q.y, h1ql.y));
  assert.ok(approximatelyEqual(qbar.y, h2ql.y));
  assert.ok(approximatelyEqual(q.y, lminus.y));
  assert.ok(approximatelyEqual(qbar.y, lplus.y));
  assert.ok(ann.y > lowerRow && ann.y < upperRow);
  assert.ok(boson.y > lowerRow && boson.y < upperRow);
  assert.ok(approximatelyEqual(ann.y, partonCenter));
  assert.ok(approximatelyEqual(boson.y, leptonCenter));
  assert.ok(approximatelyEqual(ann.y, boson.y));
  assert.ok(q.x < ann.x);
  assert.ok(qbar.x < ann.x);
  assert.ok(ann.x < boson.x);
  assert.ok(boson.x < lminus.x);
  assert.ok(boson.x < lplus.x);
}

async function testLayeredLayoutKeepsSingleIncomingHorizontal() {
  const diagram = feynman.parseFeynman(`
layout layered
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\\mu^- numu:\\nu_\\mu nue:\\nu_e e:e^- w->v:W^-
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.positions.mu.y, layout.positions.w.y);
  assert.ok(layout.positions.w.y < layout.positions.v.y);
  assert.ok(layout.positions.numu.y < layout.positions.nue.y);
  assert.ok(layout.positions.nue.y < layout.positions.e.y);
}

async function testVisualDefaultsStayReadableAtRenderedScale() {
  assert.equal(feynman.visualDefaults.labelFontSize, 32);
  assert.equal(feynman.visualDefaults.edgeLabelFontSize, 26);
  assert.equal(feynman.visualDefaults.edgeStrokeWidth, 2.6);
  assert.equal(feynman.visualDefaults.gluonStrokeWidth, 2.1);
  assert.match(feynman.visualDefaults.labelFontFamily, /Latin Modern/);
  assert.match(feynman.visualDefaults.labelFontFamily, /serif$/);
  assert.equal(feynman.visualDefaults.labelFontStyle, "italic");
  assert.equal(feynman.visualDefaults.scriptFontSizePercent, 82);
  assert.equal(feynman.visualDefaults.edgeLabelOffset, 32);
  assert.equal(feynman.visualDefaults.momentumLabelGap, 20);
  assert.equal(feynman.visualDefaults.momentumArrowShorten, 0.22);
  assert.equal(feynman.visualDefaults.arrowMarkerWidth, 11);
  assert.equal(feynman.visualDefaults.arrowMarkerHeight, 11);
  assert.equal(feynman.visualDefaults.arrowPath, "M0,0 L8,4 L0,8 Z");
  assert.ok(feynman.visualDefaults.labelFontSize > feynman.visualDefaults.edgeLabelFontSize);
  assert.ok(feynman.visualDefaults.edgeLabelOffset > feynman.visualDefaults.edgeLabelFontSize);
  assert.ok(feynman.visualDefaults.arrowMarkerWidth > 2 * feynman.visualDefaults.edgeStrokeWidth);
}

async function testDocumentedExamplesParseAndLayout() {
  const examplesDir = path.join(__dirname, "..", "docs", "examples");
  const exampleFiles = fs
    .readdirSync(examplesDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => path.join(examplesDir, name));

  const blocks = [];
  for (const examplesPath of exampleFiles) {
    const examples = fs.readFileSync(examplesPath, "utf8");
    blocks.push(
      ...[...examples.matchAll(/```feynman\n([\s\S]*?)```/g)].map((match) => ({
        source: match[1],
        file: path.basename(examplesPath),
      })),
    );
  }

  assert.ok(blocks.length >= 20);

  for (const [index, block] of blocks.entries()) {
    const diagram = feynman.parseFeynman(block.source);

    assert.deepEqual(
      diagram.errors,
      [],
      `example block ${index + 1} in ${block.file} should parse`,
    );

    const layout = await feynman.layoutFeynman(diagram);

    assert.ok(
      layout.width > 0,
      `example block ${index + 1} in ${block.file} should have a width`,
    );
    assert.ok(
      layout.height > 0,
      `example block ${index + 1} in ${block.file} should have a height`,
    );
  }
}

async function main() {
  await testSampleDiagram();
  await testParserValidation();
  await testTikzOrientationParser();
  await testNativeAlignmentParser();
  await testTikzPostLayoutOrientation();
  await testTikzVerticalOrientationFansMixedTerminalPairs();
  await testHorizontalOrientationKeepsAnnihilationFans();
  await testDefaultSpringKeepsAnnihilationFans();
  await testUnclassifiedExternalTerminalsDoNotInventProcessRoles();
  await testMilestoneThreeCSymmetricUnclassifiedAnnihilationTree();
  await testMilestoneThreeCExplicitRoleAnnihilationStillProcess();
  await testMilestoneThreeCSymmetricUnclassifiedGammaLoop();
  await testMilestoneThreeCNoRoleGammaLoopMatchesExplicitRoleGeometry();
  await testMilestoneThreeCExplicitRoleGammaLoopStillProcess();
  await testMilestoneThreeCFermionArrowsDoNotChangeSymmetricRefinement();
  await testMilestoneThreeCMomentumDoesNotChangeSymmetricRefinement();
  await testMilestoneThreeCManualPositionsPreserved();
  await testMilestoneThreeCExplicitCurveAndLabelSidePreserved();
  await testMilestoneThreeCOneToOneTwoCenterUsesLeftRightPlacement();
  await testMilestoneThreeCThreeToThreeTwoCenterUsesLeftRightPlacement();
  await testMilestoneThreeCOddTwoCenterPlacesMedianAtCenter();
  await testMilestoneThreeCOddTotalPlacesMedianAtCenter();
  await testMilestoneThreeCUnequalTwoCenterSkipsWhenImbalanced();
  await testMilestoneThreeCAsymmetricTreeSkipsSymmetricRefinement();
  await testMilestoneThreeCSymmetricRefinementScoreFieldsAndDiagnostics();
  await testDeclaredExternalTerminalsDoNotClassifyOtherLeaves();
  await testMilestoneOneExplicitDecayProcessMode();
  await testMilestoneOneExplicitTwoToTwoProcessMode();
  await testFermionFlowConservationDetectsExternalFermionsAndCustomGraphs();
  await testFermionFlowContactStarStaysRecognized();
  await testMilestoneOneSymmetricUnclassifiedContact();
  await testMilestoneThreeEOddContactStarUsesReflectionAxis();
  await testMilestoneThreeESixLegContactStarIsUniformAndDeterministic();
  await testMilestoneThreeEExplicitRolesKeepProcessContactLayout();
  await testMilestoneThreeEContactArrowsAndEdgeSpellingDoNotInferProcess();
  await testMilestoneThreeEManualContactCenterPreserved();
  await testMilestoneThreeETikzVerticalRotatesContactStarWithoutSpringFallback();
  await testMilestoneOneAsymmetricUnclassifiedTree();
  await testMilestoneOneFermionFlowDoesNotControlLayoutDirection();
  await testMilestoneOneValidationAndDeterminism();
  await testMilestoneTwoDeclaredProcessExternalOrder();
  await testDeclaredProcessExternalOrderUsesCyclicBoundaryTraversal();
  await testMilestoneTwoFermionArrowDoesNotMirrorProcessLayout();
  await testMilestoneTwoMomentumDirectionDoesNotMoveLayout();
  await testMilestoneTwoLayeredPortDiagnosticsAreDeterministic();
  await testMilestoneTwoSelfEnergyBubblePlacesParallelArcsOppositeSides();
  await testMilestoneTwoParallelPropagatorsAreSeparatedAndDeterministic();
  await testMilestoneTwoScoreBreakdownIsFinite();
  await testMilestoneThreeTriangleLoopCandidateLayout();
  await testMilestoneThreeBoxLoopCandidateLayout();
  await testMilestoneThreeTadpoleLoopCandidateLayout();
  await testMilestoneThreeLoopCandidateSelectionIsDeterministic();
  await testMilestoneThreeFermionArrowsDoNotMoveLoopLayout();
  await testMilestoneThreeMomentumDirectionDoesNotMoveLoopLayout();
  await testMilestoneThreeBGenericPentagonLoopCandidateLayout();
  await testMilestoneThreeBVacuumOneLoopIsCenteredAndSymmetric();
  await testMilestoneThreeBLoopLabelsPreferOutsideTriangleAndBox();
  await testMilestoneThreeBMomentumLabelsPreferOutsideLoopEdges();
  await testMilestoneThreeBLabelScoreFieldsAndDiagnosticsAreFinite();
  await testMilestoneThreeBAddingLabelsDoesNotChangeTopologyClassification();
  await testMilestoneThreeBManualPositionsSurviveLabelScoring();
  await testMilestoneThreeBExplicitCurveAndLabelSideArePreserved();
  await testMilestoneThreeDLabelPlacementRunsAndReportsDiagnostics();
  await testMilestoneThreeDNodeLabelAvoidsPropagator();
  await testMilestoneThreeDExplicitMomentumSideIsPreserved();
  await testMilestoneThreeDPlacementIsDeterministicAndDoesNotChangeTopology();
  await testMilestoneFourMultiloopTopologyDecomposition();
  await testMilestoneFourSharedVertexTwoLoopLayoutCandidate();
  await testMilestoneFourSharedVertexTwoLoopWithExternalLegsIsReadable();
  await testMilestoneFourOverlappingTwoLoopLayoutCandidate();
  await testMilestoneFourDisconnectedVacuumMultiloopLayoutCandidate();
  await testMilestoneFourThreeLoopChainFixturePacking();
  await testMilestoneFourContainedLoopsWithExternalLegsFixture();
  await testMilestoneFourOverlappingDenseLabelsFixture();
  await testMilestoneFourDisconnectedVacuumFixturePacking();
  await testMilestoneFourIncrementalAddRemoveLoopRegionFixture();
  await testMilestoneFourIncrementalLayoutPreservesSharedPositions();
  await testMilestoneFourProfileDebugIncludesStageTimings();
  await testLayoutApiAsyncAndFallbackSync();
  await testEdgeLabelsAndAllParticleTypes();
  await testTriangleSquareDoubleEdges();
  await testGluonPathTouchesEndpoints();
  await testGluonJunctionCaps();
  await testCyclicInternalLayoutStaysBounded();
  await testLatexLabelMarkup();
  await testLabelParserPreservesBracedSpaces();
  await testLayoutOptionsManualPositionsAndInvisibleEdges();
  await testHiddenEdgesAffectElkLayoutButDoNotRender();
  await testVerticalOrientationStacksScatteringVertices();
  await testSpringElectricalLayoutIsDistinctFromSpring();
  await testTreeLayoutPlacesBranchesByDepth();
  await testTreeLayoutCentersParentsOverChildren();
  await testTreeLayoutKeepsDeclaredOutgoingLeavesOnOutgoingSide();
  await testVertexShapes();
  await testCurvedEdgesInlineLabelsAndBraces();
  await testAutomaticLoopExamplesNeedNoManualPositions();
  await testTwoEdgeLoopIsCircularAndKeepsMomentaOutside();
  await testMinimalPhotonExchangeAlignsInternalsAndStaysInViewBox();
  await testReversedMomentumFlipsArrowDirectionOnly();
  await testLayeredLayoutUsesAvailableCrossAxisForExternalLegs();
  await testSpringLayoutPreservesDeclaredOutgoingBoundaryOrder();
  await testSpringLayoutAlignsSimpleScatteringLanes();
  await testAlignVerticalOrdersNamedNodesByDeclaration();
  await testAlignVerticalSameLineConstraintPreservesLaneOrder();
  await testSpringLayoutKeepsDrellYanJunctionInsidePartonCorridor();
  await testLayeredLayoutKeepsSingleIncomingHorizontal();
  await testVisualDefaultsStayReadableAtRenderedScale();
  await testDocumentedExamplesParseAndLayout();

  console.log("feynman-diagrams tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
