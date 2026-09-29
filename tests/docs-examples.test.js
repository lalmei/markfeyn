const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

test("documented examples parse and layout", async () => {
  const examplesDir = path.join(__dirname, "..", "docs", "examples");
  const exampleFiles = fs
    .readdirSync(examplesDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => path.join(examplesDir, name));

  const blocks = [];
  for (const examplesPath of exampleFiles) {
    const examples = fs.readFileSync(examplesPath, "utf8");
    blocks.push(
      ...[...examples.matchAll(/```feynman\n([\s\S]*?)```/g)].map((match) => ({
        source: match[1],
        file: path.basename(examplesPath),
      })),
    );
  }

  assert.ok(blocks.length >= 20);

  for (const [index, block] of blocks.entries()) {
    const diagram = feynman.parseFeynman(block.source);

    assert.deepEqual(
      diagram.errors,
      [],
      `example block ${index + 1} in ${block.file} should parse`,
    );

    const layout = await feynman.layoutFeynman(diagram);

    assert.ok(
      layout.width > 0,
      `example block ${index + 1} in ${block.file} should have a width`,
    );
    assert.ok(
      layout.height > 0,
      `example block ${index + 1} in ${block.file} should have a height`,
    );
  }
});
