const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  renderDiagramSvg,
  pathNumbers,
} = require("./helpers/feynman.js");

test("sample diagram", async () => {
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
});

test("edge labels and all particle types", async () => {
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
});

test("triangle square double edges", async () => {
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
});

test("gluon path touches endpoints", async () => {
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
});

test("gluon junction caps", async () => {
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
});

test("latex label markup", async () => {
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
});

test("vertex shapes", async () => {
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
});

test("curved edges inline labels and braces", async () => {
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
});

test("reversed momentum flips arrow direction only", async () => {
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
});

test("visual defaults stay readable at rendered scale", async () => {
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
});
