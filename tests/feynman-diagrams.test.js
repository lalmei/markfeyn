const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

function testSampleDiagram() {
  const source = `
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
scalar i2->v2 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1:γ
`;

  const diagram = feynman.parseFeynman(source);
  assert.equal(diagram.errors.length, 0);
  assert.deepEqual(diagram.incoming, ["i1", "i2"]);
  assert.deepEqual(diagram.outgoing, ["o1", "o2"]);
  assert.equal(diagram.edges.length, 5);
  assert.equal(diagram.labels.i1, "e⁻");
  assert.equal(diagram.labels.v1, "γ");

  const layout = feynman.layoutFeynman(diagram);
  assert.equal(layout.width, 720);
  assert.equal(layout.height, 260);
  ["i1", "i2", "v1", "v2", "o1", "o2"].forEach((node) => {
    assert.ok(layout.positions[node], `${node} should have a position`);
  });
  assert.equal(layout.positions.i1.kind, "incoming");
  assert.equal(layout.positions.o1.kind, "outgoing");
  assert.equal(layout.positions.v1.kind, "internal");

  assert.ok(layout.positions.i1.x < layout.positions.v1.x);
  assert.ok(layout.positions.v2.x < layout.positions.o1.x);
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
    ["fermion", "fermion", "gluon", "photon", "scalar"]
  );
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

testSampleDiagram();
testParserValidation();
testEdgeLabelsAndAllParticleTypes();
testCyclicInternalLayoutStaysBounded();

console.log("feynman-diagrams tests passed");
