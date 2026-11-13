const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");
const renderer = require("../src/markfeyn/assets/feynman-diagrams.js");

test("the documented JavaScript hook renders newly inserted Markdown HTML", async () => {
  const docs = fs.readFileSync(path.join(__dirname, "../docs/installation.md"), "utf8");
  const [, hook] = docs.match(/```javascript\n(function showRenderedMarkdown[\s\S]*?)```/);
  const showRenderedMarkdown = new Function("FeynmanDiagrams", hook + "\nreturn showRenderedMarkdown;")(renderer);
  const { document } = parseHTML("<html><head></head><body><main></main></body></html>");
  const container = document.querySelector("main");
  globalThis.document = document;

  try {
    for (const particle of ["photon", "fermion"]) {
      showRenderedMarkdown(container, `<pre><code class="language-feynman">${particle} a-&gt;b</code></pre>
        <pre><code class="language-python">print(1)</code></pre>`);
      const deadline = Date.now() + 5000;
      const selector = `svg .feynman-diagram__edge--${particle}`;
      while (!container.querySelector(selector) && Date.now() < deadline) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      assert.ok(container.querySelector(selector));
      assert.equal(container.querySelector("code.language-python").textContent, "print(1)");
    }
  } finally {
    delete globalThis.document;
  }
});
