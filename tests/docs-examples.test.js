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

  exampleFiles.push(path.join(examplesDir, "..", "index.md"));
  const blocks = [];
  for (const examplesPath of exampleFiles) {
    const examples = fs.readFileSync(examplesPath, "utf8")
      .replace(/^([ \t]*)````[^\n]*\n[\s\S]*?^\1````$/gm, "");
    blocks.push(
      ...[...examples.matchAll(/^([ \t]*)```feynman\n([\s\S]*?)^\1```$/gm)].map((match) => ({
        source: match[2],
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

test("landing page uses reverse arrows for both antiparticle legs", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "docs", "index.md"), "utf8");
  const diagram = feynman.parseFeynman(source.match(/^```feynman\n([\s\S]*?)^```$/m)[1]);
  const antiparticles = diagram.edges.filter(({ from, to }) => from === "i2" || to === "o2");

  assert.equal(antiparticles.length, 2);
  assert.ok(antiparticles.every(({ arrow }) => arrow === "reverse"));
});

test("scattering and literature examples show the source they render", () => {
  for (const file of ["scattering-decays.md", "from-the-literature.md"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", "docs", "examples", file), "utf8");
    const copies = [];
    const liveSource = source.replace(/^([ \t]*)````[^\n]*\n([\s\S]*?)^\1````$/gm, (_, indent, body) => {
      const block = body.match(/^\s*```feynman\n([\s\S]*?)^\s*```$/m);

      if (block) {
        copies.push(normalizeExample(block[1]));
      }

      return "";
    });
    const live = [...liveSource.matchAll(/^([ \t]*)```feynman\n([\s\S]*?)^\1```$/gm)]
      .map((match) => normalizeExample(match[2]));

    assert.deepEqual(copies, live, file);
  }
});

function normalizeExample(source) {
  return source.trim().split("\n").map((line) => line.trim()).join("\n");
}
