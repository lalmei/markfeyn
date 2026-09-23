const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");
const feynman = require("../src/markfeyn/assets/feynman-diagrams.js");

// Renders `source` through the real renderAll()/DOM pipeline and waits for
// the placeholder <figure class="feynman-diagram--loading"> to be replaced
// by the final figure (which may or may not contain an <svg>, depending on
// whether the diagram is empty or errored).
async function renderDiagramFigure(source) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const testDocument = env.document;
  const pre = testDocument.createElement("pre");
  const code = testDocument.createElement("code");

  try {
    globalThis.document = testDocument;
    globalThis.window = env.window;
    code.className = "language-feynman";
    code.textContent = source;
    pre.appendChild(code);
    testDocument.body.appendChild(pre);

    feynman.renderAll(testDocument);

    // Wait on a time budget, not a tick count: ELK and canvas auto-growth
    // may need many event-loop turns on a loaded machine.
    for (const deadline = Date.now() + 10000; Date.now() < deadline;) {
      await new Promise((resolve) => setImmediate(resolve));

      const figure = testDocument.querySelector("figure.feynman-diagram");

      if (figure && !figure.classList.contains("feynman-diagram--loading")) {
        return figure;
      }
    }

    throw new Error("Timed out waiting for diagram render");
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }

    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

test("invalid role declaration surfaces the layout validation message", async () => {
  const figure = await renderDiagramFigure(`
incoming a
outgoing a
fermion a->b
`);

  const errors = figure.querySelector("figcaption.feynman-diagram__errors");

  assert.ok(errors, "expected an errors figcaption");
  assert.match(errors.textContent, /Vertex "a" is declared both incoming and outgoing\./);
});

test("parser errors and layout validation errors are combined and deduplicated", async () => {
  const figure = await renderDiagramFigure(`
incoming a
outgoing a
fermion a->b
badcommand foo
`);

  const errors = figure.querySelector("figcaption.feynman-diagram__errors");

  assert.ok(errors);

  const parts = errors.textContent.split("; ");

  // Parser errors are reported first, layout diagnostics after, with no
  // duplicate messages.
  assert.equal(parts.length, new Set(parts).size);
  assert.ok(parts[0].includes("unknown command"));
  assert.ok(parts.some((part) => part.includes('declared both incoming and outgoing')));
});

test("empty diagrams render a figcaption instead of a blank box", async () => {
  const empty = await renderDiagramFigure("");

  assert.equal(empty.dataset.feynmanEmpty, "true");
  assert.ok(!empty.querySelector("svg"));

  const caption = empty.querySelector("figcaption.feynman-diagram__empty");

  assert.ok(caption);
  assert.equal(caption.textContent, "Empty Feynman diagram: add at least one edge");
});

test("diagrams with only comments are also treated as empty", async () => {
  const figure = await renderDiagramFigure("# just a comment\n# another comment\n");

  assert.equal(figure.dataset.feynmanEmpty, "true");
});

test("standalone positioned vertices with no edges still render normally", async () => {
  // Regression guard: "empty" must mean "nothing to lay out", not "no
  // edges" — a diagram with only a manually positioned decoration vertex is
  // not empty and must not be swallowed by the empty-diagram path.
  const figure = await renderDiagramFigure(`
options width=300 height=220
position c 150 110
vertex c:cross
label c:X
`);

  assert.notEqual(figure.dataset.feynmanEmpty, "true");
  assert.ok(figure.querySelector("svg"));
});

test("explicit title directive sets the SVG title", async () => {
  const figure = await renderDiagramFigure(`
title Electron-positron annihilation
incoming a
outgoing b
fermion a->b
`);

  const title = figure.querySelector("svg > title");

  assert.equal(title.textContent, "Electron-positron annihilation");
});

test("quoted title directive strips the surrounding quotes", async () => {
  const figure = await renderDiagramFigure(`
title "e+ e- to mu+ mu-"
incoming a
outgoing b
fermion a->b
`);

  const title = figure.querySelector("svg > title");

  assert.equal(title.textContent, "e+ e- to mu+ mu-");
});

test("auto-generated title uses incoming/outgoing vertex labels", async () => {
  const figure = await renderDiagramFigure(`
incoming ep em
outgoing mup mum
fermion ep->v1 em->v1
photon v1->v2
fermion v2->mup v2->mum
label ep:e^+ em:e^- mup:mu^+ mum:mu^-
`);

  const title = figure.querySelector("svg > title");

  assert.equal(title.textContent, "Feynman diagram: e+ e- → mu+ mu-");
});

test("auto-generated title falls back to vertex names without labels", async () => {
  const figure = await renderDiagramFigure(`
incoming a
outgoing b
fermion a->b
`);

  const title = figure.querySelector("svg > title");

  assert.equal(title.textContent, "Feynman diagram: a → b");
});

test("title falls back to the generic string when no roles are declared", async () => {
  const figure = await renderDiagramFigure(`
options width=300 height=220
position c 150 110
vertex c:cross
`);

  const title = figure.querySelector("svg > title");

  assert.equal(title.textContent, "Feynman diagram");
});

test("SVG desc summarizes vertex and propagator counts", async () => {
  const figure = await renderDiagramFigure(`
incoming a
outgoing b
fermion a->v1
photon v1->v2
fermion v2->b
`);

  const desc = figure.querySelector("svg > desc");

  assert.equal(desc.textContent, "4 vertices, 2 fermion propagators, 1 photon propagator");
});

test("createLayoutFallbackDiagnostic builds a warning diagnostic from the ELK error", () => {
  // Forcing a genuine ELK (elkjs) failure through the public parseFeynman/
  // layoutFeynman API is not practically feasible: elkjs runs synchronously
  // over the compiled graph and is tolerant of every malformed diagram we
  // could construct (extreme coordinates, negative sizes, huge parallel
  // fanouts, etc. all still complete). Reliably forcing an exception would
  // require monkeypatching the elkjs module that gets inlined into the
  // esbuild bundle, which in turn requires Node's `node:test` module
  // mocking (`mock.module`), gated behind the
  // `--experimental-test-module-mocks` CLI flag. That flag is not part of
  // this project's `node --test tests/` invocation, and adding it would
  // change how every other test file runs just to cover this one case.
  //
  // Instead we test the two halves of the fix directly:
  //  1. `createLayoutFallbackDiagnostic` (exported for this reason) builds
  //     the correct diagnostic shape from a thrown error - this is the
  //     function layout-engine.js's catch block calls with the real ELK
  //     error.
  //  2. The renderer test below proves that when `layout.diagnostics`
  //     contains a diagnostic with `stage: "layout-fallback"`, the SVG
  //     renderer sets `data-feynman-fallback="true"` and renders the
  //     subtle warning caption - regardless of how that diagnostic came to
  //     be there.
  const diagnostic = feynman.createLayoutFallbackDiagnostic(new Error("boom"));

  assert.equal(diagnostic.stage, "layout-fallback");
  assert.equal(diagnostic.severity, "warning");
  assert.match(diagnostic.message, /boom/);
});

test("SvgRenderer surfaces a layout-fallback diagnostic as a data attribute and warning caption", async () => {
  const fallbackMessage = "Layout engine failed, using fallback layout: boom";
  const renderer = new feynman.SvgRenderer({
    parseFeynman: feynman.parseFeynman,
    layoutFeynman: async (diagram) => {
      const layout = await feynman.layoutFeynman(diagram);

      return {
        ...layout,
        diagnostics: [
          ...(layout.diagnostics || []),
          { stage: "layout-fallback", severity: "warning", message: fallbackMessage, data: {} },
        ],
      };
    },
  });

  const previousDocument = globalThis.document;
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");

  globalThis.document = env.document;

  let figure;

  try {
    figure = await renderer.renderFeynmanElement("incoming a\noutgoing b\nfermion a->b", 0);
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }

  assert.equal(figure.dataset.feynmanFallback, "true");

  const warnings = figure.querySelector("figcaption.feynman-diagram__warnings");

  assert.ok(warnings);
  assert.equal(warnings.textContent, fallbackMessage);

  // A fallback is a warning, not an error - it must not show up in the
  // error caption.
  const errors = figure.querySelector("figcaption.feynman-diagram__errors");

  assert.ok(!errors);
});

test("error figure includes the original source in a collapsed details block", () => {
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const previousDocument = globalThis.document;

  globalThis.document = env.document;

  let figure;

  try {
    const renderer = new feynman.SvgRenderer({
      parseFeynman: feynman.parseFeynman,
      layoutFeynman: feynman.layoutFeynman,
    });

    figure = renderer.renderErrorFigure(
      new Error("Unable to render Feynman diagram"),
      0,
      "incoming a\n<script>evil</script>",
    );
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }

  const details = figure.querySelector("details.feynman-diagram__source");

  assert.ok(details);
  assert.equal(details.querySelector("summary").textContent, "Source");

  const code = details.querySelector("pre > code");

  assert.equal(code.textContent, "incoming a\n<script>evil</script>");
  // textContent (not innerHTML) must have been used - the markup should
  // not have been parsed as an element.
  assert.equal(code.children.length, 0);
});

test("error figure omits the source details block when no source is given", () => {
  const env = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const previousDocument = globalThis.document;

  globalThis.document = env.document;

  let figure;

  try {
    const renderer = new feynman.SvgRenderer({
      parseFeynman: feynman.parseFeynman,
      layoutFeynman: feynman.layoutFeynman,
    });

    figure = renderer.renderErrorFigure(new Error("boom"), 0);
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }

  assert.ok(!figure.querySelector("details.feynman-diagram__source"));
});
