import { parseBrace } from "./braces.js";
import { DEFAULT_DIAGRAM_OPTIONS } from "./constants.js";
import {
  parseAlignmentCommand,
  parseExplicitTikzOrientationCommand,
  parseManualPosition,
  parseTikzOrientationCommand,
} from "./directives.js";
import {
  matchEdgeCommand,
  parseEdges,
} from "./edges.js";
import { FeynmanParser } from "./feynman-parser.js";
import { parseLabels } from "./labels.js";
import {
  isTikzOrientationCommand,
  parseDiagramOptions,
  setDiagramOption,
} from "./options.js";
import { parseVertices } from "./vertices.js";

export function createEmptyFeynmanDiagram() {
  return {
    incoming: [],
    outgoing: [],
    edges: [],
    labels: {},
    braces: [],
    manualPositions: {},
    vertices: {},
    options: { ...DEFAULT_DIAGRAM_OPTIONS },
    errors: [],
    warnings: [],
  };
}

export function parseFeynman(source) {
  return new FeynmanParser(source, {
    createEmptyFeynmanDiagram,
    matchEdgeCommand,
    parseAlignmentCommand,
    parseBrace,
    parseDiagramOptions,
    parseEdges,
    parseExplicitTikzOrientationCommand,
    parseLabels,
    parseManualPosition,
    parseTikzOrientationCommand,
    parseVertices,
    setDiagramOption,
    isTikzOrientationCommand,
  }).parse();
}
