module.exports = {
  outputDir: "build/coverage/js",
  reports: ["console-summary", "lcovonly"],
  entryFilter: "**/build/coverage/feynman-diagrams.js",
  sourceFilter: "**/src/markfeyn/renderer/**/*.js",
  all: "src/markfeyn/renderer",
};
