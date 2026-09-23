"use strict";

/**
 * Renders the `.feynman` sources under docs/assets/readme/ into standalone
 * SVG files suitable for embedding as <img> tags in README.md.
 *
 * This reuses the same in-Node rendering approach as
 * tests/feynman-visual-snapshots.test.js (linkedom + the built browser
 * bundle), but post-processes the resulting SVG so it looks correct when
 * loaded as a plain image (GitHub strips the page and any external CSS from
 * an <img>-embedded SVG, so everything the diagram needs has to live inside
 * the SVG itself):
 *
 *   - the renderer's injected stylesheet (classes, currentColor, and the
 *     var(--md-...) fallbacks) is copied verbatim into a <style> element
 *     inside the SVG, so it resolves the same concrete colors the fallbacks
 *     already specify;
 *   - a white, rounded background rect is drawn behind the diagram so it
 *     stays legible in both GitHub's light and dark themes;
 *   - the SVG root gets an explicit xmlns (and xmlns:xlink) attribute, since
 *     linkedom does not serialize the default namespace and browsers refuse
 *     to render a namespace-less SVG loaded as an <img>.
 *
 * Usage: node scripts/render-readme-examples.js
 * (run via `npm run render:readme`, which builds the JS bundle first)
 */

const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");

const ROOT = path.join(__dirname, "..");
const RENDERER_PATH = path.join(ROOT, "src", "markfeyn", "assets", "feynman-diagrams.js");
const SOURCE_DIR = path.join(ROOT, "docs", "assets", "readme");

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const BACKGROUND_MARGIN = 12;
const BACKGROUND_RADIUS = 12;

async function main() {
  const sourceFiles = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith(".feynman"))
    .sort();

  if (sourceFiles.length === 0) {
    throw new Error(`No .feynman sources found in ${path.relative(ROOT, SOURCE_DIR)}`);
  }

  const written = [];

  for (const fileName of sourceFiles) {
    const sourcePath = path.join(SOURCE_DIR, fileName);
    const source = fs.readFileSync(sourcePath, "utf8");
    const svgMarkup = await renderStandaloneSvg(source);
    const outName = `${path.basename(fileName, ".feynman")}.svg`;
    const outPath = path.join(SOURCE_DIR, outName);

    fs.writeFileSync(outPath, svgMarkup);
    written.push(outPath);
  }

  for (const outPath of written) {
    console.log(`wrote ${path.relative(ROOT, outPath)}`);
  }
}

async function renderStandaloneSvg(source) {
  const renderer = loadRenderer();
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
  await waitForRender(testDocument);

  const figure = testDocument.querySelector(".feynman-diagram");
  const errors = figure && figure.querySelector(".feynman-diagram__errors");

  if (errors) {
    throw new Error(`Fixture rendered with errors: ${errors.textContent}`);
  }

  const svg = testDocument.querySelector("svg.feynman-diagram__svg");

  if (!svg) {
    throw new Error("Rendered fixture did not produce an <svg>");
  }

  const styleText = testDocument.getElementById("feynman-diagram-styles").textContent;

  return standaloneSvgMarkup(svg, styleText);
}

function standaloneSvgMarkup(svg, styleText) {
  const document = svg.ownerDocument;
  const width = Number(svg.getAttribute("width"));
  const height = Number(svg.getAttribute("height"));

  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("xmlns:xlink", XLINK_NS);

  const style = document.createElementNS(SVG_NS, "style");

  style.textContent = styleText;

  const background = document.createElementNS(SVG_NS, "rect");

  background.setAttribute("x", String(-BACKGROUND_MARGIN));
  background.setAttribute("y", String(-BACKGROUND_MARGIN));
  background.setAttribute("width", String(width + BACKGROUND_MARGIN * 2));
  background.setAttribute("height", String(height + BACKGROUND_MARGIN * 2));
  background.setAttribute("rx", String(BACKGROUND_RADIUS));
  background.setAttribute("fill", "#ffffff");

  // Widen the viewBox slightly so the background margin is visible instead
  // of being clipped at the SVG's own edge.
  svg.setAttribute(
    "viewBox",
    `${-BACKGROUND_MARGIN} ${-BACKGROUND_MARGIN} ${width + BACKGROUND_MARGIN * 2} ${height + BACKGROUND_MARGIN * 2}`,
  );
  svg.setAttribute("width", String(width + BACKGROUND_MARGIN * 2));
  svg.setAttribute("height", String(height + BACKGROUND_MARGIN * 2));

  const title = svg.querySelector("title");
  const insertBeforeNode = title ? title.nextSibling : svg.firstChild;

  svg.insertBefore(style, svg.firstChild);
  svg.insertBefore(background, insertBeforeNode ?? null);

  return `${svg.outerHTML}\n`;
}

function loadRenderer() {
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");

  globalThis.document = env.document;
  globalThis.window = env.window;

  // Each render uses a fresh document, so the renderer module (and its
  // internal per-call counters used for element ids) must be reloaded too,
  // otherwise ids collide across documents and rendering can throw.
  delete require.cache[require.resolve(RENDERER_PATH)];

  return require(RENDERER_PATH);
}

async function waitForRender(document) {
  // Wait on a time budget, not a tick count: ELK and canvas auto-growth
  // may need many event-loop turns on a loaded machine.
  for (const deadline = Date.now() + 10000; Date.now() < deadline;) {
    await new Promise((resolve) => setImmediate(resolve));

    if (
      !document.querySelector(".feynman-diagram--loading")
      && document.querySelector(".feynman-diagram__svg")
    ) {
      return;
    }
  }

  throw new Error("Timed out waiting for render");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
