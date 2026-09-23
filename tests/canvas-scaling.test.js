const assert = require("node:assert/strict");
const test = require("node:test");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

function fermionChainSource(edgeCount) {
  const lines = [];

  for (let i = 0; i < edgeCount; i += 1) {
    lines.push(`fermion v${i}->v${i + 1}`);
  }

  return lines.join("\n");
}

function minPairwiseDistance(positions) {
  const points = Object.values(positions);
  let min = Infinity;

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));

      min = Math.min(min, distance);
    }
  }

  return min;
}

test("default canvas grows to keep a long fermion chain's vertices apart", async () => {
  const diagram = feynman.parseFeynman(fermionChainSource(20));
  assert.equal(diagram.errors.length, 0);

  const layout = await feynman.layoutFeynman(diagram);

  assert.ok(
    layout.width > 520 || layout.height > 330,
    `expected the default canvas to grow beyond 520x330, got ${layout.width}x${layout.height}`
  );
  assert.ok(
    minPairwiseDistance(layout.positions) >= 30,
    `expected minimum vertex spacing >= 30px, got ${minPairwiseDistance(layout.positions)}`
  );
});

test("a small diagram keeps the default 520x330 medium canvas", async () => {
  const source = [
    "incoming a b",
    "outgoing c d",
    "fermion a->v b->v v->w",
    "photon w->c w->d",
  ].join("\n");
  const diagram = feynman.parseFeynman(source);
  assert.equal(diagram.errors.length, 0);

  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(layout.width, 520);
  assert.equal(layout.height, 330);
  assert.ok(
    !layout.diagnostics.some((diagnostic) => diagnostic.code === "crowded-layout"),
    "a diagram that fits comfortably should not emit a crowded-layout warning"
  );
});

test("explicit width/height on a crowded diagram is never overridden, and warns instead", async () => {
  const source = `options width=520 height=330\n${fermionChainSource(30)}`;
  const diagram = feynman.parseFeynman(source);
  assert.equal(diagram.errors.length, 0);

  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(layout.width, 520);
  assert.equal(layout.height, 330);

  const crowded = layout.diagnostics.find((diagnostic) => diagnostic.code === "crowded-layout");
  assert.ok(crowded, "expected a crowded-layout diagnostic when explicit sizing leaves vertices overlapping");
  assert.equal(crowded.severity, "warning");
  assert.ok(Number.isFinite(crowded.data.minDistance));
  assert.ok(crowded.data.minDistance < crowded.data.threshold);
});

test("an explicit size preset is never grown even when crowded", async () => {
  const source = `size small\n${fermionChainSource(30)}`;
  const diagram = feynman.parseFeynman(source);
  assert.equal(diagram.errors.length, 0);

  const layout = await feynman.layoutFeynman(diagram);

  assert.equal(layout.width, 420);
  assert.equal(layout.height, 280);
});
