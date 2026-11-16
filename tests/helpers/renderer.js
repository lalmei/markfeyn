const path = require("node:path");

const renderer = process.env.MARKFEYN_COVERAGE === "1"
  ? "build/coverage/feynman-diagrams.js"
  : "src/markfeyn/assets/feynman-diagrams.js";

module.exports = require(path.resolve(__dirname, "../..", renderer));
