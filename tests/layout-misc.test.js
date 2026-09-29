const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const {
  edgePathBounds,
} = require("./helpers/feynman.js");

test("layout api async and fallback sync", async () => {
  const diagram = feynman.parseFeynman("fermion a->b");
  const promise = feynman.layoutFeynman(diagram);
  const fallback = feynman.layoutFeynmanFallbackSync(diagram);
  const layout = await promise;

  assert.equal(typeof promise.then, "function");
  assert.equal(typeof fallback.then, "undefined");
  assert.ok(layout.positions.a);
  assert.ok(fallback.positions.a);
});

test("layout options manual positions and invisible edges", async () => {
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
});

test("hidden edges affect elk layout but do not render", async () => {
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
});

test("spring electrical layout is distinct from spring", async () => {
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
});

test("tree layout places branches by depth", async () => {
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
});

test("tree layout centers parents over children", async () => {
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
});

test("tree layout keeps declared outgoing leaves on outgoing side", async () => {
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
});

test("minimal photon exchange aligns internals and stays in view box", async () => {
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
});
