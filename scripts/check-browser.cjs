"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createServer } = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const asset = path.join(root, "src/markfeyn/assets/feynman-diagrams.js");
const mathLabel = ".feynman-diagram__label-math-svg";
const diagram = ".feynman-diagram__svg";

async function verify() {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "markfeyn-browser-"));
  const contentTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const server = createServer(async (request, response) => {
    try {
      let file = path.join(scratch, new URL(request.url, "http://localhost").pathname);
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await fs.readFile(file);
      response.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  let browser;

  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const guide = await fs.readFile(path.join(docs, "installation.md"), "utf8");
    const [, python] = guide.match(/\x60{4}python\n(from pathlib import Path\n[\s\S]*?)\x60{4}/);
    const [, hook] = guide.match(/\x60{3}javascript\n(function showRenderedMarkdown[\s\S]*?)\x60{3}/);
    execFileSync(process.env.PYTHON || "python", ["-c", python], { cwd: scratch });
    await fs.copyFile(asset, path.join(scratch, "feynman-diagrams.js"));
    await fs.copyFile(
      require.resolve("mathjax-full/es5/tex-svg.js"),
      path.join(scratch, "tex-svg.js"),
    );

    for (const engine of ["mkdocs", "properdocs"]) {
      const config = (await fs.readFile(path.join(root, engine + ".yml"), "utf8"))
        .replace(/^site_url:.*\n/m, "");
      const file = path.join(scratch, engine + ".yml");
      await fs.writeFile(file, `site_url: ${origin}/${engine}/\ndocs_dir: ${JSON.stringify(docs)}\n${config}`);
      execFileSync(engine, ["build", "--strict", "-f", file, "-d", path.join(scratch, engine)], {
        cwd: root, stdio: "inherit",
      });
    }

    browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    await page.goto(origin);
    await page.locator(`${diagram} .feynman-diagram__edge--photon`).waitFor();
    await page.addScriptTag({ url: origin + "/tex-svg.js" });
    await page.addScriptTag({ content: hook });
    await page.evaluate(() => {
      const code = document.createElement("code");
      code.className = "language-feynman";
      code.textContent = String.raw`fermion a->b
label a:\frac{1}{2}`;
      const pre = document.createElement("pre");
      pre.appendChild(code);
      window.showRenderedMarkdown(document.querySelector("main"), pre.outerHTML);
    });
    await page.locator(`${diagram} ${mathLabel}`).first().waitFor();
    assert.equal(await page.locator(".feynman-diagram__errors").count(), 0);
    console.log("Python-Markdown and dynamic HTML insertion passed");

    for (const engine of ["mkdocs", "properdocs"]) {
      await page.goto(`${origin}/${engine}/`);
      await page.locator(diagram).first().waitFor();
      await page.evaluate(() => { window.markfeynDocumentMarker = true; });
      const link = page.locator('a[href$="from-the-literature/"]').first();
      await link.evaluate((element) => {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await page.waitForURL("**/from-the-literature/");
      await page.locator(`${diagram} ${mathLabel}`).first().waitFor();
      assert.equal(await page.evaluate(() => window.markfeynDocumentMarker), true);
      assert.equal(await page.locator(diagram).count(), 3);
      assert.equal(await page.locator(".feynman-diagram__errors").count(), 0);
      console.log(`${engine} instant navigation and MathJax passed`);
    }
  } finally {
    await browser?.close();
    server.close();
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
