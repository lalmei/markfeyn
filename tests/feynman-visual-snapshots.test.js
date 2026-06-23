const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");

const ROOT = path.join(__dirname, "..");
const RENDERER_PATH = path.join(ROOT, "src", "markfeyn", "assets", "feynman-diagrams.js");
const FIXTURE_DIR = path.join(__dirname, "visual", "fixtures");
const SNAPSHOT_DIR = path.join(__dirname, "visual", "snapshots");
const UPDATE = process.env.MARKFEYN_UPDATE_VISUAL === "1";
const DEBUG = process.env.MARKFEYN_VISUAL_DEBUG === "1";
const renderer = loadRenderer();

function fixtureFiles() {
  return fs
    .readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".feynman"))
    .sort()
    .map((name) => path.join(FIXTURE_DIR, name));
}

async function renderFixture(source) {
  debug("render start");
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const testDocument = env.document;
  const pre = testDocument.createElement("pre");
  const code = testDocument.createElement("code");

  globalThis.document = testDocument;
  globalThis.window = env.window;
  code.className = "language-feynman";
  code.textContent = source.trim();
  pre.appendChild(code);
  testDocument.body.appendChild(pre);

  renderer.renderAll(testDocument);
  debug("renderAll returned");
  await waitForRender(testDocument);
  debug("render settled");

  const bodyMarkup = testDocument.body.innerHTML;

  assert.equal(
    bodyMarkup.includes("<figcaption class=\"feynman-diagram__errors\""),
    false,
    "fixture should render without errors",
  );

  const serialized = serializeSvgMarkup(bodyMarkup);

  debug(`serialized ${serialized.length} chars`);

  return serialized;
}

function loadRenderer() {
  debug("loading renderer");
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");

  globalThis.document = env.document;
  globalThis.window = env.window;

  const loaded = require(RENDERER_PATH);

  debug("renderer loaded");

  return loaded;
}

async function waitForRender(document) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));

    if (
      !document.querySelector(".feynman-diagram--loading")
      && document.querySelector(".feynman-diagram__svg")
    ) {
      return;
    }
  }

  throw new Error("Timed out waiting for visual fixture render");
}

function serializeSvgMarkup(markup) {
  const match = String(markup).match(/<svg\b[\s\S]*<\/svg>/);

  assert.ok(match, "rendered fixture should contain serialized SVG markup");

  return match[0]
    .replace(/></g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function snapshotPathFor(fixturePath) {
  return path.join(
    SNAPSHOT_DIR,
    `${path.basename(fixturePath, ".feynman")}.svg`,
  );
}

function diffMessage(expected, actual, snapshotPath) {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const max = Math.max(expectedLines.length, actualLines.length);

  for (let index = 0; index < max; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return [
        `Visual snapshot mismatch: ${path.relative(ROOT, snapshotPath)}`,
        `First differing line: ${index + 1}`,
        `Expected: ${expectedLines[index] ?? "<missing>"}`,
        `Actual:   ${actualLines[index] ?? "<missing>"}`,
        "Run MARKFEYN_UPDATE_VISUAL=1 node tests/feynman-visual-snapshots.test.js to update baselines.",
      ].join("\n");
    }
  }

  return `Visual snapshot mismatch: ${path.relative(ROOT, snapshotPath)}`;
}

async function main() {
  const fixtures = fixtureFiles();

  assert.ok(fixtures.length > 0, "visual fixtures should exist");

  if (UPDATE) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  for (const fixturePath of fixtures) {
    debug(`fixture ${path.basename(fixturePath)}`);
    const source = fs.readFileSync(fixturePath, "utf8");
    const actual = `${await renderFixture(source)}\n`;
    const snapshotPath = snapshotPathFor(fixturePath);

    if (UPDATE) {
      fs.writeFileSync(snapshotPath, actual);
      debug(`wrote ${path.basename(snapshotPath)}`);
      continue;
    }

    assert.ok(
      fs.existsSync(snapshotPath),
      `Missing visual snapshot ${path.relative(ROOT, snapshotPath)}. Run npm run update:visual.`,
    );

    const expected = fs.readFileSync(snapshotPath, "utf8");

    assert.equal(actual, expected, diffMessage(expected, actual, snapshotPath));
  }

  console.log(`visual snapshots passed (${fixtures.length} fixtures)`);
}

function debug(message) {
  if (DEBUG) {
    console.error(`[visual] ${message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
