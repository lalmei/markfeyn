const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");
const { edgeCrossings } = require("./helpers/feynman.js");

const ORIENTATIONS = ["vertical", "vertical-reverse", "horizontal", "default"];

// A 2->2 t-channel exchange is planar under the clockwise boundary contract
// (left bottom-to-top, right top-to-bottom) only when each fermion line's
// terminals are adjacent around the boundary, i.e. the declared orders are
// [e positron]/[positron2 electron] or [positron e]/[electron positron2].
const CASES = [
  { incoming: "e positron", outgoing: "positron2 electron", planar: true },
  { incoming: "positron e", outgoing: "electron positron2", planar: true },
  { incoming: "e positron", outgoing: "electron positron2", planar: false },
  { incoming: "positron e", outgoing: "positron2 electron", planar: false },
];

async function crossingsFor(incoming, outgoing, orientation) {
  const diagram = feynman.parseFeynman(`
${orientation === "default" ? "" : `orientation ${orientation}`}
incoming ${incoming}
outgoing ${outgoing}
fermion e->a a->electron
photon a->b
fermion positron2->b b->positron
`);
  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(diagram.errors.length, 0);

  return edgeCrossings(diagram, layout);
}

test("2->2 exchange has no crossing when the declared boundary order is planar", async () => {
  for (const { incoming, outgoing, planar } of CASES.filter((entry) => entry.planar)) {
    for (const orientation of ORIENTATIONS) {
      const crossings = await crossingsFor(incoming, outgoing, orientation);

      assert.deepEqual(crossings, [], `in[${incoming}] out[${outgoing}] ${orientation} (planar=${planar})`);
    }
  }
});

test("vertical orientations cross exactly when default orientation must cross", async () => {
  for (const { incoming, outgoing } of CASES) {
    const expected = (await crossingsFor(incoming, outgoing, "default")).length;

    for (const orientation of ORIENTATIONS) {
      const crossings = await crossingsFor(incoming, outgoing, orientation);

      assert.equal(crossings.length, expected, `in[${incoming}] out[${outgoing}] ${orientation}`);
    }
  }
});
