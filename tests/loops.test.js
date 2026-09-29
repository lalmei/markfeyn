const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  pathNumbers,
  cubicMidpoint,
  pointDistance,
  positionSignature,
  signedNormalDistance,
  polygonArea,
  polygonCenter,
  range,
  loopPoints,
  loopCandidateDiagnostic,
  assertFiniteScore,
} = require("./helpers/feynman.js");

test("milestone two self energy bubble places parallel arcs opposite sides", async () => {
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
});

test("milestone two parallel propagators are separated and deterministic", async () => {
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
});

test("milestone three triangle loop candidate layout", async () => {
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
});

test("milestone three box loop candidate layout", async () => {
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
});

test("milestone three tadpole loop candidate layout", async () => {
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
});

test("milestone three loop candidate selection is deterministic", async () => {
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
});

test("milestone three fermion arrows do not move loop layout", async () => {
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
});

test("milestone three momentum direction does not move loop layout", async () => {
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
});

test("milestone three b generic pentagon loop candidate layout", async () => {
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
});

test("milestone three b vacuum one loop is centered and symmetric", async () => {
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
});

test("cyclic internal layout stays bounded", async () => {
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
});

test("automatic loop examples need no manual positions", async () => {
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
});

test("two edge loop is circular and keeps momenta outside", async () => {
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
});
