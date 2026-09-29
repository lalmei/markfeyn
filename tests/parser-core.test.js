const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

test("parser validation", async () => {
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
});

test("tikz orientation parser", async () => {
  const cases = [
    ["tikz horizontal a to b", { axis: "horizontal", from: "a", to: "b", flip: false, angle: 0 }],
    ["tikz horizontal' a to b", { axis: "horizontal", from: "a", to: "b", flip: true, angle: 0 }],
    ["tikz vertical a to b", { axis: "vertical", from: "a", to: "b", flip: false, angle: 90 }],
    ["tikz vertical' a to b", { axis: "vertical", from: "a", to: "b", flip: true, angle: 90 }],
  ];

  cases.forEach(([line, expected]) => {
    const diagram = feynman.parseFeynman(`${line}\nfermion a->b`);

    assert.deepEqual(diagram.errors, []);
    assert.deepEqual(diagram.warnings, []);
    assert.deepEqual(diagram.options.tikzOrientation, expected);
  });

  const deprecated = feynman.parseFeynman("vertical a to b\nfermion a->b");

  assert.deepEqual(deprecated.errors, []);
  assert.match(deprecated.warnings[0], /deprecated/);
  assert.deepEqual(deprecated.options.tikzOrientation, { axis: "vertical", from: "a", to: "b", flip: false, angle: 90 });
});

test("native alignment parser", async () => {
  const diagram = feynman.parseFeynman(`
align vertical lepton_vertex struck
align horizontal pql parton struck jet
fermion pql->parton parton->struck struck->jet
`);

  assert.deepEqual(diagram.errors, []);
  assert.deepEqual(diagram.options.alignments, [
    { axis: "vertical", nodes: ["lepton_vertex", "struck"] },
    { axis: "horizontal", nodes: ["pql", "parton", "struck", "jet"] },
  ]);
});

test("label parser preserves braced spaces", async () => {
  const diagram = feynman.parseFeynman(`
label g1:g_{\\pi\\pi n} g2:g_{\\pi\\pi n} plain:ok tail:+...
`);
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.labels.g1, "g_{\\pi\\pi n}");
  assert.equal(diagram.labels.g2, "g_{\\pi\\pi n}");
  assert.equal(diagram.labels.plain, "ok");
  assert.equal(diagram.labels.tail, "+...");
  assert.equal(feynman.labelNeedsMathJax(diagram.labels.g1), true);
  assert.equal(
    feynman.mathJaxDisplayFontSize("feynman-diagram__label"),
    feynman.visualDefaults.labelFontSize * feynman.visualDefaults.mathLabelFontScale,
  );
  assert.equal(feynman.parseMathJaxSvgLength("2.5ex", 20), 20 * 2.5 * 0.431);
  assert.equal(feynman.parseMathJaxSvgLength("18px", 20), 18);
});
