const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  positionSignature,
  pointInsidePolygon,
  loopPoints,
  loopCandidateDiagnostic,
  labelPlacementEntry,
  assertFiniteScore,
} = require("./helpers/feynman.js");

test("milestone three b loop labels prefer outside triangle and box", async () => {
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
});

test("milestone three b momentum labels prefer outside loop edges", async () => {
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
});

test("milestone three b label score fields and diagnostics are finite", async () => {
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
});

test("milestone three b adding labels does not change topology classification", async () => {
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
});

test("milestone three b manual positions survive label scoring", async () => {
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
});

test("milestone three b explicit curve and label side are preserved", async () => {
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
});

test("milestone three d label placement runs and reports diagnostics", async () => {
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
});

test("milestone three d node label avoids propagator", async () => {
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
});

test("milestone three d explicit momentum side is preserved", async () => {
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
});

test("milestone three d placement is deterministic and does not change topology", async () => {
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
});
