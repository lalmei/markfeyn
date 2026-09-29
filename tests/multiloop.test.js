const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  readLayoutFixture,
  pointDistance,
  positionSignature,
  polygonArea,
  boundingBox,
  selectedLoopRegions,
  assertSelectedLoopRegionsNonDegenerate,
  assertSelectedDisjointRegionsDoNotOverlap,
  assertFiniteScore,
} = require("./helpers/feynman.js");

test("milestone four multiloop topology decomposition", async () => {
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
});

test("milestone four shared vertex two loop layout candidate", async () => {
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
});

test("milestone four shared vertex two loop with external legs is readable", async () => {
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
});

test("milestone four overlapping two loop layout candidate", async () => {
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
});

test("milestone four disconnected vacuum multiloop layout candidate", async () => {
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
});

test("milestone four three loop chain fixture packing", async () => {
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
});

test("milestone four contained loops with external legs fixture", async () => {
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
});

test("milestone four overlapping dense labels fixture", async () => {
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
});

test("milestone four disconnected vacuum fixture packing", async () => {
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
});

test("milestone four incremental add remove loop region fixture", async () => {
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
});

test("milestone four incremental layout preserves shared positions", async () => {
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
});

test("milestone four profile debug includes stage timings", async () => {
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
});
