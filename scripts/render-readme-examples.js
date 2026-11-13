"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { renderStandaloneSvg } = require("../src/markfeyn/assets/render-svg.cjs");

const ROOT = path.join(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "docs", "assets", "readme");

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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
