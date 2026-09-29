const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  angleDegrees,
  pointDistance,
  approximatelyEqual,
  positionSignature,
  acuteLineAngleDegrees,
  signedNormalDistance,
} = require("./helpers/feynman.js");

test("tikz post layout orientation", async () => {
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
});

test("tikz vertical orientation fans mixed terminal pairs", async () => {
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
});

test("horizontal orientation keeps annihilation fans", async () => {
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
});

test("milestone two declared process external order", async () => {
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
});

test("declared process external order uses cyclic boundary traversal", async () => {
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
});

test("milestone two fermion arrow does not mirror process layout", async () => {
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
});

test("milestone two momentum direction does not move layout", async () => {
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
});

test("milestone two layered port diagnostics are deterministic", async () => {
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
});

test("milestone two score breakdown is finite", async () => {
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
});

test("vertical orientation stacks scattering vertices", async () => {
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
});

test("layered layout uses available cross axis for external legs", async () => {
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
});

test("spring layout preserves declared outgoing boundary order", async () => {
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
});

test("spring layout aligns simple scattering lanes", async () => {
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
});

test("align vertical orders named nodes by declaration", async () => {
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
});

test("align vertical same line constraint preserves lane order", async () => {
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
});

test("spring layout keeps drell yan junction inside parton corridor", async () => {
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
});

test("layered layout keeps single incoming horizontal", async () => {
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
});
