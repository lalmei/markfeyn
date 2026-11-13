"use strict";

const fs = require("node:fs");
const { parseHTML } = require("linkedom");
const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
require("mathjax-full/js/input/tex/ams/AmsConfiguration.js");

const renderer = require("./feynman-diagrams.js");
const SVG_NS = "http://www.w3.org/2000/svg";
const BACKGROUND_MARGIN = 12;
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const math = mathjax.document("", {
  InputJax: new TeX({ packages: ["base", "ams"], formatError: (_jax, error) => { throw error; } }),
  OutputJax: new SVG({ fontCache: "none" }),
});

async function renderStandaloneSvg(source, { background = "white" } = {}) {
  const { document, window } = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  let mathError;

  globalThis.document = document;
  globalThis.window = window;
  window.MathJax = {
    async tex2svgPromise(tex, options) {
      try {
        const markup = adaptor.outerHTML(math.convert(tex, options));
        return parseHTML(`<!doctype html><html><body>${markup}</body></html>`).document;
      } catch (error) {
        mathError = error;
        throw error;
      }
    },
  };

  try {
    const svgRenderer = new renderer.SvgRenderer(renderer);
    const figure = await svgRenderer.renderFeynmanElement(source, 0);
    const errors = figure.querySelector(".feynman-diagram__errors");
    const svg = figure.querySelector(".feynman-diagram__svg");

    if (errors || !svg) {
      throw new Error((errors || figure).textContent);
    }

    await renderer.materializePendingMathLabels(svg);

    if (mathError) {
      throw new Error(`Invalid math label: ${mathError.message}`);
    }

    // Use the same stylesheet as the browser renderer.
    svgRenderer.renderAll(document);
    const styles = document.getElementById("feynman-diagram-styles").textContent;

    return standaloneMarkup(svg, styles, background);
  } finally {
    delete window.MathJax;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

function standaloneMarkup(svg, styles, background) {
  const document = svg.ownerDocument;
  const [left, top, width, height] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  const x = left - BACKGROUND_MARGIN;
  const y = top - BACKGROUND_MARGIN;
  const paddedWidth = width + 2 * BACKGROUND_MARGIN;
  const paddedHeight = height + 2 * BACKGROUND_MARGIN;
  const style = document.createElementNS(SVG_NS, "style");

  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  style.textContent = styles;

  svg.setAttribute("viewBox", `${x} ${y} ${paddedWidth} ${paddedHeight}`);
  svg.setAttribute("width", String(paddedWidth));
  svg.setAttribute("height", String(paddedHeight));
  svg.insertBefore(style, svg.firstChild);
  if (background === "white") {
    const rect = document.createElementNS(SVG_NS, "rect");
    for (const [name, value] of Object.entries({
      x, y, width: paddedWidth, height: paddedHeight, rx: 12, fill: "#ffffff",
    })) {
      rect.setAttribute(name, String(value));
    }
    svg.insertBefore(rect, svg.querySelector("title").nextSibling);
  }

  return `${svg.outerHTML}\n`;
}

module.exports = { renderStandaloneSvg };

if (require.main === module) {
  renderStandaloneSvg(fs.readFileSync(0, "utf8"), { background: process.argv[2] })
    .then((svg) => process.stdout.write(svg))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
