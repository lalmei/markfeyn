const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  angleDegrees,
  pointDistance,
  positionSignature,
  symmetricUnclassifiedDiagnostic,
  assertFiniteScore,
} = require("./helpers/feynman.js");

test("default spring keeps annihilation fans", async () => {
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
});

test("unclassified external terminals do not invent process roles", async () => {
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
});

test("milestone three c symmetric unclassified annihilation tree", async () => {
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
});

test("milestone three c explicit role annihilation still process", async () => {
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
});

test("milestone three c symmetric unclassified gamma loop", async () => {
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
});

test("milestone three c no role gamma loop matches explicit role geometry", async () => {
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
});

test("milestone three c explicit role gamma loop still process", async () => {
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
});

test("milestone three c fermion arrows do not change symmetric refinement", async () => {
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
});

test("milestone three c momentum does not change symmetric refinement", async () => {
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
});

test("milestone three c manual positions preserved", async () => {
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
});

test("milestone three c explicit curve and label side preserved", async () => {
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
});

test("milestone three c one to one two center uses left right placement", async () => {
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
});

test("milestone three c three to three two center uses left right placement", async () => {
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
});

test("milestone three c odd two center places median at center", async () => {
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
});

test("milestone three c odd total places median at center", async () => {
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
});

async function unequalTwoCenterSkipsWhenImbalanced() {
  const diagram = feynman.parseFeynman(`
fermion root->a root->b b->c b->d b->e
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(diagnostic.data.applicable, false);
}

// The original suite ran this scenario under two names; keep both.
test("milestone three c unequal two center skips when imbalanced", unequalTwoCenterSkipsWhenImbalanced);

test("milestone three c asymmetric tree skips symmetric refinement", unequalTwoCenterSkipsWhenImbalanced);

test("milestone three c symmetric refinement score fields and diagnostics", async () => {
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
});

test("declared external terminals do not classify other leaves", async () => {
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
});

test("milestone one explicit decay process mode", async () => {
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
});

test("milestone one explicit two to two process mode", async () => {
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
});

test("milestone one asymmetric unclassified tree", async () => {
  const diagram = feynman.parseFeynman(`
fermion root->a root->b b->c b->d
`);
  const layout = await feynman.layoutFeynman(diagram);
  const diagnostic = symmetricUnclassifiedDiagnostic(layout);

  assert.equal(layout.analysis.topology.detectedTopology, "tree");
  assert.equal(layout.analysis.orientation.mode, "symmetric");
  assert.equal(diagnostic.data.applicable, true);
  assert.equal(diagnostic.data.centerExternal, "c");
});

test("milestone one fermion flow does not control layout direction", async () => {
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
});

test("milestone one validation and determinism", async () => {
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
});
