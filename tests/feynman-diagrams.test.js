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

function testSampleDiagram() {
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

  const layout = feynman.layoutFeynman(diagram);
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

function testParserValidation() {
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

function testEdgeLabelsAndAllParticleTypes() {
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
  const layout = feynman.layoutFeynman(diagram, { width: 600, height: 300 });

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

function testCyclicInternalLayoutStaysBounded() {
  const cyclic = feynman.parseFeynman(`
incoming i1
outgoing o1
fermion i1->v1
photon v1->v2 v2->v1
fermion v2->o1
`);
  const cyclicLayout = feynman.layoutFeynman(cyclic);
  assert.ok(cyclicLayout.positions.v1.x > 0);
  assert.ok(cyclicLayout.positions.v1.x < cyclicLayout.width);
  assert.ok(cyclicLayout.positions.v2.x > 0);
  assert.ok(cyclicLayout.positions.v2.x < cyclicLayout.width);
}

function testLatexLabelMarkup() {
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

function testLayoutOptionsManualPositionsAndInvisibleEdges() {
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
  const layout = feynman.layoutFeynman(diagram);

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

function testVerticalOrientationStacksScatteringVertices() {
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
  const layout = feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.options.orientation, "vertical");
  assert.ok(layout.width < layout.height);
  assert.equal(layout.positions.e.x, layout.positions.positron.x);
  assert.equal(layout.positions.electron.x, layout.positions.positron2.x);
  assert.ok(layout.positions.e.x < layout.positions.a.x);
  assert.ok(layout.positions.b.x < layout.positions.positron2.x);
  assert.ok(layout.positions.e.y < layout.positions.a.y);
  assert.ok(layout.positions.a.y < layout.positions.b.y);
  assert.ok(layout.positions.b.y < layout.positions.positron.y);
  assert.ok(Math.abs(layout.positions.a.x - layout.positions.b.x) < 2);
  assert.equal(layout.positions.e.labelSide, "left");
  assert.equal(layout.positions.positron.labelSide, "left");
  assert.equal(layout.positions.electron.labelSide, "right");
  assert.equal(layout.positions.positron2.labelSide, "right");
}

function testSpringElectricalLayoutIsDistinctFromSpring() {
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
  const springLayout = feynman.layoutFeynman(spring);
  const electricalLayout = feynman.layoutFeynman(electrical);

  assert.equal(spring.errors.length, 0);
  assert.equal(electrical.errors.length, 0);
  assert.equal(dashedAlias.errors.length, 0);
  assert.equal(spring.options.layout, "spring");
  assert.equal(electrical.options.layout, "spring-electrical");
  assert.equal(dashedAlias.options.layout, "spring-electrical");
  assert.ok(Math.abs(electricalLayout.positions.w.y - springLayout.positions.w.y) > 1);
}

function testTreeLayoutPlacesBranchesByDepth() {
  const diagram = feynman.parseFeynman(`
layout tree
incoming a
outgoing b c d
fermion a->v v->b v->c v->d
`);
  const layout = feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(layout.positions.a.x < layout.positions.v.x);
  assert.ok(layout.positions.v.x < layout.positions.b.x);
  assert.equal(layout.positions.b.kind, "outgoing");
  assert.equal(layout.positions.c.labelSide, "right");
  assert.equal(layout.positions.a.y, layout.positions.v.y);
}

function testTreeLayoutCentersParentsOverChildren() {
  const diagram = feynman.parseFeynman(`
layout tree
incoming a
fermion a->b b->c b->d d->e d->f
`);
  const layout = feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(layout.positions.a.x < layout.positions.b.x);
  assert.ok(layout.positions.b.x < layout.positions.c.x);
  assert.ok(layout.positions.c.y < layout.positions.d.y);
  assert.ok(layout.positions.e.y < layout.positions.f.y);
  assert.equal(layout.positions.d.y, (layout.positions.e.y + layout.positions.f.y) / 2);
  assert.equal(layout.positions.b.y, (layout.positions.c.y + layout.positions.d.y) / 2);
}

function testTreeLayoutKeepsDeclaredOutgoingLeavesOnOutgoingSide() {
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
  const layout = feynman.layoutFeynman(diagram);

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

function testVertexShapes() {
  const diagram = feynman.parseFeynman(`
incoming a
outgoing b
fermion a->v v->blob blob->disk disk->x x->b
vertex v:dot blob:blob disk:large-blob x:crossed-dot a:empty-dot b:square-dot
`);
  const layout = feynman.layoutFeynman(diagram);

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
  const unstyledLayout = feynman.layoutFeynman(unstyled);

  assert.equal(unstyled.errors.length, 0);
  assert.equal(unstyled.vertices.v, undefined);
  assert.equal(unstyledLayout.positions.v.kind, "internal");

  const standalone = feynman.parseFeynman(`
options width=300 height=220
position c 150 110
vertex c:cross
label c:X
`);
  const standaloneLayout = feynman.layoutFeynman(standalone);

  assert.equal(standalone.errors.length, 0);
  assert.equal(standalone.vertices.c, "cross");
  assert.equal(standaloneLayout.positions.c.x, 150);
  assert.equal(standaloneLayout.positions.c.y, 110);
}

function testCurvedEdgesInlineLabelsAndBraces() {
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
  const layout = feynman.layoutFeynman(diagram);

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

function testAutomaticLoopExamplesNeedNoManualPositions() {
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

  examples.forEach((source) => {
    const diagram = feynman.parseFeynman(source);
    const layout = feynman.layoutFeynman(diagram);
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
  });
}

function testTwoEdgeLoopIsCircularAndKeepsMomentaOutside() {
  const diagram = feynman.parseFeynman(`
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\\gamma gamma2:\\gamma
`);
  const layout = feynman.layoutFeynman(diagram);
  const topEdge = diagram.edges[2];
  const bottomEdge = diagram.edges[3];
  const a = layout.positions.a;
  const b = layout.positions.b;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const baselineY = (a.y + b.y) / 2;
  const topMidpoint = cubicMidpoint(feynman.edgePath(topEdge, a, b));
  const bottomMidpoint = cubicMidpoint(feynman.edgePath(bottomEdge, b, a));
  const topLabel = feynman.edgeLabelPosition(topEdge, a, b, topEdge.labelSide);
  const bottomLabel = feynman.edgeLabelPosition(bottomEdge, b, a, bottomEdge.labelSide);
  const topArrow = feynman.momentumArrowGeometry(topEdge, a, b);
  const bottomArrow = feynman.momentumArrowGeometry(bottomEdge, b, a);
  const topArrowMidpoint = topArrow.points[Math.floor(topArrow.points.length / 2)];
  const bottomArrowMidpoint = bottomArrow.points[Math.floor(bottomArrow.points.length / 2)];

  assert.equal(diagram.errors.length, 0);
  assert.ok(Math.abs((baselineY - topMidpoint.y) - chord / 2) < 0.25);
  assert.ok(Math.abs((bottomMidpoint.y - baselineY) - chord / 2) < 0.25);
  assert.ok(topLabel.y < topMidpoint.y);
  assert.ok(bottomLabel.y > bottomMidpoint.y);
  assert.ok(topArrow.end.x > topArrow.start.x);
  assert.ok(bottomArrow.end.x < bottomArrow.start.x);
  assert.ok(Math.abs(topArrow.end.x - topArrow.start.x) < chord * 0.8);
  assert.ok(Math.abs(bottomArrow.end.x - bottomArrow.start.x) < chord * 0.8);
  assert.ok(topLabel.y < topArrow.end.y);
  assert.ok(bottomLabel.y > bottomArrow.end.y);
  assert.ok(topArrowMidpoint.y - topLabel.y >= 18);
  assert.ok(bottomLabel.y - bottomArrowMidpoint.y >= 18);
}

function testReversedMomentumFlipsArrowDirectionOnly() {
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

function testLayeredLayoutUsesAvailableCrossAxisForExternalLegs() {
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
  const layout = feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.positions.b.y, layout.options.marginY);
  assert.equal(layout.positions.c.y, layout.height / 2);
  assert.equal(layout.positions.d.y, layout.height - layout.options.marginY);
  assert.equal(layout.positions.a.y, layout.positions.cross.y);
  assert.ok(layout.positions.d.y - layout.positions.b.y > 180);
  assert.ok(layout.positions.blob.y > layout.positions.cross.y);
}

function testSpringLayoutKeepsSingleTerminalLegsStraight() {
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
  const layout = feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.ok(Math.abs(layout.positions.pi0.y - layout.positions.t1.y) < 0.001);
  assert.ok(Math.abs(layout.positions.t2.y - layout.positions.gamma1.y) < 0.001);
  assert.ok(Math.abs(layout.positions.t3.y - layout.positions.gamma2.y) < 0.001);
  assert.ok(layout.positions.t2.x < layout.positions.gamma1.x);
  assert.ok(layout.positions.t3.x < layout.positions.gamma2.x);
}

function testLayeredLayoutKeepsSingleIncomingHorizontal() {
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
  const layout = feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);
  assert.equal(layout.positions.mu.y, layout.positions.w.y);
  assert.ok(layout.positions.numu.y < layout.positions.w.y);
  assert.ok(layout.positions.w.y < layout.positions.v.y);
  assert.ok(layout.positions.nue.y < layout.positions.e.y);
}

function testVisualDefaultsStayReadableAtRenderedScale() {
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

function testDocumentedExamplesParseAndLayout() {
  const examplesPath = path.join(__dirname, "..", "docs", "examples.md");
  const examples = fs.readFileSync(examplesPath, "utf8");
  const blocks = [...examples.matchAll(/```feynman\n([\s\S]*?)```/g)];

  assert.ok(blocks.length >= 20);

  blocks.forEach((match, index) => {
    const source = match[1];
    const diagram = feynman.parseFeynman(source);

    assert.deepEqual(diagram.errors, [], `example block ${index + 1} should parse`);

    const layout = feynman.layoutFeynman(diagram);

    assert.ok(layout.width > 0, `example block ${index + 1} should have a width`);
    assert.ok(layout.height > 0, `example block ${index + 1} should have a height`);
  });
}

testSampleDiagram();
testParserValidation();
testEdgeLabelsAndAllParticleTypes();
testCyclicInternalLayoutStaysBounded();
testLatexLabelMarkup();
testLayoutOptionsManualPositionsAndInvisibleEdges();
testVerticalOrientationStacksScatteringVertices();
testSpringElectricalLayoutIsDistinctFromSpring();
testTreeLayoutPlacesBranchesByDepth();
testTreeLayoutCentersParentsOverChildren();
testTreeLayoutKeepsDeclaredOutgoingLeavesOnOutgoingSide();
testVertexShapes();
testCurvedEdgesInlineLabelsAndBraces();
testAutomaticLoopExamplesNeedNoManualPositions();
testTwoEdgeLoopIsCircularAndKeepsMomentaOutside();
testReversedMomentumFlipsArrowDirectionOnly();
testLayeredLayoutUsesAvailableCrossAxisForExternalLegs();
testSpringLayoutKeepsSingleTerminalLegsStraight();
testLayeredLayoutKeepsSingleIncomingHorizontal();
testVisualDefaultsStayReadableAtRenderedScale();
testDocumentedExamplesParseAndLayout();

console.log("feynman-diagrams tests passed");
