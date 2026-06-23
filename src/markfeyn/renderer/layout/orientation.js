export function analyzeOrientation(semantic, topology, options = {}) {
  const requested = options.orientationMode || semantic.layoutHints.orientationMode;

  if (requested === "fixed") {
    return {
      mode: "fixed",
      confidence: 1,
      direction: directionFromOptions(options),
      evidence: ["explicit fixed orientation mode"],
      ambiguities: [],
    };
  }

  if (requested === "symmetric") {
    return symmetricOrientation(["explicit symmetric orientation mode"]);
  }

  if (requested === "process") {
    return processOrientation(["explicit process orientation mode"], directionFromOptions(options));
  }

  if (options.tikzOrientation || semantic.source.options?.tikzOrientation) {
    return {
      mode: "fixed",
      confidence: 0.9,
      direction: directionFromOptions(options),
      evidence: ["explicit TikZ-Feynman orientation command"],
      ambiguities: [],
    };
  }

  if (semantic.incoming.length > 0 && semantic.outgoing.length > 0) {
    return processOrientation(["explicit incoming and outgoing external roles"], directionFromOptions(options));
  }

  if (semantic.process.initialState?.length && semantic.process.finalState?.length) {
    return processOrientation(["process metadata includes initial and final states"], directionFromOptions(options));
  }

  return symmetricOrientation([
    "no reliable incoming/outgoing process roles",
    `topology classified as ${topology.detectedTopology}`,
  ]);
}

function processOrientation(evidence, direction = "RIGHT") {
  return {
    mode: "process",
    confidence: 0.9,
    direction,
    axis: direction === "RIGHT" || direction === "LEFT" ? { x: 1, y: 0 } : { x: 0, y: 1 },
    evidence,
    ambiguities: [],
  };
}

function symmetricOrientation(evidence) {
  return {
    mode: "symmetric",
    confidence: 0.8,
    evidence,
    ambiguities: ["external roles are unclassified"],
  };
}

function directionFromOptions(options) {
  const direction = String(options.direction || "").toUpperCase();

  if (["RIGHT", "LEFT", "DOWN", "UP"].includes(direction)) {
    return direction;
  }

  return "RIGHT";
}
