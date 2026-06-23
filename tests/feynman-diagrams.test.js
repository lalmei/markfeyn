const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

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
    ["horizontal a to b", { axis: "horizontal", from: "a", to: "b", flip: false, angle: 0 }],
    ["horizontal' a to b", { axis: "horizontal", from: "a", to: "b", flip: true, angle: 0 }],
    ["vertical a to b", { axis: "vertical", from: "a", to: "b", flip: false, angle: 90 }],
    ["vertical' a to b", { axis: "vertical", from: "a", to: "b", flip: true, angle: 90 }],
  ];

  cases.forEach(([line, expected]) => {
    const diagram = feynman.parseFeynman(`${line}\nfermion a->b`);

    assert.deepEqual(diagram.errors, []);
    assert.deepEqual(diagram.options.tikzOrientation, expected);
  });
}

async function testTikzPostLayoutOrientation() {
  const horizontal = feynman.parseFeynman(`
layout layered
horizontal a to b
fermion a->b a->c
`);
  const horizontalPrimed = feynman.parseFeynman(`
layout layered
horizontal' a to b
fermion a->b a->c
`);
  const vertical = feynman.parseFeynman(`
layout layered
vertical a to b
fermion a->b a->c
`);
  const verticalPrimed = feynman.parseFeynman(`
layout layered
vertical' a to b
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
vertical a to b
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
  assert.ok(pointDistance(b, positron) > 120);
  assert.ok(pointDistance(positron2, b) > 120);
  assert.ok(acuteLineAngleDegrees(e, a) < 42);
  assert.ok(acuteLineAngleDegrees(a, electron) < 42);
  assert.ok(e.y < a.y);
  assert.ok(electron.y < a.y);
  assert.ok(positron.y > b.y);
  assert.ok(positron2.y > b.y);
  assert.ok(e.x < a.x);
  assert.ok(electron.x > a.x);
  assert.ok(positron.x < b.x);
  assert.ok(positron2.x > b.x);
  assert.ok(signedNormalDistance(e, a, b) * signedNormalDistance(electron, a, b) < 0);
  assert.ok(signedNormalDistance(positron, a, b) * signedNormalDistance(positron2, a, b) < 0);
}

async function testHorizontalOrientationKeepsAnnihilationFans() {
  const diagram = feynman.parseFeynman(`
horizontal ann to prod
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
  assert.ok(layout.positions.e_minus.y < ann.y);
  assert.ok(layout.positions.e_plus.y > ann.y);
  assert.ok(layout.positions.mu_plus.y < prod.y);
  assert.ok(layout.positions.mu_minus.y > prod.y);
}

async function testLayoutInfersExternalTerminalsFromTopology() {
  const diagram = feynman.parseFeynman(`
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

  assert.deepEqual(diagram.incoming, []);
  assert.deepEqual(diagram.outgoing, []);
  assert.equal(layout.positions.e_minus.kind, "incoming");
  assert.equal(layout.positions.e_plus.kind, "incoming");
  assert.equal(layout.positions.mu_plus.kind, "outgoing");
  assert.equal(layout.positions.mu_minus.kind, "outgoing");
  assert.ok(layout.positions.e_minus.x < ann.x);
  assert.ok(layout.positions.e_plus.x < ann.x);
  assert.ok(prod.x < layout.positions.mu_plus.x);
  assert.ok(prod.x < layout.positions.mu_minus.x);
  assert.ok(Math.abs(angleDegrees(ann, prod)) < 0.001);
  assert.ok(layout.positions.e_minus.y < ann.y);
  assert.ok(layout.positions.e_plus.y > ann.y);
  assert.ok(layout.positions.mu_plus.y < prod.y);
  assert.ok(layout.positions.mu_minus.y > prod.y);
}

async function testDeclaredExternalTerminalsOverrideInference() {
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
  assert.equal(layout.positions.e_minus.kind, "incoming");
  assert.equal(layout.positions.e_plus.kind, "incoming");
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
  assert.ok(Math.abs(layout.positions.e.y - layout.positions.a.y) < 0.001);
  assert.ok(Math.abs(layout.positions.positron.y - layout.positions.b.y) < 0.001);
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
  assert.ok(Math.abs(electricalLayout.positions.w.y - springLayout.positions.w.y) > 1);
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
vertex blob:blob[hatch=diagonal,size=24] disk:disk[pattern="north west lines",radius=52] tall:blob[hatch=grid,diameter=60]
`);

  assert.deepEqual(customized.errors, []);
  assert.deepEqual(customized.vertices.blob, { shape: "blob", hatch: "diagonal", size: 24 });
  assert.deepEqual(customized.vertices.disk, { shape: "disk", hatch: "diagonal-reverse", size: 52 });
  assert.deepEqual(customized.vertices.tall, { shape: "blob", hatch: "grid", size: 30 });

  const invalid = feynman.parseFeynman(`
position v 100 100
vertex v:dot[hatch=cross] bad:blob[hatch=zigzag] tiny:blob[size=0]
`);

  assert.equal(invalid.errors.length, 3);
  assert.match(invalid.errors[0], /only supported for blob and disk/);
  assert.match(invalid.errors[1], /unsupported blob hatch/);
  assert.match(invalid.errors[2], /size must be a positive number or preset/);
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
  assert.ok(Math.abs(layout.positions.a.y - layout.positions.b.y) < 0.5);
  assert.ok(Math.abs(layout.positions.gamma1.y - layout.positions.a.y) < 0.5);
  assert.ok(Math.abs(layout.positions.gamma2.y - layout.positions.b.y) < 0.5);
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
  assert.equal(layout.positions.b.y, layout.positions.cross.y);
  assert.ok(layout.positions.d.y - layout.positions.b.y > 180);
  assert.ok(layout.positions.blob.y > layout.positions.cross.y);
}

async function testSpringLayoutKeepsSingleTerminalLegsStraight() {
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
  assert.ok(Math.abs(layout.positions.t2.y - layout.positions.gamma1.y) < 0.001);
  assert.ok(Math.abs(layout.positions.t3.y - layout.positions.gamma2.y) < 0.001);
  assert.ok(Math.abs(layout.positions.t2.x - layout.positions.t3.x) < 0.001);
  assert.ok(layout.positions.t2.x < layout.positions.gamma1.x);
  assert.ok(layout.positions.t3.x < layout.positions.gamma2.x);
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
  assert.ok(layout.positions.numu.y < layout.positions.w.y);
  assert.ok(layout.positions.w.y < layout.positions.v.y);
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
  const examplesPath = path.join(__dirname, "..", "docs", "examples.md");
  const examples = fs.readFileSync(examplesPath, "utf8");
  const blocks = [...examples.matchAll(/```feynman\n([\s\S]*?)```/g)];

  assert.ok(blocks.length >= 20);

  for (const [index, match] of blocks.entries()) {
    const source = match[1];
    const diagram = feynman.parseFeynman(source);

    assert.deepEqual(diagram.errors, [], `example block ${index + 1} should parse`);

    const layout = await feynman.layoutFeynman(diagram);

    assert.ok(layout.width > 0, `example block ${index + 1} should have a width`);
    assert.ok(layout.height > 0, `example block ${index + 1} should have a height`);
  }
}

async function main() {
  await testSampleDiagram();
  await testParserValidation();
  await testTikzOrientationParser();
  await testTikzPostLayoutOrientation();
  await testTikzVerticalOrientationFansMixedTerminalPairs();
  await testHorizontalOrientationKeepsAnnihilationFans();
  await testDefaultSpringKeepsAnnihilationFans();
  await testLayoutInfersExternalTerminalsFromTopology();
  await testDeclaredExternalTerminalsOverrideInference();
  await testLayoutApiAsyncAndFallbackSync();
  await testEdgeLabelsAndAllParticleTypes();
  await testGluonPathTouchesEndpoints();
  await testGluonJunctionCaps();
  await testCyclicInternalLayoutStaysBounded();
  await testLatexLabelMarkup();
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
  await testSpringLayoutKeepsSingleTerminalLegsStraight();
  await testLayeredLayoutKeepsSingleIncomingHorizontal();
  await testVisualDefaultsStayReadableAtRenderedScale();
  await testDocumentedExamplesParseAndLayout();

  console.log("feynman-diagrams tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
