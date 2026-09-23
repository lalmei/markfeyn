const test = require("node:test");
const assert = require("node:assert/strict");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

const TIME_BUDGET_MS = 2000;

function completePhotonGraphSource(vertexCount) {
  const nodes = [];

  for (let index = 1; index <= vertexCount; index += 1) {
    nodes.push(`v${index}`);
  }

  const pairs = [];

  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      pairs.push(`${nodes[left]}->${nodes[right]}`);
    }
  }

  return `photon ${pairs.join(" ")}`;
}

async function layoutCompleteGraph(vertexCount) {
  const diagram = feynman.parseFeynman(completePhotonGraphSource(vertexCount));
  const startedAt = Date.now();
  const layout = await feynman.layoutFeynman(diagram, {});
  const elapsedMs = Date.now() - startedAt;

  return { layout, elapsedMs };
}

function assertFinitePositions(layout) {
  const positions = layout.positions || {};
  const entries = Object.entries(positions);

  assert.ok(entries.length > 0, "expected at least one laid-out position");

  entries.forEach(([node, position]) => {
    assert.ok(
      Number.isFinite(position.x) && Number.isFinite(position.y),
      `expected finite position for node ${node}, got ${JSON.stringify(position)}`
    );
  });
}

function findTruncationDiagnostic(layout) {
  return (layout.diagnostics || []).find(
    (diagnostic) => diagnostic.data?.code === "cycle-enumeration-truncated"
  );
}

[8, 10, 14].forEach((vertexCount) => {
  test(`K${vertexCount} complete photon graph lays out within the time budget`, async () => {
    const { layout, elapsedMs } = await layoutCompleteGraph(vertexCount);

    assert.ok(
      elapsedMs < TIME_BUDGET_MS,
      `expected K${vertexCount} layout to finish under ${TIME_BUDGET_MS}ms, took ${elapsedMs}ms`
    );
    assertFinitePositions(layout);
  });
});

[10, 14].forEach((vertexCount) => {
  test(`K${vertexCount} complete photon graph reports a cycle-enumeration-truncated diagnostic`, async () => {
    const { layout } = await layoutCompleteGraph(vertexCount);
    const diagnostic = findTruncationDiagnostic(layout);

    assert.ok(
      diagnostic,
      `expected a cycle-enumeration-truncated diagnostic in layout.diagnostics for K${vertexCount}`
    );
    assert.equal(diagnostic.stage, "topology");
  });
});
