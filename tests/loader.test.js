const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");

const loaderSource = fs
  .readFileSync(
    path.join(__dirname, "../src/markfeyn/assets/feynman-diagrams-loader.js"),
    "utf8",
  )
  .replace("__MARKFEYN_RENDERER_FILE__", "feynman-diagrams.js");

const LOADER_SRC = "https://x/site/assets/javascripts/feynman-diagrams-loader.js";
const RENDERER_SRC = "https://x/site/assets/javascripts/feynman-diagrams.js";

function runLoader(body, extraWindow = {}) {
  const { window, document } = parseHTML(
    `<!doctype html><html><head></head><body>${body}</body></html>`,
  );
  Object.assign(window, extraWindow);
  Object.defineProperty(document, "currentScript", { value: { src: LOADER_SRC } });
  try {
    new Function("window", "document", "console", loaderSource)(window, document, console);
  } finally {
    // linkedom shares its window object between parseHTML calls.
    Object.keys(extraWindow).forEach((key) => delete window[key]);
  }
  return { window, document };
}

const injected = (document) => [...document.head.querySelectorAll("script")];

test("loader injects nothing on pages without diagrams", () => {
  const { document } = runLoader("<p>hello</p>");
  assert.equal(injected(document).length, 0);
});

test("loader injects the renderer once on pages with diagrams", () => {
  const { document } = runLoader(
    '<pre class="language-feynman"><code>fermion a->b</code></pre>',
  );
  const scripts = injected(document);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].getAttribute("src"), RENDERER_SRC);
});

test("loader also matches fences with the class on the code element", () => {
  const { document } = runLoader('<pre><code class="language-feynman">x</code></pre>');
  assert.equal(injected(document).length, 1);
});

test("loader injects only one script across repeated document$ emissions", () => {
  const callbacks = [];
  const document$ = { subscribe: (cb) => callbacks.push(cb) };
  const { document } = runLoader(
    '<pre class="language-feynman"><code>x</code></pre>',
    { document$ },
  );

  assert.equal(callbacks.length, 1);
  callbacks[0](document);
  callbacks[0](document);
  callbacks[0](document);
  assert.equal(injected(document).length, 1);
});

test("loader waits for a diagram page under document$", () => {
  const callbacks = [];
  const document$ = { subscribe: (cb) => callbacks.push(cb) };
  const { document } = runLoader("<p>plain</p>", { document$ });

  callbacks[0](document);
  assert.equal(injected(document).length, 0);

  document.body.innerHTML = '<pre class="language-feynman"><code>x</code></pre>';
  callbacks[0](document);
  callbacks[0](document);
  assert.equal(injected(document).length, 1);
});

test("loader renders directly when the renderer is already present", () => {
  const calls = [];
  const FeynmanDiagrams = { renderAll: (root) => calls.push(root) };
  const { document } = runLoader(
    '<pre class="language-feynman"><code>x</code></pre>',
    { FeynmanDiagrams },
  );

  assert.equal(injected(document).length, 0);
  assert.equal(calls.length, 1);
});
