const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

test("fermion a-->b produces error mentioning ->", () => {
  const diagram = feynman.parseFeynman("fermion a-->b");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /invalid fermion edge "a-->b"/);
  assert.match(diagram.errors[0], /->/);
  // Verify that "a-" is not parsed as a vertex
  assert.equal(Object.keys(diagram.vertices).length, 0);
  assert.equal(diagram.edges.length, 0);
});

test("fermion a->-b produces error for invalid identifier", () => {
  const diagram = feynman.parseFeynman("fermion a->-b");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /invalid fermion edge "a->-b"/);
  // Should mention ASCII restriction
  assert.match(diagram.errors[0], /ASCII|vertex names/);
  assert.equal(diagram.edges.length, 0);
});

test("fermion α->β produces error mentioning ASCII", () => {
  const diagram = feynman.parseFeynman("fermion α->β");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /invalid fermion edge "α->β"/);
  assert.match(diagram.errors[0], /ASCII/);
  assert.equal(diagram.edges.length, 0);
});

test("fermion a-b->c parses correctly (hyphen in middle allowed)", () => {
  const diagram = feynman.parseFeynman("fermion a-b->c");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges.length, 1);
  assert.equal(diagram.edges[0].from, "a-b");
  assert.equal(diagram.edges[0].to, "c");
});

test("fermion e.1->q_2 parses correctly (dot and underscore allowed)", () => {
  const diagram = feynman.parseFeynman("fermion e.1->q_2");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges.length, 1);
  assert.equal(diagram.edges[0].from, "e.1");
  assert.equal(diagram.edges[0].to, "q_2");
});

test("fermion a->b still works (basic case)", () => {
  const diagram = feynman.parseFeynman("fermion a->b");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges.length, 1);
  assert.equal(diagram.edges[0].from, "a");
  assert.equal(diagram.edges[0].to, "b");
});

test("fermion a.->b produces error (no trailing dot)", () => {
  const diagram = feynman.parseFeynman("fermion a.->b");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /invalid fermion edge "a.->b"/);
  assert.equal(diagram.edges.length, 0);
});

test("fermion -a->b produces error (no leading hyphen)", () => {
  const diagram = feynman.parseFeynman("fermion -a->b");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /invalid fermion edge "-a->b"/);
  assert.equal(diagram.edges.length, 0);
});

test("fermion a->b. produces error (no trailing dot)", () => {
  const diagram = feynman.parseFeynman("fermion a->b.");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /invalid fermion edge "a->b\."/);
  assert.equal(diagram.edges.length, 0);
});

test("fermion a->b- produces error (no trailing hyphen)", () => {
  const diagram = feynman.parseFeynman("fermion a->b-");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /invalid fermion edge "a->b-"/);
  assert.equal(diagram.edges.length, 0);
});

test("fermion a_->b parses correctly (underscore at end allowed)", () => {
  const diagram = feynman.parseFeynman("fermion a_->b");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges.length, 1);
  assert.equal(diagram.edges[0].from, "a_");
  assert.equal(diagram.edges[0].to, "b");
});

test("fermion a->b_ parses correctly (underscore at end allowed)", () => {
  const diagram = feynman.parseFeynman("fermion a->b_");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges.length, 1);
  assert.equal(diagram.edges[0].from, "a");
  assert.equal(diagram.edges[0].to, "b_");
});

test("fermion a0->b9 parses correctly (digits allowed)", () => {
  const diagram = feynman.parseFeynman("fermion a0->b9");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges.length, 1);
  assert.equal(diagram.edges[0].from, "a0");
  assert.equal(diagram.edges[0].to, "b9");
});

test("plain photon anti fermion edge specs all use correct identifier pattern", () => {
  const diagram = feynman.parseFeynman("plain e.1->q_2\nphoton x-y->z\nanti fermion a1->b.2");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.edges.length, 3);
  assert.equal(diagram.edges[0].from, "e.1");
  assert.equal(diagram.edges[0].to, "q_2");
  assert.equal(diagram.edges[1].from, "x-y");
  assert.equal(diagram.edges[1].to, "z");
  assert.equal(diagram.edges[2].from, "a1");
  assert.equal(diagram.edges[2].to, "b.2");
});

test("brace command uses correct identifier pattern", () => {
  const diagram = feynman.parseFeynman("brace a.1->b_2[left]:Label");
  assert.equal(diagram.errors.length, 0);
  assert.equal(diagram.braces.length, 1);
  assert.equal(diagram.braces[0].from, "a.1");
  assert.equal(diagram.braces[0].to, "b_2");
  assert.equal(diagram.braces[0].label, "Label");
});

test("brace command rejects invalid identifiers", () => {
  const diagram = feynman.parseFeynman("brace a-->b-[left]:Label");
  assert.equal(diagram.errors.length, 1);
  assert.match(diagram.errors[0], /braces must use/);
});

test("--> inside edge options does not trigger the arrow hint", () => {
  const diagram = feynman.parseFeynman('fermion a->b[label="x-->y"]');
  assert.deepEqual(diagram.errors, []);
  assert.equal(diagram.edges.length, 1);
});
