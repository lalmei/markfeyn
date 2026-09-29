const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  angleDegrees,
  pointDistance,
  approximatelyEqual,
  assertContactStarUniform,
  assertMirroredAcrossVertical,
  positionSignature,
  labelPlacementEntry,
  assertFiniteLabelPlacement,
  assertFiniteScore,
} = require("./helpers/feynman.js");

test("fermion flow conservation detects external fermions and custom graphs", async () => {
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
});

test("fermion flow contact star stays recognized", async () => {
  const diagram = feynman.parseFeynman(`
fermion a->v b->v c->v d->v
`);
  const layout = await feynman.layoutFeynman(diagram);
  const flow = layout.analysis.topology.fermionFlow;

  assert.equal(layout.analysis.topology.detectedTopology, "contactInteraction");
  assert.equal(flow.conserved, false);
  assert.equal(flow.customGraph, false);
  assert.equal(flow.externalFermionCount, 4);
});

test("milestone one symmetric unclassified contact", async () => {
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
});

test("milestone three e odd contact star uses reflection axis", async () => {
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
});

test("milestone three e six leg contact star is uniform and deterministic", async () => {
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
});

test("milestone three e explicit roles keep process contact layout", async () => {
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
});

test("milestone three e contact arrows and edge spelling do not infer process", async () => {
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
});

test("milestone three e manual contact center preserved", async () => {
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
});

test("milestone three e tikz vertical rotates contact star without spring fallback", async () => {
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
});
