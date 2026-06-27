import { createLayoutEngine } from "./layout-engine.js";
import { buildSemanticElkGraph } from "./layout/elk-compiler.js";
import { layoutWithElk } from "./layout/elk-runner.js";
import { compareExternalOrdering } from "./layout/external-order.js";
import { selectLoopCandidateLayout } from "./layout/loop-candidates.js";
import { selectMultiloopLayout } from "./layout/multiloop.js";
import { parseBrace } from "./parser/braces.js";
import {
  BLOB_VERTEX_DEFAULT_RADII,
  DEFAULT_DIAGRAM_OPTIONS,
  SIZE_PRESETS,
} from "./parser/constants.js";
import {
  matchEdgeCommand,
  parseEdges,
} from "./parser/edges.js";
import {
  parseAlignmentCommand,
  parseExplicitTikzOrientationCommand,
  parseManualPosition,
  parseTikzOrientationCommand,
} from "./parser/directives.js";
import { FeynmanParser } from "./parser/feynman-parser.js";
import { parseLabels } from "./parser/labels.js";
import { parseVertices } from "./parser/vertices.js";
import {
  isNodeIdentifier,
  isTikzOrientationCommand,
  normalizeLayoutName,
  normalizeOrientation,
  normalizeQuality,
  normalizeTikzOrientation,
  parseDiagramOptions,
  setDiagramOption,
} from "./parser/options.js";
import {
  doubleLinePath,
  doubleLinePathForEdge,
  edgeGeometry,
  edgePath,
  geometryToPath,
  geometryPoint,
  geometrySample,
  gluonPath,
  gluonPathForEdge,
  lineVector,
  normalizeVector,
  pointsToPath,
  projectPoint,
  squarePath,
  squarePathForEdge,
  trianglePath,
  trianglePathForEdge,
  wavePath,
  wavePathForEdge,
} from "./render/paths.js";
import {
  labelMarkupToText,
  labelNeedsMathJax,
  labelSegmentText,
  parseLabelMarkup,
} from "./render/label-markup.js";
import {
  shouldUseSymmetricContactLayout,
  shouldUseSymmetricTreeLayout,
  shouldUseSymmetricUnclassifiedLayout,
} from "./layout/layout.js";

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const GLUON_JUNCTION_CAP_RADIUS = 1.7;
  const VISUAL_DEFAULTS = Object.freeze({
    edgeStrokeWidth: 2.6,
    gluonStrokeWidth: 2.1,
    vertexStrokeWidth: 2.3,
    blobStrokeWidth: 2.8,
    vertexMarkStrokeWidth: 2.4,
    labelFontSize: 32,
    edgeLabelFontSize: 26,
    mathLabelFontScale: 0.72,
    labelFontFamily: "\"Latin Modern Math\", \"Latin Modern Roman\", \"Computer Modern Serif\", \"CMU Serif\", \"STIX Two Text\", \"Times New Roman\", serif",
    labelFontStyle: "italic",
    scriptFontSizePercent: 82,
    labelHorizontalOffset: 20,
    labelTopOffset: 24,
    labelBottomOffset: 30,
    edgeLabelOffset: 32,
    momentumArrowOffset: 19,
    momentumLabelGap: 20,
    momentumArrowShorten: 0.22,
    momentumArrowStrokeWidth: 1.4,
    momentumArrowHeadLength: 8,
    momentumArrowHeadWidth: 7,
    arrowMarkerWidth: 11,
    arrowMarkerHeight: 11,
    arrowMarkerRefX: 7,
    arrowMarkerRefY: 4,
    arrowPath: "M0,0 L8,4 L0,8 Z",
  });
  const TEX_BRACE_METRICS = Object.freeze({
    centerX: 4.4234125,
    topMinY: 0.009963,
    bottomMaxY: 8.956413,
    topAdvance: 8.966467,
    extenderAdvance: 2.988822,
    middleAdvance: 17.932934,
    baseHeight: 35.855814,
    targetScale: 1.45,
  });
  const BRACE_LABEL_PADDING = VISUAL_DEFAULTS.labelFontSize * 0.68;
  const BRACE_SIDE_GAP = VISUAL_DEFAULTS.labelHorizontalOffset + 34;
  const TEX_BRACE_PATHS = Object.freeze({
    left: {
      top: "M5.021171 4.513076C5.021171 3.696139 5.240349 1.793275 7.013699 .537983C7.143213 .438356 7.153176 .428394 7.153176 .249066C7.153176 .019925 7.143213 .009963 6.894147 .009963H6.734745C4.592777 1.165629 3.825654 3.048568 3.825654 4.513076V8.797011C3.825654 9.05604 3.835616 9.066002 4.104608 9.066002H4.742217C5.011208 9.066002 5.021171 9.05604 5.021171 8.797011V4.513076Z",
      middle: "M3.825654 17.763387C3.825654 18.022416 3.835616 18.032379 4.104608 18.032379H4.742217C5.011208 18.032379 5.021171 18.022416 5.021171 17.763387V13.559153C5.021171 12.353674 4.513076 10.321295 2.281445 8.966376C4.533001 7.601494 5.021171 5.549191 5.021171 4.373599V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.383562C3.825654 5.220423 3.646326 7.292653 1.8132 8.687422C1.703611 8.777086 1.693649 8.787049 1.693649 8.966376S1.703611 9.155666 1.8132 9.24533C2.072229 9.444583 2.759651 9.972603 3.237858 10.978829C3.626401 11.775841 3.825654 12.662516 3.825654 13.549191V17.763387Z",
      bottom: "M6.894147 8.956413C7.143213 8.956413 7.153176 8.946451 7.153176 8.71731C7.153176 8.537983 7.143213 8.52802 7.103362 8.498132C6.794521 8.268991 6.07721 7.760897 5.608966 6.844334C5.220423 6.087173 5.021171 5.32005 5.021171 4.4533V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.4533C3.825654 5.927771 4.592777 7.81071 6.734745 8.956413H6.894147Z",
    },
    right: {
      top: "M3.825654 8.797011C3.825654 9.05604 3.835616 9.066002 4.104608 9.066002H4.742217C5.011208 9.066002 5.021171 9.05604 5.021171 8.797011V4.513076C5.021171 3.048568 4.254047 1.165629 2.11208 .009963H1.96264C1.703611 .009963 1.693649 .019925 1.693649 .249066C1.693649 .428394 1.703611 .438356 1.743462 .468244C2.052304 .697385 2.769614 1.205479 3.237858 2.122042C3.506849 2.660025 3.825654 3.437111 3.825654 4.513076V8.797011Z",
      middle: "M5.021171 13.549191C5.021171 12.712329 5.200498 10.6401 7.033624 9.24533C7.143213 9.155666 7.153176 9.145704 7.153176 8.966376S7.143213 8.777086 7.033624 8.687422C6.774595 8.488169 6.087173 7.960149 5.608966 6.953923C5.220423 6.156912 5.021171 5.270237 5.021171 4.383562V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.373599C3.825654 5.579078 4.333748 7.611457 6.56538 8.966376C4.313823 10.331258 3.825654 12.383562 3.825654 13.559153V17.763387C3.825654 18.022416 3.835616 18.032379 4.104608 18.032379H4.742217C5.011208 18.032379 5.021171 18.022416 5.021171 17.763387V13.549191Z",
      bottom: "M3.825654 4.4533C3.825654 5.32005 3.58655 7.193026 1.833126 8.428394C1.703611 8.52802 1.693649 8.537983 1.693649 8.71731C1.693649 8.946451 1.703611 8.956413 1.96264 8.956413H2.11208C4.26401 7.800747 5.021171 5.917808 5.021171 4.4533V.169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V4.4533Z",
    },
    extender: "M5.021171 .169365C5.021171-.089664 5.011208-.099626 4.742217-.099626H4.104608C3.835616-.099626 3.825654-.089664 3.825654 .169365V2.819427C3.825654 3.078456 3.835616 3.088418 4.104608 3.088418H4.742217C5.011208 3.088418 5.021171 3.078456 5.021171 2.819427V.169365Z",
  });
  const BLOB_HATCH_PATTERNS = Object.freeze({
    diagonal: {
      size: 8,
      paths: ["M -2 10 L 10 -2"],
    },
    "diagonal-reverse": {
      size: 8,
      paths: ["M -2 -2 L 10 10"],
    },
    cross: {
      size: 8,
      paths: ["M -2 10 L 10 -2", "M -2 -2 L 10 10"],
    },
    horizontal: {
      size: 7,
      paths: ["M 0 2 L 7 2"],
    },
    vertical: {
      size: 7,
      paths: ["M 2 0 L 2 7"],
    },
    grid: {
      size: 8,
      paths: ["M 0 2 L 8 2", "M 2 0 L 2 8"],
    },
  });
  let diagramSerial = 0;
  let mathLabelSerial = 0;

  function createEmptyFeynmanDiagram() {
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

  function parseFeynman(source) {
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

  const layoutEngine = createLayoutEngine({
    applyParallelPropagatorCurves,
    finalizeLayout,
    layoutFeynmanPreparedFallbackRaw,
    layoutFeynmanPreparedRaw,
    profileNow,
    resolveLayoutOptions,
  });

  async function layoutFeynman(diagram, options) {
    return layoutEngine.layoutFeynman(diagram, options);
  }

  function layoutFeynmanFallbackSync(diagram, options) {
    return layoutEngine.layoutFeynmanFallbackSync(diagram, options);
  }

  async function layoutFeynmanPreparedRaw(diagram, layoutOptions, prepared) {
    const loopCandidateLayout = layoutLoopCandidate(diagram, layoutOptions, prepared);

    if (loopCandidateLayout) {
      return loopCandidateLayout;
    }

    const multiloopLayout = layoutMultiloopCandidate(diagram, layoutOptions, prepared);

    if (multiloopLayout) {
      return multiloopLayout;
    }

    if (shouldUseSymmetricContactLayout(prepared)) {
      return layoutSymmetricContact(diagram, layoutOptions, prepared);
    }

    if (shouldUseSymmetricUnclassifiedLayout(prepared)) {
      return layoutSymmetricUnclassifiedRefinement(diagram, layoutOptions, prepared);
    }

    if (shouldUseSymmetricTreeLayout(prepared)) {
      return layoutSymmetricTree(diagram, layoutOptions, prepared);
    }

    if (layoutOptions.layout === "tree") {
      return layoutTree(diagram, layoutOptions);
    }

    return layoutFeynmanWithElk(diagram, layoutOptions, prepared);
  }

  function layoutFeynmanPreparedFallbackRaw(diagram, layoutOptions, prepared) {
    const loopCandidateLayout = layoutLoopCandidate(diagram, layoutOptions, prepared);

    if (loopCandidateLayout) {
      return loopCandidateLayout;
    }

    const multiloopLayout = layoutMultiloopCandidate(diagram, layoutOptions, prepared);

    if (multiloopLayout) {
      return multiloopLayout;
    }

    if (shouldUseSymmetricContactLayout(prepared)) {
      return layoutSymmetricContact(diagram, layoutOptions, prepared);
    }

    if (shouldUseSymmetricUnclassifiedLayout(prepared)) {
      return layoutSymmetricUnclassifiedRefinement(diagram, layoutOptions, prepared);
    }

    if (shouldUseSymmetricTreeLayout(prepared)) {
      return layoutSymmetricTree(diagram, layoutOptions, prepared);
    }

    return layoutFeynmanFallbackRaw(diagram, layoutOptions);
  }

  function layoutLoopCandidate(diagram, layoutOptions, prepared) {
    const selection = selectLoopCandidateLayout(prepared, layoutOptions);

    if (!selection) {
      return null;
    }

    prepared.loopCandidateSelection = selection.selection;
    applyLoopCandidateCurves(diagram, selection.selection.selected);

    return selection.layout;
  }

  function layoutMultiloopCandidate(diagram, layoutOptions, prepared) {
    const selection = selectMultiloopLayout(prepared, layoutOptions);

    if (!selection) {
      return null;
    }

    prepared.multiloopCandidateSelection = selection.selection;

    return selection.layout;
  }

  function layoutFeynmanFallbackRaw(diagram, layoutOptions) {
    if (layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical") {
      return layoutSpring(diagram, layoutOptions, {
        electrical: layoutOptions.layout === "spring-electrical",
      });
    }

    if (layoutOptions.layout === "tree") {
      return layoutTree(diagram, layoutOptions);
    }

    return layoutLayered(diagram, layoutOptions);
  }

  async function layoutFeynmanWithElk(diagram, layoutOptions, prepared) {
    return layoutWithElk(diagram, layoutOptions, prepared, {
      buildSemanticElkGraph,
      elkNodeDimensions,
      normalizeElkLayout,
    });
  }

  function applyParallelPropagatorCurves(diagram, prepared) {
    (prepared.parallelCurvePlan || []).forEach((assignment) => {
      const edge = diagram.edges[assignment.edgeIndex];

      if (
        !edge
        || edge.hidden
        || edge.curve
        || Number.isFinite(Number(edge.outAngle))
        || Number.isFinite(Number(edge.inAngle))
      ) {
        return;
      }

      edge.curve = {
        side: assignment.side,
        amount: assignment.amount,
      };
      edge.autoParallelCurve = true;
    });
  }

  function applyLoopCandidateCurves(diagram, selectedCandidate) {
    (selectedCandidate?.curvePlan || []).forEach((assignment) => {
      const edge = diagram.edges[assignment.edgeIndex];

      if (
        !edge
        || edge.hidden
        || edge.curve
        || Number.isFinite(Number(edge.outAngle))
        || Number.isFinite(Number(edge.inAngle))
      ) {
        return;
      }

      edge.curve = {
        side: assignment.side,
        amount: assignment.amount,
        shape: assignment.shape,
      };
      edge.autoLoopCurve = true;
    });
  }

  function profileNow() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function resolveLayoutOptions(diagram, options) {
    const merged = {
      ...DEFAULT_DIAGRAM_OPTIONS,
      ...(diagram.options || {}),
      ...(options || {}),
    };
    const size = SIZE_PRESETS[merged.size] || SIZE_PRESETS.medium;
    const incomingCount = Math.max(diagram.incoming.length, 1);
    const outgoingCount = Math.max(diagram.outgoing.length, 1);
    const orientation = normalizeOrientation(merged.orientation) || DEFAULT_DIAGRAM_OPTIONS.orientation;
    const tikzOrientation = normalizeTikzOrientation(merged.tikzOrientation || merged.tikz_orientation);
    const alignments = normalizeAlignmentConstraints(merged.alignments || merged.alignmentConstraints);
    const portrait = orientation.startsWith("vertical") || tikzOrientation?.axis === "vertical";
    const width = merged.width ?? (portrait ? size.minHeight : size.width);
    const defaultHeight = Math.max(size.minHeight, 70 + Math.max(incomingCount, outgoingCount) * size.externalGap);
    const height = merged.height ?? (portrait ? Math.max(size.width, defaultHeight) : defaultHeight);
    const defaultMarginX = portrait ? Math.min(size.marginX, size.marginY) : size.marginX;

    return {
      layout: normalizeLayoutName(merged.layout) || DEFAULT_DIAGRAM_OPTIONS.layout,
      orientation,
      width,
      height,
      marginX: merged.margin_x ?? merged.marginX ?? defaultMarginX,
      marginY: merged.margin_y ?? merged.marginY ?? size.marginY,
      tikzOrientation,
      alignments,
      orientationMode: merged.orientationMode,
      direction: merged.direction,
      deterministicSeed: merged.deterministicSeed,
      debug: Boolean(merged.debug),
      profile: Boolean(merged.profile),
      quality: normalizeQuality(merged.quality),
      preservePreviousLayout: Boolean(merged.preservePreviousLayout),
      previousLayout: merged.previousLayout,
    };
  }

  function resolveRequestedLayout(diagram, options) {
    const merged = {
      ...DEFAULT_DIAGRAM_OPTIONS,
      ...(diagram.options || {}),
      ...(options || {}),
    };

    return normalizeLayoutName(merged.layout) || DEFAULT_DIAGRAM_OPTIONS.layout;
  }

  function normalizeAlignmentConstraints(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((constraint) => {
        const axis = constraint?.axis === "vertical" ? "vertical" : constraint?.axis === "horizontal" ? "horizontal" : null;
        const nodes = Array.isArray(constraint?.nodes)
          ? constraint.nodes.map((node) => String(node || "").trim()).filter(isNodeIdentifier)
          : [];

        if (!axis || nodes.length < 2) {
          return null;
        }

        return { axis, nodes };
      })
      .filter(Boolean);
  }

  function diagramWithInferredTerminals(diagram, layout) {
    if (layout === "tree") {
      return diagram;
    }

    const inferred = inferExternalTerminals(diagram);
    const incoming = mergeTerminalClassifications(diagram.incoming, inferred.incoming, diagram.outgoing);
    const outgoing = mergeTerminalClassifications(diagram.outgoing, inferred.outgoing, incoming);

    if (
      arraysEqual(incoming, diagram.incoming)
      && arraysEqual(outgoing, diagram.outgoing)
    ) {
      return diagram;
    }

    return {
      ...diagram,
      incoming,
      outgoing,
      inferredIncoming: incoming.filter((node) => !diagram.incoming.includes(node)),
      inferredOutgoing: outgoing.filter((node) => !diagram.outgoing.includes(node)),
    };
  }

  function mergeTerminalClassifications(explicitNodes, inferredNodes, blockedNodes) {
    const blocked = new Set(blockedNodes);
    const merged = [];

    explicitNodes.forEach((node) => {
      if (!merged.includes(node)) {
        merged.push(node);
      }
    });

    inferredNodes.forEach((node) => {
      if (!blocked.has(node) && !merged.includes(node)) {
        merged.push(node);
      }
    });

    return merged;
  }

  function inferExternalTerminals(diagram) {
    const terminalByNode = new Map();
    const degrees = new Map();
    const visibleEdges = diagram.edges.filter((edge) => !edge.hidden && edge.from !== edge.to);

    visibleEdges.forEach((edge, index) => {
      degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
      degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);

      terminalByNode.set(edge.from, {
        node: edge.from,
        kind: "incoming",
        order: Math.min(terminalByNode.get(edge.from)?.order ?? index, index),
      });
      terminalByNode.set(edge.to, {
        node: edge.to,
        kind: "outgoing",
        order: Math.min(terminalByNode.get(edge.to)?.order ?? index, index),
      });
    });

    const incoming = [];
    const outgoing = [];

    terminalByNode.forEach((terminal, node) => {
      if ((degrees.get(node) || 0) !== 1) {
        return;
      }

      if (terminal.kind === "incoming") {
        incoming.push(terminal);
      } else {
        outgoing.push(terminal);
      }
    });

    return {
      incoming: sortInferredTerminals(incoming),
      outgoing: sortInferredTerminals(outgoing),
    };
  }

  function sortInferredTerminals(terminals) {
    return terminals
      .sort((a, b) => a.order - b.order || a.node.localeCompare(b.node))
      .map((terminal) => terminal.node);
  }

  function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function buildElkGraph(diagram, layoutOptions) {
    const allNodes = Array.from(collectNodes(diagram));

    return {
      id: "markfeyn-root",
      layoutOptions: elkGraphLayoutOptions(layoutOptions),
      children: allNodes.map((node) => ({
        id: node,
        ...elkNodeDimensions(node, diagram),
        layoutOptions: elkNodeLayoutOptions(node, diagram, layoutOptions),
      })),
      edges: diagram.edges
        .filter((edge) => edge.from !== edge.to)
        .map((edge, index) => ({
          id: `edge-${index}`,
          sources: [edge.from],
          targets: [edge.to],
          layoutOptions: elkEdgeLayoutOptions(edge, layoutOptions),
        })),
    };
  }

  function elkGraphLayoutOptions(layoutOptions) {
    const options = {
      "elk.algorithm": elkAlgorithmForLayout(layoutOptions.layout),
      "elk.direction": "RIGHT",
      "elk.randomSeed": "1",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.nodeNode": String(layoutOptions.layout === "spring-electrical" ? 96 : 64),
      "elk.padding": `[top=${layoutOptions.marginY},left=${layoutOptions.marginX},bottom=${layoutOptions.marginY},right=${layoutOptions.marginX}]`,
    };

    if (layoutOptions.layout === "layered") {
      options["elk.layered.spacing.nodeNodeBetweenLayers"] = "96";
      options["elk.layered.spacing.edgeNodeBetweenLayers"] = "42";
      options["elk.layered.nodePlacement.favorStraightEdges"] = "true";
    }

    if (layoutOptions.layout === "tree") {
      options["elk.mrtree.searchOrder"] = "DFS";
      options["elk.mrtree.weighting"] = "DESCENDANTS";
    }

    if (layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical") {
      options["elk.force.iterations"] = layoutOptions.layout === "spring-electrical" ? "160" : "100";
      options["elk.force.repulsion"] = layoutOptions.layout === "spring-electrical" ? "1.2" : "0.6";
    }

    return options;
  }

  function elkAlgorithmForLayout(layout) {
    if (layout === "tree") {
      return "mrtree";
    }

    if (layout === "spring" || layout === "spring-electrical") {
      return "force";
    }

    return "layered";
  }

  function elkNodeDimensions(node, diagram) {
    const definition = diagram.vertices?.[node] ?? null;
    const shape = vertexDefinitionShape(definition);

    if (shape === "blob" || shape === "disk") {
      const radii = blobVertexRadii(shape, definition);

      return {
        width: Math.max(12, radii.rx * 2),
        height: Math.max(12, radii.ry * 2),
      };
    }

    return { width: 8, height: 8 };
  }

  function elkNodeLayoutOptions(node, diagram, layoutOptions) {
    const options = {};

    if (layoutOptions.layout === "layered") {
      if (diagram.incoming.includes(node)) {
        options["elk.layered.layering.layerConstraint"] = "FIRST";
      }

      if (diagram.outgoing.includes(node)) {
        options["elk.layered.layering.layerConstraint"] = "LAST";
      }
    }

    return options;
  }

  function elkEdgeLayoutOptions(edge, layoutOptions) {
    if (layoutOptions.layout === "spring-electrical") {
      return {
        "elk.force.repulsivePower": "2",
      };
    }

    return {};
  }

  function normalizeElkLayout(diagram, layoutOptions, elkGraph) {
    const { width, height } = layoutOptions;
    const axes = diagramAxes(layoutOptions);
    const positions = {};
    const allNodes = Array.from(collectNodes(diagram));
    const rawPositions = elkRawPositions(elkGraph);
    const incoming = new Set(diagram.incoming);
    const outgoing = new Set(diagram.outgoing);
    const unclassified = new Set(diagram.unclassified || []);
    const manual = new Set(Object.keys(diagram.manualPositions || {}));
    const internalNodes = allNodes.filter((node) => (
      !incoming.has(node) && !outgoing.has(node) && !unclassified.has(node)
    ));
    const sourceNodes = internalNodes.length && !unclassified.size ? internalNodes : allNodes;
    const sourceBounds = boundsForNodes(sourceNodes, rawPositions);
    const crossBounds = boundsForAxis(allNodes, rawPositions, "y");
    const layerRange = elkInternalLayerRange(diagram, axes);

    placeExternalNodes(diagram.incoming, axes.layerStart, axes.crossStart, axes.crossEnd, "incoming", axes, positions);
    placeExternalNodes(diagram.outgoing, axes.layerEnd, axes.crossStart, axes.crossEnd, "outgoing", axes, positions);

    internalNodes.forEach((node) => {
      const raw = rawPositions.get(node) || fallbackRawPosition(rawPositions, sourceBounds);
      const layer = scaleCoordinate(raw.x, sourceBounds.minX, sourceBounds.maxX, layerRange.start, layerRange.end);
      const cross = scaleCoordinate(raw.y, crossBounds.min, crossBounds.max, axes.crossStart, axes.crossEnd);

      positions[node] = axes.point(layer, cross, "internal");
    });

    allNodes.forEach((node) => {
      if (positions[node] || manual.has(node)) {
        return;
      }

      const raw = rawPositions.get(node) || fallbackRawPosition(rawPositions, sourceBounds);
      const layer = scaleCoordinate(raw.x, sourceBounds.minX, sourceBounds.maxX, layerRange.start, layerRange.end);
      const cross = scaleCoordinate(raw.y, crossBounds.min, crossBounds.max, axes.crossStart, axes.crossEnd);
      const kind = nodeKind(node, diagram);

      positions[node] = axes.point(layer, cross, kind);
    });

    applyManualPositions(positions, diagram, layoutOptions);
    applyLayoutNormalizations(diagram, positions, axes, layoutOptions);

    return { width, height, positions, options: layoutOptions };
  }

  function usesSpringStyleNormalization(layoutOptions) {
    return layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical";
  }

  function applyLayoutNormalizations(diagram, positions, axes, layoutOptions) {
    centerDefaultSpringExchangeFans(diagram, positions, axes, layoutOptions);
    centerTikzOrientationEndpointFans(diagram, positions, axes, layoutOptions);

    if (usesSpringStyleNormalization(layoutOptions)) {
      alignHorizontalBackboneInternals(diagram, positions, axes, layoutOptions);
      orientHorizontalBackboneInternals(diagram, positions, axes, layoutOptions);
      fitCurvedInternalEdgeGroupsToViewBox(diagram, positions, axes, layoutOptions);
    }

    straightenSingleTerminalLegs(diagram, positions, axes);
    if (!layoutOptions.tikzOrientation) {
      alignVerticalProcessTerminalStacks(diagram, positions, axes, layoutOptions);
    }
    straightenSingleTerminalLegs(diagram, positions, axes);
    alignInternalsAcrossInvisibleTerminalPairs(diagram, positions, axes);
    enforceDeclaredExternalOrder(diagram, positions, axes);
    if (!layoutOptions.tikzOrientation) {
      alignInternalsToDeclaredTerminalRows(diagram, positions, axes, layoutOptions);
    }
    applyAlignmentConstraints(diagram, positions, layoutOptions);
    fitLayoutTranslationToEdgeBounds(diagram, positions, layoutOptions);
  }

  function elkRawPositions(elkGraph) {
    const positions = new Map();

    (elkGraph.children || []).forEach((child) => {
      positions.set(child.id, {
        x: (child.x || 0) + (child.width || 0) / 2,
        y: (child.y || 0) + (child.height || 0) / 2,
      });
    });

    return positions;
  }

  function boundsForNodes(nodes, rawPositions) {
    const xs = [];
    const ys = [];

    nodes.forEach((node) => {
      const raw = rawPositions.get(node);

      if (raw) {
        xs.push(raw.x);
        ys.push(raw.y);
      }
    });

    return {
      minX: xs.length ? Math.min(...xs) : 0,
      maxX: xs.length ? Math.max(...xs) : 0,
      minY: ys.length ? Math.min(...ys) : 0,
      maxY: ys.length ? Math.max(...ys) : 0,
    };
  }

  function boundsForAxis(nodes, rawPositions, axis) {
    const values = [];

    nodes.forEach((node) => {
      const raw = rawPositions.get(node);

      if (raw) {
        values.push(raw[axis]);
      }
    });

    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
    };
  }

  function fallbackRawPosition(rawPositions, bounds) {
    if (rawPositions.size) {
      return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
    }

    return { x: 0, y: 0 };
  }

  function scaleCoordinate(value, sourceMin, sourceMax, targetStart, targetEnd) {
    if (Math.abs(sourceMax - sourceMin) < 0.001) {
      return (targetStart + targetEnd) / 2;
    }

    return targetStart + ((value - sourceMin) * (targetEnd - targetStart)) / (sourceMax - sourceMin);
  }

  function elkInternalLayerRange(diagram, axes) {
    if (!diagram.incoming.length && !diagram.outgoing.length) {
      return { start: axes.layerStart, end: axes.layerEnd };
    }

    const layerSpan = axes.layerEnd - axes.layerStart;
    const terminalGap = Math.min(84, Math.max(48, Math.abs(layerSpan) * 0.24));
    const direction = Math.sign(layerSpan) || 1;

    return {
      start: axes.layerStart + direction * terminalGap,
      end: axes.layerEnd - direction * terminalGap,
    };
  }

  function centerDefaultSpringExchangeFans(diagram, positions, axes, layoutOptions) {
    if (
      (layoutOptions.layout !== "spring" && layoutOptions.layout !== "spring-electrical")
      || !layoutOptions.orientation.startsWith("horizontal")
      || diagram.incoming.length !== 2
      || diagram.outgoing.length !== 2
    ) {
      return;
    }

    const incomingInternals = internalsConnectedToTerminalSet(diagram, "incoming", diagram.incoming);
    const outgoingInternals = internalsConnectedToTerminalSet(diagram, "outgoing", diagram.outgoing);

    if (incomingInternals.length !== 1 || outgoingInternals.length !== 1) {
      return;
    }

    const incomingInternal = incomingInternals[0];
    const outgoingInternal = outgoingInternals[0];

    if (incomingInternal === outgoingInternal || !visibleInternalEdgeConnects(diagram, incomingInternal, outgoingInternal)) {
      return;
    }

    centerMultiTerminalFanJunctions(
      diagram,
      positions,
      axes,
      new Set([incomingInternal, outgoingInternal])
    );
  }

  function internalsConnectedToTerminalSet(diagram, kind, terminals) {
    const terminalSet = new Set(terminals);
    const terminalsByInternal = terminalNeighborsByInternal(diagram, kind);

    return Array.from(terminalsByInternal.entries())
      .filter(([, connectedTerminals]) => (
        connectedTerminals.size === terminalSet.size
        && Array.from(connectedTerminals).every((terminal) => terminalSet.has(terminal))
      ))
      .map(([internal]) => internal);
  }

  function visibleInternalEdgeConnects(diagram, first, second) {
    return diagram.edges.some((edge) => {
      if (edge.hidden) {
        return false;
      }

      return (edge.from === first && edge.to === second)
        || (edge.from === second && edge.to === first);
    });
  }

  function centerTikzOrientationEndpointFans(diagram, positions, axes, layoutOptions) {
    const orientation = layoutOptions.tikzOrientation;

    if (!orientation) {
      return;
    }

    centerMultiTerminalFanJunctions(
      diagram,
      positions,
      axes,
      new Set([orientation.from, orientation.to])
    );
  }

  function centerMultiTerminalFanJunctions(diagram, positions, axes, eligibleInternals) {
    const manual = new Set(Object.keys(diagram.manualPositions || {}));
    const targetCrossesByInternal = new Map();
    const terminalKinds = ["incoming", "outgoing"];

    terminalKinds.forEach((kind) => {
      const terminalsByInternal = terminalNeighborsByInternal(diagram, kind);

      terminalsByInternal.forEach((terminals, internal) => {
        if (
          terminals.size < 2
          || !eligibleInternals.has(internal)
          || manual.has(internal)
          || !positions[internal]
        ) {
          return;
        }

        const crosses = Array.from(terminals)
          .map((terminal) => positions[terminal])
          .filter(Boolean)
          .map((position) => axes.crossOf(position));

        if (crosses.length < 2) {
          return;
        }

        if (!targetCrossesByInternal.has(internal)) {
          targetCrossesByInternal.set(internal, []);
        }

        targetCrossesByInternal.get(internal).push(
          crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length
        );
      });
    });

    targetCrossesByInternal.forEach((crosses, internal) => {
      if (positions[internal]) {
        axes.setCross(
          positions[internal],
          crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length
        );
      }
    });
  }

  function internalAdjacency(diagram) {
    const adjacency = new Map();

    const addNeighbor = (first, second) => {
      if (!adjacency.has(first)) {
        adjacency.set(first, new Set());
      }

      adjacency.get(first).add(second);
    };

    diagram.edges.forEach((edge) => {
      if (edge.hidden) {
        return;
      }

      const fromKind = nodeKind(edge.from, diagram);
      const toKind = nodeKind(edge.to, diagram);

      if (fromKind === "internal" && toKind === "internal") {
        addNeighbor(edge.from, edge.to);
        addNeighbor(edge.to, edge.from);
      }
    });

    return adjacency;
  }

  function internalsAdjacentToTerminals(diagram, kind) {
    const internals = new Set();
    const terminalsByInternal = terminalNeighborsByInternal(diagram, kind);

    terminalsByInternal.forEach((terminals, internal) => {
      if (terminals.size > 0) {
        internals.add(internal);
      }
    });

    return internals;
  }

  function shortestInternalPath(adjacency, start, end) {
    if (start === end) {
      return [start];
    }

    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length) {
      const path = queue.shift();
      const node = path[path.length - 1];
      const neighbors = adjacency.get(node) || new Set();

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) {
          continue;
        }

        const nextPath = [...path, neighbor];

        if (neighbor === end) {
          return nextPath;
        }

        visited.add(neighbor);
        queue.push(nextPath);
      }
    }

    return null;
  }

  function mainHorizontalBackboneNodes(diagram) {
    if (!diagram.incoming.length && !diagram.outgoing.length) {
      return null;
    }

    const leftInternals = internalsAdjacentToTerminals(diagram, "incoming");
    const rightInternals = internalsAdjacentToTerminals(diagram, "outgoing");

    if (!leftInternals.size || !rightInternals.size) {
      return null;
    }

    const adjacency = internalAdjacency(diagram);
    let bestPath = null;

    leftInternals.forEach((start) => {
      rightInternals.forEach((end) => {
        if (start === end) {
          return;
        }

        const path = shortestInternalPath(adjacency, start, end);

        if (!path) {
          return;
        }

        if (!bestPath || path.length < bestPath.length) {
          bestPath = path;
        }
      });
    });

    return bestPath;
  }

  function alignHorizontalBackboneInternals(diagram, positions, axes, layoutOptions) {
    if (!layoutOptions.orientation.startsWith("horizontal")) {
      return;
    }

    const backbone = mainHorizontalBackboneNodes(diagram);

    if (!backbone || backbone.length < 1) {
      return;
    }

    const manual = new Set(Object.keys(diagram.manualPositions || {}));
    const positioned = backbone
      .map((node) => ({ node, position: positions[node] }))
      .filter((entry) => entry.position);

    if (!positioned.length) {
      return;
    }

    const targetCross = positioned.reduce(
      (sum, entry) => sum + axes.crossOf(entry.position),
      0
    ) / positioned.length;

    positioned.forEach((entry) => {
      if (!manual.has(entry.node)) {
        axes.setCross(entry.position, targetCross);
      }
    });
  }

  function orientHorizontalBackboneInternals(diagram, positions, axes, layoutOptions) {
    if (!layoutOptions.orientation.startsWith("horizontal")) {
      return;
    }

    const backbone = mainHorizontalBackboneNodes(diagram);
    const manual = new Set(Object.keys(diagram.manualPositions || {}));

    if (!backbone || backbone.length < 2 || backbone.some((node) => !positions[node] || manual.has(node))) {
      return;
    }

    const direction = Math.sign(axes.layerEnd - axes.layerStart) || 1;
    const orderedLayers = backbone
      .map((node) => positions[node].x)
      .sort((left, right) => direction * (left - right));

    backbone.forEach((node, index) => {
      positions[node].x = orderedLayers[index];
    });
  }

  function curvedInternalEdgeGroups(diagram) {
    const groups = new Map();

    diagram.edges.forEach((edge) => {
      if (edge.hidden || !edge.curve) {
        return;
      }

      const fromKind = nodeKind(edge.from, diagram);
      const toKind = nodeKind(edge.to, diagram);

      if (fromKind !== "internal" || toKind !== "internal") {
        return;
      }

      const key = [edge.from, edge.to].sort().join("|");

      if (!groups.has(key)) {
        groups.set(key, {
          nodes: [edge.from, edge.to].sort(),
          edges: [],
        });
      }

      groups.get(key).edges.push(edge);
    });

    return groups;
  }

  function curveArcAmount(edge) {
    if (!edge.curve) {
      return 0;
    }

    return edge.curve.amount * (edge.looseness ?? 1);
  }

  function maxChordForCurvedEdgeGroup(edges, availableCross) {
    const maxAmount = Math.max(...edges.map((edge) => curveArcAmount(edge)), 0);

    if (maxAmount <= 0 || availableCross <= 0) {
      return null;
    }

    const bilateral = edges.length >= 2;

    if (bilateral) {
      return (availableCross / (2 * maxAmount)) * 0.95;
    }

    return ((availableCross / 2) / maxAmount) * 0.95;
  }

  function fitCurvedInternalEdgeGroupsToViewBox(diagram, positions, axes, layoutOptions) {
    if (!layoutOptions.orientation.startsWith("horizontal")) {
      return;
    }

    const manual = new Set(Object.keys(diagram.manualPositions || {}));
    const availableCross = axes.crossEnd - axes.crossStart;

    curvedInternalEdgeGroups(diagram).forEach(({ nodes, edges }) => {
      const [firstNode, secondNode] = nodes;
      const first = positions[firstNode];
      const second = positions[secondNode];

      if (!first || !second || nodes.some((node) => manual.has(node))) {
        return;
      }

      const maxChord = maxChordForCurvedEdgeGroup(edges, availableCross);
      const currentChord = Math.abs(first.x - second.x);

      if (maxChord && currentChord > maxChord) {
        const midLayer = (first.x + second.x) / 2;
        const halfChord = maxChord / 2;

        first.x = midLayer - halfChord;
        second.x = midLayer + halfChord;
      }

      const targetCross = (axes.crossStart + axes.crossEnd) / 2;

      axes.setCross(first, targetCross);
      axes.setCross(second, targetCross);
    });
  }

  function layoutEdgePathBounds(diagram, positions) {
    const bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    };
    let hasGeometry = false;

    diagram.edges.forEach((edge) => {
      if (edge.hidden) {
        return;
      }

      const from = positions[edge.from];
      const to = positions[edge.to];

      if (!from || !to) {
        return;
      }

      const numbers = edgePath(edge, from, to).match(/-?\d+(?:\.\d+)?/g);

      if (!numbers) {
        return;
      }

      numbers.map(Number).forEach((value, index) => {
        if (index % 2 === 0) {
          hasGeometry = true;
          bounds.minX = Math.min(bounds.minX, value);
          bounds.maxX = Math.max(bounds.maxX, value);
          return;
        }

        bounds.minY = Math.min(bounds.minY, value);
        bounds.maxY = Math.max(bounds.maxY, value);
      });
    });

    return hasGeometry ? bounds : null;
  }

  function fitLayoutTranslationToEdgeBounds(diagram, positions, layoutOptions) {
    const bounds = layoutEdgePathBounds(diagram, positions);

    if (!bounds) {
      return;
    }

    const minX = layoutOptions.marginX;
    const maxX = layoutOptions.width - layoutOptions.marginX;
    const minY = layoutOptions.marginY;
    const maxY = layoutOptions.height - layoutOptions.marginY;
    let offsetX = 0;
    let offsetY = 0;

    if (bounds.minX < minX) {
      offsetX = minX - bounds.minX;
    } else if (bounds.maxX > maxX) {
      offsetX = maxX - bounds.maxX;
    }

    if (bounds.minY < minY) {
      offsetY = minY - bounds.minY;
    } else if (bounds.maxY > maxY) {
      offsetY = maxY - bounds.maxY;
    }

    if (!offsetX && !offsetY) {
      return;
    }

    Object.values(positions).forEach((position) => {
      position.x += offsetX;
      position.y += offsetY;
    });
  }

  function straightenSingleTerminalLegs(diagram, positions, axes) {
    const manual = new Set(Object.keys(diagram.manualPositions || {}));
    const terminalKinds = ["incoming", "outgoing"];

    terminalKinds.forEach((kind) => {
      const terminalsByInternal = terminalNeighborsByInternal(diagram, kind, manual);

      terminalsByInternal.forEach((terminals, internal) => {
        if (terminals.size !== 1 || !positions[internal]) {
          return;
        }

        const terminal = Array.from(terminals)[0];

        if (!positions[terminal]) {
          return;
        }

        if (canMoveTerminalCross(terminal, axes.crossOf(positions[internal]), positions, axes, kind)) {
          axes.setCross(positions[terminal], axes.crossOf(positions[internal]));
        }
      });
    });
  }

  function alignVerticalProcessTerminalStacks(diagram, positions, axes, layoutOptions) {
    if (!layoutOptions.orientation.startsWith("vertical")) {
      return;
    }

    const manual = new Set(Object.keys(diagram.manualPositions || {}));
    const orderedInternals = [];
    const terminalsByInternal = new Map();

    diagram.incoming.forEach((terminal) => {
      const internals = visibleInternalNeighborsForTerminal(diagram, terminal, manual);

      if (internals.length !== 1) {
        return;
      }

      const internal = internals[0];

      if (!orderedInternals.includes(internal)) {
        orderedInternals.push(internal);
      }

      addTerminalForInternal(terminalsByInternal, internal, terminal);
    });

    diagram.outgoing.forEach((terminal) => {
      const internals = visibleInternalNeighborsForTerminal(diagram, terminal, manual);

      if (internals.length !== 1) {
        return;
      }

      const internal = internals[0];

      if (!orderedInternals.includes(internal)) {
        orderedInternals.push(internal);
      }

      addTerminalForInternal(terminalsByInternal, internal, terminal);
    });

    if (orderedInternals.length < 2) {
      return;
    }

    orderedInternals.forEach((internal, index) => {
      const cross = crossCoordinateAt(index, orderedInternals.length, axes.crossStart, axes.crossEnd);

      if (positions[internal] && !manual.has(internal)) {
        axes.setCross(positions[internal], cross);
      }

      (terminalsByInternal.get(internal) || []).forEach((terminal) => {
        if (positions[terminal] && !manual.has(terminal)) {
          axes.setCross(positions[terminal], cross);
        }
      });
    });
  }

  function addTerminalForInternal(terminalsByInternal, internal, terminal) {
    if (!terminalsByInternal.has(internal)) {
      terminalsByInternal.set(internal, []);
    }

    if (!terminalsByInternal.get(internal).includes(terminal)) {
      terminalsByInternal.get(internal).push(terminal);
    }
  }

  function alignInternalsAcrossInvisibleTerminalPairs(diagram, positions, axes) {
    const manual = new Set(Object.keys(diagram.manualPositions || {}));
    const terminalKinds = new Set(["incoming", "outgoing"]);

    diagram.edges.forEach((edge) => {
      if (!edge.hidden) {
        return;
      }

      const fromKind = nodeKind(edge.from, diagram);
      const toKind = nodeKind(edge.to, diagram);

      if (!terminalKinds.has(fromKind) || fromKind !== toKind) {
        return;
      }

      const internalsFrom = visibleInternalNeighborsForTerminal(diagram, edge.from, manual);
      const internalsTo = visibleInternalNeighborsForTerminal(diagram, edge.to, manual);

      if (internalsFrom.length !== 1 || internalsTo.length !== 1) {
        return;
      }

      const firstInternal = internalsFrom[0];
      const secondInternal = internalsTo[0];

      if (
        firstInternal === secondInternal
        || !positions[firstInternal]
        || !positions[secondInternal]
        || manual.has(firstInternal)
        || manual.has(secondInternal)
      ) {
        return;
      }

      const sharedLayer = (
        positions[firstInternal].x
        + positions[secondInternal].x
      ) / 2;

      positions[firstInternal].x = sharedLayer;
      positions[secondInternal].x = sharedLayer;
    });
  }

  function visibleInternalNeighborsForTerminal(diagram, terminal, excludedInternals = new Set()) {
    const neighbors = [];

    diagram.edges.forEach((edge) => {
      if (edge.hidden) {
        return;
      }

      if (edge.from === terminal && nodeKind(edge.to, diagram) === "internal" && !excludedInternals.has(edge.to)) {
        neighbors.push(edge.to);
      }

      if (edge.to === terminal && nodeKind(edge.from, diagram) === "internal" && !excludedInternals.has(edge.from)) {
        neighbors.push(edge.from);
      }
    });

    return neighbors;
  }

  function terminalNeighborsByInternal(diagram, kind, excludedTerminals = new Set()) {
    const terminalsByInternal = new Map();

    diagram.edges.forEach((edge) => {
      if (edge.hidden) {
        return;
      }

      const fromKind = nodeKind(edge.from, diagram);
      const toKind = nodeKind(edge.to, diagram);
      let terminal = null;
      let internal = null;

      if (fromKind === kind && toKind === "internal") {
        terminal = edge.from;
        internal = edge.to;
      }

      if (toKind === kind && fromKind === "internal") {
        terminal = edge.to;
        internal = edge.from;
      }

      if (!terminal || !internal || excludedTerminals.has(terminal)) {
        return;
      }

      if (!terminalsByInternal.has(internal)) {
        terminalsByInternal.set(internal, new Set());
      }

      terminalsByInternal.get(internal).add(terminal);
    });

    return terminalsByInternal;
  }

  function canMoveTerminalCross(node, cross, positions, axes, kind) {
    const minGap = 28;

    return Object.entries(positions).every(([otherNode, position]) => (
      otherNode === node
      || position.kind === "internal"
      || position.kind !== kind
      || Math.abs(axes.crossOf(position) - cross) >= minGap
    ));
  }

  function finalizeLayout(diagram, layout, layoutOptions) {
    applyTikzPostLayoutOrientation(diagram, layout, layoutOptions);
    applyManualPositions(layout.positions, diagram, layoutOptions);
    layout.options = layoutOptions;

    return layout;
  }

  function applyManualPositions(positions, diagram, layoutOptions) {
    Object.entries(diagram.manualPositions || {}).forEach(([node, position]) => {
      const kind = nodeKind(node, diagram);

      positions[node] = {
        x: position.x,
        y: position.y,
        kind,
        labelSide: labelSideForKind(kind, layoutOptions.orientation),
      };
    });
  }

  function applyTikzPostLayoutOrientation(diagram, layout, layoutOptions) {
    const orientation = layoutOptions.tikzOrientation;

    if (!orientation) {
      return;
    }

    const from = layout.positions[orientation.from];
    const to = layout.positions[orientation.to];

    if (!from || !to) {
      return;
    }

    const currentAngle = Math.atan2(to.y - from.y, to.x - from.x);
    const targetAngle = degreesToRadians(orientation.angle);
    const rotation = targetAngle - currentAngle;
    const pivot = { x: from.x, y: from.y };

    Object.values(layout.positions).forEach((position) => {
      rotatePositionAround(position, pivot, rotation);
    });

    if (orientation.flip) {
      Object.values(layout.positions).forEach((position) => {
        reflectPositionAcrossLine(position, pivot, targetAngle);
      });
    }

    fanTikzOrientationMixedTerminalPairs(diagram, layout, orientation);
    fanTikzOrientationProcessTerminalGroups(diagram, layout, orientation);
    enforceDeclaredExternalOrder(diagram, layout.positions, diagramAxes(layoutOptions));
    fitLayoutPositions(layout, layoutOptions);
  }

  function fanTikzOrientationMixedTerminalPairs(diagram, layout, orientation) {
    const from = layout.positions[orientation.from];
    const to = layout.positions[orientation.to];

    if (!from || !to) {
      return;
    }

    const axis = lineVector(from, to);
    const axisGap = clamp(Math.min(layout.width, layout.height) * 0.24, 72, 104);
    const fanGap = orientation.axis === "vertical"
      ? clamp(Math.min(layout.width, layout.height) * 0.45, 126, 150)
      : clamp(Math.min(layout.width, layout.height) * 0.33, 84, 126);

    [
      { internal: orientation.from, outward: -1 },
      { internal: orientation.to, outward: 1 },
    ].forEach(({ internal, outward }) => {
      const endpoint = layout.positions[internal];
      const terminals = mixedTerminalPairForInternal(diagram, internal);

      if (!endpoint || !terminals) {
        return;
      }

      moveTerminalIntoOrientationFan(
        layout.positions[terminals.incoming],
        endpoint,
        axis,
        outward,
        1,
        axisGap,
        fanGap
      );
      moveTerminalIntoOrientationFan(
        layout.positions[terminals.outgoing],
        endpoint,
        axis,
        outward,
        -1,
        axisGap,
        fanGap
      );
    });
  }

  function mixedTerminalPairForInternal(diagram, internal) {
    const terminals = { incoming: [], outgoing: [] };
    const terminalKinds = new Set(["incoming", "outgoing"]);

    diagram.edges.forEach((edge) => {
      if (edge.hidden) {
        return;
      }

      let terminal = null;

      if (edge.from === internal && terminalKinds.has(nodeKind(edge.to, diagram))) {
        terminal = edge.to;
      }

      if (edge.to === internal && terminalKinds.has(nodeKind(edge.from, diagram))) {
        terminal = edge.from;
      }

      if (!terminal) {
        return;
      }

      terminals[nodeKind(terminal, diagram)].push(terminal);
    });

    if (terminals.incoming.length !== 1 || terminals.outgoing.length !== 1) {
      return null;
    }

    return {
      incoming: terminals.incoming[0],
      outgoing: terminals.outgoing[0],
    };
  }

  function fanTikzOrientationProcessTerminalGroups(diagram, layout, orientation) {
    const from = layout.positions[orientation.from];
    const to = layout.positions[orientation.to];

    if (!from || !to) {
      return;
    }

    const axis = lineVector(from, to);
    const axisGap = clamp(Math.min(layout.width, layout.height) * 0.24, 72, 104);
    const fanGap = clamp(Math.min(layout.width, layout.height) * 0.33, 84, 126);

    [
      { internal: orientation.from, kind: "incoming", outward: -1 },
      { internal: orientation.to, kind: "outgoing", outward: 1 },
    ].forEach(({ internal, kind, outward }) => {
      const endpoint = layout.positions[internal];
      const terminals = Array.from(terminalNeighborsByInternal(diagram, kind).get(internal) || [])
        .filter((terminal) => layout.positions[terminal])
        .sort((left, right) => terminalDeclarationOrder(diagram, kind, left) - terminalDeclarationOrder(diagram, kind, right) || left.localeCompare(right));

      if (!endpoint || terminals.length < 2) {
        return;
      }

      terminals.forEach((terminal, index) => {
        const side = terminals.length === 1
          ? 0
          : -1 + (2 * index) / (terminals.length - 1);
        const position = layout.positions[terminal];

        position.x = endpoint.x + axis.ux * axisGap * outward + axis.px * fanGap * side;
        position.y = endpoint.y + axis.uy * axisGap * outward + axis.py * fanGap * side;
      });
    });
  }

  function terminalDeclarationOrder(diagram, kind, terminal) {
    const list = kind === "incoming" ? diagram.incoming : diagram.outgoing;
    const index = list.indexOf(terminal);

    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  function moveTerminalIntoOrientationFan(position, endpoint, axis, outward, side, axisGap, fanGap) {
    if (!position) {
      return;
    }

    position.x = endpoint.x + axis.ux * axisGap * outward + axis.px * fanGap * side;
    position.y = endpoint.y + axis.uy * axisGap * outward + axis.py * fanGap * side;
  }

  function rotatePositionAround(position, pivot, angle) {
    const dx = position.x - pivot.x;
    const dy = position.y - pivot.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    position.x = pivot.x + dx * cos - dy * sin;
    position.y = pivot.y + dx * sin + dy * cos;
  }

  function reflectPositionAcrossLine(position, pivot, angle) {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const dx = position.x - pivot.x;
    const dy = position.y - pivot.y;
    const parallel = dx * ux + dy * uy;
    const projection = {
      x: pivot.x + parallel * ux,
      y: pivot.y + parallel * uy,
    };

    position.x = 2 * projection.x - position.x;
    position.y = 2 * projection.y - position.y;
  }

  function fitLayoutPositions(layout, layoutOptions) {
    const positions = Object.values(layout.positions);

    if (!positions.length) {
      return;
    }

    const bounds = positionBounds(positions);
    const availableWidth = Math.max(1, layoutOptions.width - 2 * layoutOptions.marginX);
    const availableHeight = Math.max(1, layoutOptions.height - 2 * layoutOptions.marginY);
    const scale = Math.min(
      1,
      availableWidth / Math.max(1, bounds.maxX - bounds.minX),
      availableHeight / Math.max(1, bounds.maxY - bounds.minY)
    );
    const scaledWidth = (bounds.maxX - bounds.minX) * scale;
    const scaledHeight = (bounds.maxY - bounds.minY) * scale;
    const offsetX = layoutOptions.marginX + (availableWidth - scaledWidth) / 2 - bounds.minX * scale;
    const offsetY = layoutOptions.marginY + (availableHeight - scaledHeight) / 2 - bounds.minY * scale;

    positions.forEach((position) => {
      position.x = position.x * scale + offsetX;
      position.y = position.y * scale + offsetY;
    });
  }

  function positionBounds(positions) {
    return {
      minX: Math.min(...positions.map((position) => position.x)),
      maxX: Math.max(...positions.map((position) => position.x)),
      minY: Math.min(...positions.map((position) => position.y)),
      maxY: Math.max(...positions.map((position) => position.y)),
    };
  }

  function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function layoutSymmetricContact(diagram, layoutOptions, prepared) {
    const { width, height, marginX, marginY } = layoutOptions;
    const positions = initialFixedPositions(diagram, diagramAxes(layoutOptions));
    const structuralCenter = {
      x: width / 2,
      y: height / 2,
    };
    const centerNode = prepared.topology.internalVertices[0] || prepared.topology.graphCenters[0];
    const externalNodes = orderedSemanticExternalNodes(prepared);
    const radius = Math.max(
      54,
      Math.min(width - 2 * marginX, height - 2 * marginY) * 0.38
    );

    if (centerNode && !positions[centerNode]) {
      positions[centerNode] = {
        ...structuralCenter,
        kind: nodeKind(centerNode, diagram),
        labelSide: labelSideForKind(nodeKind(centerNode, diagram), layoutOptions.orientation),
      };
    }

    const contactCenter = centerNode && positions[centerNode]
      ? positions[centerNode]
      : structuralCenter;

    placeNodesOnRing(
      externalNodes,
      contactCenter,
      radius,
      positions,
      diagram,
      layoutOptions,
      contactStarStartAngle(externalNodes.length)
    );

    Array.from(collectNodes(diagram)).sort().forEach((node) => {
      if (!positions[node]) {
        positions[node] = {
          ...contactCenter,
          kind: nodeKind(node, diagram),
          labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
        };
      }
    });

    return { width, height, positions, options: layoutOptions };
  }

  function contactStarStartAngle(count) {
    if (count % 2 === 1) {
      const medianIndex = Math.floor(count / 2);

      return -Math.PI / 2 - (2 * Math.PI * medianIndex) / count;
    }

    return -Math.PI / 2 - Math.PI / Math.max(count, 1);
  }

  function layoutSymmetricUnclassifiedRefinement(diagram, layoutOptions, prepared) {
    const refinement = prepared.symmetricUnclassified;
    const { width, height, marginX, marginY } = layoutOptions;
    const positions = initialFixedPositions(diagram, diagramAxes(layoutOptions));
    const center = { x: width / 2, y: height / 2 };
    const axes = diagramAxes(layoutOptions);
    const vertical = axes.orientation === "vertical" || axes.orientation === "vertical-reverse";

    if (refinement.kind === "twoCenterTree") {
      const leftCenter = refinement.leftCenter;
      const rightCenter = refinement.rightCenter;
      const leftLeaves = orderedLeafNodes(prepared, refinement.leftLeaves);
      const rightLeaves = orderedLeafNodes(prepared, refinement.rightLeaves);

      if (vertical) {
        placeSymmetricTwoCenterTreeVertical(
          positions,
          diagram,
          layoutOptions,
          axes,
          leftCenter,
          rightCenter,
          leftLeaves,
          rightLeaves,
          refinement
        );
      } else {
        placeSymmetricTwoCenterTreeHorizontal(
          positions,
          diagram,
          layoutOptions,
          axes,
          leftCenter,
          rightCenter,
          leftLeaves,
          rightLeaves,
          refinement
        );
      }
    } else if (refinement.kind === "twoPointLoop") {
      const [endpointA, endpointB] = refinement.loopEndpoints;
      const legA = refinement.externalLegs.find((leg) => leg.internal === endpointA);
      const legB = refinement.externalLegs.find((leg) => leg.internal === endpointB);

      if (vertical) {
        placeSymmetricTwoPointLoopVertical(
          positions,
          diagram,
          layoutOptions,
          axes,
          endpointA,
          endpointB,
          legA,
          legB
        );
      } else {
        placeSymmetricTwoPointLoopHorizontal(
          positions,
          diagram,
          layoutOptions,
          axes,
          endpointA,
          endpointB,
          legA,
          legB
        );
      }
    }

    Array.from(collectNodes(diagram)).sort().forEach((node) => {
      if (!positions[node]) {
        positions[node] = {
          ...center,
          kind: nodeKind(node, diagram),
          labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
        };
      }
    });

    return { width, height, positions, options: layoutOptions };
  }

  function orderedLeafNodes(prepared, leaves) {
    return leaves.slice().sort((left, right) => compareExternalOrdering(prepared.externalOrdering, left, right));
  }

  function placeSymmetricTwoCenterTreeHorizontal(positions, diagram, layoutOptions, axes, leftCenter, rightCenter, leftLeaves, rightLeaves, refinement = {}) {
    const { width, height, marginY } = layoutOptions;

    if (refinement.centerExternal) {
      placeSymmetricCenterExternalHorizontal(
        positions,
        diagram,
        layoutOptions,
        width,
        height,
        marginY,
        refinement.centerExternal,
        refinement.centerAttachedCenter === leftCenter
      );
    }

    placeExternalNodes(leftLeaves, axes.layerStart, axes.crossStart, axes.crossEnd, "unclassified", axes, positions);
    placeExternalNodes(rightLeaves, axes.layerEnd, axes.crossStart, axes.crossEnd, "unclassified", axes, positions);

    const layerSpan = axes.layerEnd - axes.layerStart;
    const terminalGap = Math.min(84, Math.max(48, Math.abs(layerSpan) * 0.24));
    const direction = Math.sign(layerSpan) || 1;
    const leftLayer = axes.layerStart + direction * terminalGap;
    const rightLayer = axes.layerEnd - direction * terminalGap;
    const leftCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === leftCenter
      ? [...leftLeaves, refinement.centerExternal]
      : leftLeaves;
    const rightCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === rightCenter
      ? [...rightLeaves, refinement.centerExternal]
      : rightLeaves;

    placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, axes, leftCenter, leftLayer, leftCrossLeaves);
    placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, axes, rightCenter, rightLayer, rightCrossLeaves);
  }

  function placeSymmetricTwoCenterTreeVertical(positions, diagram, layoutOptions, axes, leftCenter, rightCenter, leftLeaves, rightLeaves, refinement = {}) {
    const { width, marginX } = layoutOptions;
    const sideAxes = {
      ...axes,
      crossOf: (position) => position.x,
      setCross: (position, cross) => {
        position.x = cross;
      },
      point: (cross, layer, kind) => ({
        x: cross,
        y: layer,
        kind,
        labelSide: labelSideForKind(kind, layoutOptions.orientation),
      }),
    };

    if (refinement.centerExternal) {
      placeSymmetricCenterExternalVertical(
        positions,
        diagram,
        layoutOptions,
        width,
        marginX,
        refinement.centerExternal,
        refinement.centerAttachedCenter === leftCenter
      );
    }

    placeExternalNodes(leftLeaves, axes.crossStart, axes.layerStart, axes.layerEnd, "unclassified", sideAxes, positions);
    placeExternalNodes(rightLeaves, axes.crossEnd, axes.layerStart, axes.layerEnd, "unclassified", sideAxes, positions);

    const layerSpan = axes.layerEnd - axes.layerStart;
    const terminalGap = Math.min(84, Math.max(48, Math.abs(layerSpan) * 0.24));
    const direction = Math.sign(layerSpan) || 1;
    const leftLayer = axes.layerStart + direction * terminalGap;
    const rightLayer = axes.layerEnd - direction * terminalGap;
    const verticalAxes = {
      crossOf: (position) => position.x,
      point: (cross, layer, kind) => ({
        x: cross,
        y: layer,
        kind,
        labelSide: labelSideForKind(kind, layoutOptions.orientation),
      }),
    };

    const leftCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === leftCenter
      ? [...leftLeaves, refinement.centerExternal]
      : leftLeaves;
    const rightCrossLeaves = refinement.centerExternal && refinement.centerAttachedCenter === rightCenter
      ? [...rightLeaves, refinement.centerExternal]
      : rightLeaves;

    placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, verticalAxes, leftCenter, leftLayer, leftCrossLeaves, "y");
    placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, verticalAxes, rightCenter, rightLayer, rightCrossLeaves, "y");
  }

  function placeSymmetricCenterExternalHorizontal(positions, diagram, layoutOptions, width, height, marginY, node, useTopMiddle) {
    if (!node || positions[node]) {
      return;
    }

    positions[node] = {
      x: width / 2,
      y: useTopMiddle ? marginY : height - marginY,
      kind: nodeKind(node, diagram),
      labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
    };
  }

  function placeSymmetricCenterExternalVertical(positions, diagram, layoutOptions, width, marginX, node, useStartMiddle) {
    if (!node || positions[node]) {
      return;
    }

    positions[node] = {
      x: useStartMiddle ? marginX : width - marginX,
      y: layoutOptions.height / 2,
      kind: nodeKind(node, diagram),
      labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
    };
  }

  function symmetricTwoPointLoopLayers(axes) {
    const span = Math.abs(axes.layerEnd - axes.layerStart);
    const minLeg = 48;
    const loopChord = Math.min(span - 2 * minLeg, Math.max(120, span * 0.452));
    const legLength = (span - loopChord) / 2;
    const direction = Math.sign(axes.layerEnd - axes.layerStart) || 1;

    return {
      centerCross: (axes.crossStart + axes.crossEnd) / 2,
      externalStart: axes.layerStart,
      externalEnd: axes.layerEnd,
      internalStart: axes.layerStart + direction * legLength,
      internalEnd: axes.layerEnd - direction * legLength,
    };
  }

  function placeSymmetricTwoPointLoopHorizontal(positions, diagram, layoutOptions, axes, endpointA, endpointB, legA, legB) {
    const layers = symmetricTwoPointLoopLayers(axes);

    if (legA && !positions[legA.external]) {
      positions[legA.external] = axes.point(layers.externalStart, layers.centerCross, "unclassified");
    }

    if (legB && !positions[legB.external]) {
      positions[legB.external] = axes.point(layers.externalEnd, layers.centerCross, "unclassified");
    }

    if (!positions[endpointA]) {
      positions[endpointA] = axes.point(layers.internalStart, layers.centerCross, "internal");
    }

    if (!positions[endpointB]) {
      positions[endpointB] = axes.point(layers.internalEnd, layers.centerCross, "internal");
    }
  }

  function placeSymmetricTwoPointLoopVertical(positions, diagram, layoutOptions, axes, endpointA, endpointB, legA, legB) {
    const verticalAxes = {
      orientation: axes.orientation,
      layerStart: axes.crossStart,
      layerEnd: axes.crossEnd,
      crossStart: axes.layerStart,
      crossEnd: axes.layerEnd,
      crossOf: (position) => position.x,
      setCross: (position, cross) => {
        position.x = cross;
      },
      point: (cross, layer, kind) => ({
        x: cross,
        y: layer,
        kind,
        labelSide: labelSideForKind(kind, layoutOptions.orientation),
      }),
    };
    const layers = symmetricTwoPointLoopLayers(verticalAxes);

    if (legA && !positions[legA.external]) {
      positions[legA.external] = verticalAxes.point(layers.centerCross, layers.externalStart, "unclassified");
    }

    if (legB && !positions[legB.external]) {
      positions[legB.external] = verticalAxes.point(layers.centerCross, layers.externalEnd, "unclassified");
    }

    if (!positions[endpointA]) {
      positions[endpointA] = verticalAxes.point(layers.centerCross, layers.internalStart, "internal");
    }

    if (!positions[endpointB]) {
      positions[endpointB] = verticalAxes.point(layers.centerCross, layers.internalEnd, "internal");
    }
  }

  function placeSymmetricInternalOnLayer(positions, diagram, layoutOptions, axes, centerNode, layer, leaves, layerAxis = "x") {
    if (positions[centerNode]) {
      return;
    }

    const crosses = leaves
      .map((leaf) => positions[leaf])
      .filter(Boolean)
      .map((position) => axes.crossOf(position));
    const cross = crosses.length
      ? crosses.reduce((sum, value) => sum + value, 0) / crosses.length
      : (layoutOptions.marginY + (layoutOptions.height - layoutOptions.marginY)) / 2;

    positions[centerNode] = layerAxis === "y"
      ? axes.point(cross, layer, "internal")
      : axes.point(layer, cross, "internal");
  }

  function layoutSymmetricTree(diagram, layoutOptions, prepared) {
    const { width, height, marginX, marginY } = layoutOptions;
    const positions = initialFixedPositions(diagram, diagramAxes(layoutOptions));
    const allNodes = Array.from(collectNodes(diagram)).sort();
    const centerNode = prepared.topology.graphCenters[0] || allNodes[0];
    const center = { x: width / 2, y: height / 2 };
    const adjacency = visibleAdjacencyForLayout(diagram, allNodes);
    const depths = breadthFirstLayoutDepths(adjacency, centerNode);
    const maxDepth = Math.max(1, ...Array.from(depths.values()));
    const maxRadius = Math.max(60, Math.min(width - 2 * marginX, height - 2 * marginY) * 0.42);
    const nodesByDepth = new Map();

    allNodes.forEach((node) => {
      const depth = depths.get(node) ?? maxDepth;

      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }

      nodesByDepth.get(depth).push(node);
    });

    nodesByDepth.forEach((nodes, depth) => {
      const sortedNodes = nodes.sort((left, right) => semanticOrder(prepared, left, right));

      if (depth === 0) {
        sortedNodes.forEach((node) => {
          if (!positions[node]) {
            positions[node] = {
              ...center,
              kind: nodeKind(node, diagram),
              labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
            };
          }
        });
        return;
      }

      const radius = (maxRadius * depth) / maxDepth;
      const startAngle = sortedNodes.length === 1 ? 0 : -Math.PI / 2;

      placeNodesOnRing(sortedNodes, center, radius, positions, diagram, layoutOptions, startAngle);
    });

    return { width, height, positions, options: layoutOptions };
  }

  function orderedSemanticExternalNodes(prepared) {
    return prepared.externalOrdering.all.map((entry) => entry.id);
  }

  function semanticOrder(prepared, left, right) {
    const leftExternal = prepared.semantic.externalVertices.includes(left);
    const rightExternal = prepared.semantic.externalVertices.includes(right);

    if (leftExternal || rightExternal) {
      return compareExternalOrdering(prepared.externalOrdering, left, right);
    }

    const vertexById = new Map(prepared.semantic.vertices.map((vertex) => [vertex.id, vertex]));
    const leftIndex = vertexById.get(left)?.metadata?.declarationIndex ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = vertexById.get(right)?.metadata?.declarationIndex ?? Number.MAX_SAFE_INTEGER;

    return leftIndex - rightIndex || left.localeCompare(right);
  }

  function placeNodesOnRing(nodes, center, radius, positions, diagram, layoutOptions, startAngle) {
    const count = Math.max(nodes.length, 1);

    nodes.forEach((node, index) => {
      if (positions[node]) {
        return;
      }

      const angle = startAngle + (2 * Math.PI * index) / count;
      const kind = nodeKind(node, diagram);

      positions[node] = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        kind,
        labelSide: labelSideForKind(kind, layoutOptions.orientation),
      };
    });
  }

  function visibleAdjacencyForLayout(diagram, nodes) {
    const adjacency = new Map(nodes.map((node) => [node, new Set()]));

    diagram.edges.forEach((edge) => {
      if (edge.hidden || edge.from === edge.to) {
        return;
      }

      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, new Set());
      }

      if (!adjacency.has(edge.to)) {
        adjacency.set(edge.to, new Set());
      }

      adjacency.get(edge.from).add(edge.to);
      adjacency.get(edge.to).add(edge.from);
    });

    return adjacency;
  }

  function breadthFirstLayoutDepths(adjacency, start) {
    const depths = new Map();

    if (!start) {
      return depths;
    }

    const queue = [start];
    depths.set(start, 0);

    while (queue.length) {
      const node = queue.shift();
      const nextDepth = depths.get(node) + 1;

      Array.from(adjacency.get(node) || [])
        .sort()
        .forEach((neighbor) => {
          if (!depths.has(neighbor)) {
            depths.set(neighbor, nextDepth);
            queue.push(neighbor);
          }
        });
    }

    return depths;
  }

  function layoutLayered(diagram, layoutOptions) {
    const { width, height } = layoutOptions;
    const axes = diagramAxes(layoutOptions);
    const positions = initialFixedPositions(diagram, axes);
    const incoming = new Set(diagram.incoming);
    const outgoing = new Set(diagram.outgoing);
    const unclassified = new Set(diagram.unclassified || []);
    const allNodes = collectNodes(diagram);

    placeExternalNodes(diagram.incoming, axes.layerStart, axes.crossStart, axes.crossEnd, "incoming", axes, positions);
    placeExternalNodes(diagram.outgoing, axes.layerEnd, axes.crossStart, axes.crossEnd, "outgoing", axes, positions);

    const internalNodes = Array.from(allNodes).filter((node) => (
      !incoming.has(node) && !outgoing.has(node) && !unclassified.has(node) && !positions[node]
    ));
    const layerByNode = computeInternalLayers(diagram, internalNodes, incoming);
    const maxLayer = Math.max(1, ...Array.from(layerByNode.values()));
    const layers = new Map();

    internalNodes.forEach((node) => {
      const layer = layerByNode.get(node) || 1;
      const layerPosition = axes.layerStart + ((axes.layerEnd - axes.layerStart) * layer) / (maxLayer + 1);
      const cross = estimateInternalCross(node, diagram, positions, axes);

      if (!layers.has(layer)) {
        layers.set(layer, []);
      }

      layers.get(layer).push({ node, layer: layerPosition, cross });
    });

    layers.forEach((nodes) => {
      distributeLayer(nodes, axes.crossStart, axes.crossEnd).forEach(({ node, layer, cross }) => {
        positions[node] = axes.point(layer, cross, "internal");
      });
    });

    placeNodesOnRing(
      Array.from(unclassified).filter((node) => !positions[node]),
      { x: width / 2, y: height / 2 },
      Math.max(52, Math.min(width - 2 * layoutOptions.marginX, height - 2 * layoutOptions.marginY) * 0.38),
      positions,
      diagram,
      layoutOptions,
      -3 * Math.PI / 4
    );

    return { width, height, positions, options: layoutOptions };
  }

  function layoutTree(diagram, layoutOptions) {
    const { width, height } = layoutOptions;
    const axes = diagramAxes(layoutOptions);
    const positions = initialFixedPositions(diagram, axes);
    const allNodes = Array.from(collectNodes(diagram)).filter((node) => !positions[node]);
    const nodeSet = new Set(allNodes);
    const childrenByNode = treeChildrenByNode(diagram, nodeSet);
    const roots = treeRoots(diagram, allNodes, nodeSet);
    const depthByNode = new Map();
    const slotByNode = new Map();
    const visited = new Set();
    const visiting = new Set();
    let nextSlot = 0;

    const assignSubtree = (node, depth) => {
      if (!nodeSet.has(node)) {
        return null;
      }

      depthByNode.set(node, Math.max(depthByNode.get(node) ?? 0, depth));

      if (slotByNode.has(node)) {
        return slotByNode.get(node);
      }

      if (visiting.has(node)) {
        return null;
      }

      visiting.add(node);

      const childSlots = (childrenByNode.get(node) || [])
        .map((child) => assignSubtree(child, depth + 1))
        .filter((slot) => slot !== null);

      let slot;

      if (childSlots.length) {
        slot = childSlots.reduce((sum, childSlot) => sum + childSlot, 0) / childSlots.length;
      } else {
        slot = nextSlot;
        nextSlot += 1;
      }

      slotByNode.set(node, slot);
      visiting.delete(node);
      visited.add(node);

      return slot;
    };

    roots.forEach((root) => {
      assignSubtree(root, 0);
    });

    allNodes.forEach((node) => {
      if (!visited.has(node)) {
        assignSubtree(node, 0);
      }
    });

    allNodes.forEach((node) => {
      const maxDepth = Math.max(1, ...Array.from(depthByNode.values()));
      const depth = depthByNode.get(node) ?? 0;
      const slotCount = Math.max(nextSlot, 1);
      const kind = nodeKind(node, diagram);
      const layer = treeLayerForNode(kind, depth, maxDepth, axes);
      const cross = slotCoordinateAt(slotByNode.get(node) ?? 0, slotCount, axes.crossStart, axes.crossEnd);

      positions[node] = axes.point(layer, cross, kind);
    });

    return { width, height, positions, options: layoutOptions };
  }

  function treeLayerForNode(kind, depth, maxDepth, axes) {
    if (kind === "incoming") {
      return axes.layerStart;
    }

    if (kind === "outgoing") {
      return axes.layerEnd;
    }

    return axes.layerStart + ((axes.layerEnd - axes.layerStart) * depth) / maxDepth;
  }

  function treeChildrenByNode(diagram, nodeSet) {
    const childrenByNode = new Map();

    const addChild = (parent, child) => {
      if (!childrenByNode.has(parent)) {
        childrenByNode.set(parent, []);
      }

      const children = childrenByNode.get(parent);

      if (!children.includes(child)) {
        children.push(child);
      }
    };

    diagram.edges.forEach((edge) => {
      if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to) || edge.from === edge.to) {
        return;
      }

      const direction = treeLayoutEdgeDirection(edge, diagram);

      if (direction) {
        addChild(direction.parent, direction.child);
      }
    });

    return childrenByNode;
  }

  function treeLayoutEdgeDirection(edge, diagram) {
    const fromKind = nodeKind(edge.from, diagram);
    const toKind = nodeKind(edge.to, diagram);

    if (fromKind === "incoming" && toKind !== "incoming") {
      return { parent: edge.from, child: edge.to };
    }

    if (toKind === "incoming" && fromKind !== "incoming") {
      return { parent: edge.to, child: edge.from };
    }

    if (fromKind !== "outgoing" && toKind === "outgoing") {
      return { parent: edge.from, child: edge.to };
    }

    if (toKind !== "outgoing" && fromKind === "outgoing") {
      return { parent: edge.to, child: edge.from };
    }

    return { parent: edge.from, child: edge.to };
  }

  function treeRoots(diagram, allNodes, nodeSet) {
    const declaredRoots = diagram.incoming.filter((node) => nodeSet.has(node));

    if (declaredRoots.length) {
      return declaredRoots;
    }

    return nodesWithoutIncomingEdges(diagram, allNodes);
  }

  function slotCoordinateAt(slot, count, crossStart, crossEnd) {
    if (count <= 1) {
      return (crossStart + crossEnd) / 2;
    }

    return crossStart + ((crossEnd - crossStart) * slot) / (count - 1);
  }

  function layoutSpring(diagram, layoutOptions, springOptions = {}) {
    const { width, height, marginX, marginY } = layoutOptions;
    const axes = diagramAxes(layoutOptions);
    const base = layoutLayered(diagram, { ...layoutOptions, layout: "layered" });
    const positions = { ...base.positions };
    const allNodes = Array.from(collectNodes(diagram));
    const pinned = new Set([
      ...diagram.incoming,
      ...diagram.outgoing,
      ...Object.keys(diagram.manualPositions || {}),
    ]);
    const crossLocks = axes.stackInternals ? new Map() : terminalCrossLocks(diagram, positions, axes, pinned);
    const targetLength = Math.max(70, Math.min(width, height) / 3);
    const repulsion = targetLength * targetLength * (springOptions.electrical ? 0.16 : 0.08);
    const stiffness = 0.025;

    allNodes.forEach((node, index) => {
      if (positions[node]) {
        return;
      }

      const angle = (Math.PI * 2 * index) / Math.max(allNodes.length, 1);
      positions[node] = {
        x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.25,
        y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.25,
        kind: nodeKind(node, diagram),
        labelSide: labelSideForKind(nodeKind(node, diagram), layoutOptions.orientation),
      };
    });
    applyCrossLocks(positions, crossLocks, axes);

    for (let iteration = 0; iteration < 90; iteration += 1) {
      const forces = new Map(allNodes.map((node) => [node, { x: 0, y: 0 }]));

      for (let first = 0; first < allNodes.length; first += 1) {
        for (let second = first + 1; second < allNodes.length; second += 1) {
          const a = allNodes[first];
          const b = allNodes[second];
          const delta = safeDelta(positions[a], positions[b]);
          const force = repulsion / Math.max(delta.distance * delta.distance, 1);
          const fx = delta.ux * force;
          const fy = delta.uy * force;

          forces.get(a).x -= fx;
          forces.get(a).y -= fy;
          forces.get(b).x += fx;
          forces.get(b).y += fy;
        }
      }

      diagram.edges.forEach((edge) => {
        const from = positions[edge.from];
        const to = positions[edge.to];

        if (!from || !to) {
          return;
        }

        const delta = safeDelta(from, to);
        const force = (delta.distance - targetLength) * stiffness;
        const fx = delta.ux * force;
        const fy = delta.uy * force;

        forces.get(edge.from).x += fx;
        forces.get(edge.from).y += fy;
        forces.get(edge.to).x -= fx;
        forces.get(edge.to).y -= fy;
      });

      allNodes.forEach((node) => {
        if (pinned.has(node)) {
          return;
        }

        const force = forces.get(node);
        positions[node] = clampSpringPosition(
          positions[node],
          force,
          layoutOptions,
          axes,
          diagram
        );
        applyCrossLock(positions[node], crossLocks.get(node), axes);
      });
    }

    applyLayoutNormalizations(diagram, positions, axes, layoutOptions);

    return { width, height, positions, options: layoutOptions };
  }

  function clampSpringPosition(position, force, layoutOptions, axes, diagram) {
    const { width, height, marginX, marginY } = layoutOptions;
    const next = {
      ...position,
      x: clamp(position.x + force.x, marginX, width - marginX),
      y: clamp(position.y + force.y, marginY, height - marginY),
    };

    if (
      position.kind !== "internal"
      || (!diagram.incoming.length && !diagram.outgoing.length)
    ) {
      return next;
    }

    const layerMin = Math.min(axes.layerStart, axes.layerEnd);
    const layerMax = Math.max(axes.layerStart, axes.layerEnd);
    const terminalGap = Math.min(72, Math.max(42, (layerMax - layerMin) * 0.24));

    if (layerMax - layerMin > 2 * terminalGap) {
      next.x = clamp(next.x, layerMin + terminalGap, layerMax - terminalGap);
    }

    return next;
  }

  function terminalCrossLocks(diagram, positions, axes, pinned) {
    const externalKinds = new Set(["incoming", "outgoing"]);
    const constraints = new Map();

    const addConstraint = (node, cross) => {
      if (pinned.has(node)) {
        return;
      }

      if (!constraints.has(node)) {
        constraints.set(node, []);
      }

      constraints.get(node).push(cross);
    };

    diagram.edges.forEach((edge) => {
      if (edge.hidden) {
        return;
      }

      const from = positions[edge.from];
      const to = positions[edge.to];

      if (!from || !to) {
        return;
      }

      const fromExternal = externalKinds.has(from.kind);
      const toExternal = externalKinds.has(to.kind);

      if (fromExternal && !toExternal) {
        addConstraint(edge.to, axes.crossOf(from));
      }

      if (toExternal && !fromExternal) {
        addConstraint(edge.from, axes.crossOf(to));
      }
    });

    const locks = new Map();

    constraints.forEach((crosses, node) => {
      const min = Math.min(...crosses);
      const max = Math.max(...crosses);

      if (max - min <= 1) {
        locks.set(node, crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length);
      }
    });

    return locks;
  }

  function alignInternalsToDeclaredTerminalRows(diagram, positions, axes, layoutOptions) {
    if (!diagram.incoming.length && !diagram.outgoing.length) {
      return;
    }

    const pinned = new Set([
      ...diagram.incoming,
      ...diagram.outgoing,
      ...Object.keys(diagram.manualPositions || {}),
    ]);

    terminalCrossLocks(diagram, positions, axes, pinned).forEach((cross, node) => {
      if (positions[node]?.kind === "internal") {
        axes.setCross(positions[node], cross);
      }
    });

    if (layoutOptions.layout === "spring") {
      alignJunctionsToTerminalRowCorridors(diagram, positions, axes, pinned);
    }

    alignTerminalLaneInternals(diagram, positions, axes, pinned);
  }

  function alignJunctionsToTerminalRowCorridors(diagram, positions, axes, pinned) {
    if (axes.stackInternals) {
      return;
    }

    const externalKinds = new Set(["incoming", "outgoing"]);
    const directLocks = terminalCrossLocks(diagram, positions, axes, pinned);
    const adjacency = visibleAdjacencyForLayout(diagram, Object.keys(positions));
    const tolerance = 1;

    adjacency.forEach((neighbors, node) => {
      const position = positions[node];

      if (
        !position
        || position.kind !== "internal"
        || pinned.has(node)
        || directLocks.has(node)
      ) {
        return;
      }

      const crosses = [];

      neighbors.forEach((neighbor) => {
        const neighborPosition = positions[neighbor];

        if (!neighborPosition) {
          return;
        }

        if (externalKinds.has(neighborPosition.kind)) {
          crosses.push(axes.crossOf(neighborPosition));
          return;
        }

        if (directLocks.has(neighbor)) {
          crosses.push(directLocks.get(neighbor));
        }
      });

      if (crosses.length < 2) {
        return;
      }

      const groups = groupNearbyCrosses(crosses, tolerance);

      if (groups.length < 2) {
        return;
      }

      const largest = Math.max(...groups.map((group) => group.count));
      const dominantGroups = groups.filter((group) => group.count === largest);
      const target = dominantGroups.length === 1 && largest > 1
        ? dominantGroups[0].sum / dominantGroups[0].count
        : crosses.reduce((sum, cross) => sum + cross, 0) / crosses.length;

      axes.setCross(position, target);
    });
  }

  function groupNearbyCrosses(crosses, tolerance) {
    const groups = [];

    crosses
      .filter(Number.isFinite)
      .sort((left, right) => left - right)
      .forEach((cross) => {
        const last = groups[groups.length - 1];

        if (!last || Math.abs(cross - last.center) > tolerance) {
          groups.push({ center: cross, sum: cross, count: 1 });
          return;
        }

        last.sum += cross;
        last.count += 1;
        last.center = last.sum / last.count;
      });

    return groups;
  }

  function alignTerminalLaneInternals(diagram, positions, axes, pinned) {
    if (diagram.incoming.length <= 1 && diagram.outgoing.length <= 1) {
      return;
    }

    const tolerance = 1;
    const moved = new Set();

    diagram.incoming.forEach((incoming) => {
      const incomingPosition = positions[incoming];

      if (!incomingPosition) {
        return;
      }

      diagram.outgoing.forEach((outgoing) => {
        const outgoingPosition = positions[outgoing];

        if (
          !outgoingPosition
          || Math.abs(axes.crossOf(incomingPosition) - axes.crossOf(outgoingPosition)) > tolerance
        ) {
          return;
        }

        const path = terminalLanePath(diagram, positions, axes, incoming, outgoing, axes.crossOf(incomingPosition), tolerance);

        if (!path) {
          return;
        }

        const internals = path.filter((node) => (
          positions[node]?.kind === "internal" && !pinned.has(node) && !moved.has(node)
        ));

        if (!internals.length) {
          return;
        }

        internals.forEach((node, index) => {
          positions[node].x = axes.layerStart
            + ((axes.layerEnd - axes.layerStart) * (index + 1)) / (internals.length + 1);
          moved.add(node);
        });
      });
    });
  }

  function terminalLanePath(diagram, positions, axes, incoming, outgoing, cross, tolerance) {
    const allowed = new Set([incoming, outgoing]);

    Object.entries(positions).forEach(([node, position]) => {
      if (
        position.kind === "internal"
        && Math.abs(axes.crossOf(position) - cross) <= tolerance
      ) {
        allowed.add(node);
      }
    });

    const adjacency = new Map(Array.from(allowed).map((node) => [node, []]));

    diagram.edges.forEach((edge) => {
      if (edge.hidden || !allowed.has(edge.from) || !allowed.has(edge.to)) {
        return;
      }

      adjacency.get(edge.from).push(edge.to);
      adjacency.get(edge.to).push(edge.from);
    });

    adjacency.forEach((neighbors) => {
      neighbors.sort((left, right) => left.localeCompare(right));
    });

    const queue = [[incoming]];
    const visited = new Set([incoming]);

    while (queue.length) {
      const path = queue.shift();
      const node = path[path.length - 1];

      if (node === outgoing) {
        return path;
      }

      (adjacency.get(node) || []).forEach((neighbor) => {
        if (visited.has(neighbor)) {
          return;
        }

        visited.add(neighbor);
        queue.push([...path, neighbor]);
      });
    }

    return null;
  }

  function applyAlignmentConstraints(diagram, positions, layoutOptions) {
    const alignments = layoutOptions.alignments || [];

    if (!alignments.length) {
      return;
    }

    const manual = new Set(Object.keys(diagram.manualPositions || {}));

    alignments.forEach((alignment) => {
      const coordinate = alignment.axis === "vertical" ? "x" : "y";
      const crossCoordinate = alignment.axis === "vertical" ? "y" : "x";
      const positioned = alignment.nodes
        .map((node) => ({ node, position: positions[node] }))
        .filter((entry) => entry.position && Number.isFinite(entry.position[coordinate]));

      if (positioned.length < 2) {
        return;
      }

      const anchors = positioned.filter((entry) => manual.has(entry.node));
      const source = anchors.length ? anchors : positioned;
      const target = source.reduce((sum, entry) => sum + entry.position[coordinate], 0) / source.length;

      positioned.forEach(({ node, position }) => {
        if (!manual.has(node)) {
          position[coordinate] = target;
        }
      });

      orderAlignedNodesAlongCrossAxis(positioned, crossCoordinate, manual);
    });
  }

  function orderAlignedNodesAlongCrossAxis(positioned, crossCoordinate, manual) {
    if (
      positioned.length < 2
      || positioned.some((entry) => manual.has(entry.node))
    ) {
      return;
    }

    const slots = positioned
      .map((entry) => entry.position[crossCoordinate])
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);

    if (slots.length !== positioned.length) {
      return;
    }

    positioned.forEach((entry, index) => {
      entry.position[crossCoordinate] = slots[index];
    });
  }

  function applyCrossLocks(positions, crossLocks, axes) {
    crossLocks.forEach((cross, node) => {
      if (positions[node]) {
        applyCrossLock(positions[node], cross, axes);
      }
    });
  }

  function applyCrossLock(position, cross, axes) {
    if (cross === undefined) {
      return;
    }

    axes.setCross(position, cross);
  }

  function diagramAxes({ width, height, marginX, marginY, orientation, tikzOrientation }) {
    const reverse = orientation.endsWith("reverse");

    return {
      orientation,
      clockwiseBoundaryOrder: !tikzOrientation,
      stackInternals: orientation.startsWith("vertical"),
      layerStart: reverse ? width - marginX : marginX,
      layerEnd: reverse ? marginX : width - marginX,
      crossStart: marginY,
      crossEnd: height - marginY,
      crossOf: (position) => position.y,
      setCross: (position, cross) => {
        position.y = cross;
      },
      point: (layer, cross, kind) => ({
        x: layer,
        y: cross,
        kind,
        labelSide: labelSideForKind(kind, orientation),
      }),
    };
  }

  function initialFixedPositions(diagram, axes) {
    const positions = {};

    Object.entries(diagram.manualPositions || {}).forEach(([node, position]) => {
      const kind = nodeKind(node, diagram);

      positions[node] = {
        x: position.x,
        y: position.y,
        kind,
        labelSide: labelSideForKind(kind, axes.orientation || "horizontal"),
      };
    });

    return positions;
  }

  function nodeKind(node, diagram) {
    if (diagram.incoming.includes(node)) {
      return "incoming";
    }

    if (diagram.outgoing.includes(node)) {
      return "outgoing";
    }

    if ((diagram.unclassified || []).includes(node)) {
      return "unclassified";
    }

    return "internal";
  }

  function labelSideForKind(kind, orientation) {
    const reverse = orientation.endsWith("reverse");

    if (kind === "incoming") {
      return reverse ? "right" : "left";
    }

    if (kind === "outgoing") {
      return reverse ? "left" : "right";
    }

    return "top";
  }

  function nodesWithoutIncomingEdges(diagram, nodes) {
    const targets = new Set(diagram.edges.map((edge) => edge.to));
    const roots = nodes.filter((node) => !targets.has(node));

    return roots.length ? roots : nodes.slice(0, 1);
  }

  function computeTreeDepths(diagram, nodes, roots) {
    const nodeSet = new Set(nodes);
    const depthByNode = new Map();

    roots.forEach((root) => {
      depthByNode.set(root, 0);
    });

    for (let pass = 0; pass < nodes.length + diagram.edges.length + 1; pass += 1) {
      let changed = false;

      diagram.edges.forEach((edge) => {
        if (!depthByNode.has(edge.from) || !nodeSet.has(edge.to)) {
          return;
        }

        const depth = depthByNode.get(edge.from) + 1;

        if (!depthByNode.has(edge.to) || depth < depthByNode.get(edge.to)) {
          depthByNode.set(edge.to, depth);
          changed = true;
        }
      });

      if (!changed) {
        break;
      }
    }

    nodes.forEach((node) => {
      if (!depthByNode.has(node)) {
        depthByNode.set(node, 0);
      }
    });

    return depthByNode;
  }

  function safeDelta(from, to) {
    const dx = to.x - from.x || 0.01;
    const dy = to.y - from.y || 0.01;
    const distance = Math.hypot(dx, dy) || 1;

    return {
      dx,
      dy,
      distance,
      ux: dx / distance,
      uy: dy / distance,
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function collectNodes(diagram) {
    const nodes = new Set([...diagram.incoming, ...diagram.outgoing, ...(diagram.unclassified || [])]);

    diagram.edges.forEach((edge) => {
      nodes.add(edge.from);
      nodes.add(edge.to);
    });

    Object.keys(diagram.labels).forEach((labelTarget) => {
      if (!labelTarget.includes("->")) {
        nodes.add(labelTarget);
      }
    });

    (diagram.braces || []).forEach((brace) => {
      nodes.add(brace.from);
      nodes.add(brace.to);
    });

    Object.keys(diagram.manualPositions || {}).forEach((node) => {
      nodes.add(node);
    });

    Object.keys(diagram.vertices || {}).forEach((node) => {
      nodes.add(node);
    });

    return nodes;
  }

  function placeExternalNodes(nodes, layer, crossStart, crossEnd, kind, axes, positions) {
    const count = Math.max(nodes.length, 1);

    nodes.forEach((node, index) => {
      if (!positions[node]) {
        positions[node] = axes.point(
          layer,
          externalCrossCoordinateAt(index, count, crossStart, crossEnd, layer, axes, kind),
          kind
        );
      }
    });
  }

  function enforceDeclaredExternalOrder(diagram, positions, axes) {
    const manual = new Set(Object.keys(diagram.manualPositions || {}));

    [
      { nodes: diagram.incoming, kind: "incoming" },
      { nodes: diagram.outgoing, kind: "outgoing" },
    ].forEach(({ nodes, kind }) => {
      if (nodes.length <= 1) {
        return;
      }

      const count = Math.max(nodes.length, 1);

      nodes.forEach((node, index) => {
        if (!positions[node] || manual.has(node)) {
          return;
        }

        axes.setCross(
          positions[node],
          externalCrossCoordinateAt(
            index,
            count,
            axes.crossStart,
            axes.crossEnd,
            kind === "incoming" ? axes.layerStart : axes.layerEnd,
            axes,
            kind
          )
        );
        positions[node].kind = kind;
      });
    });
  }

  function externalCrossCoordinateAt(index, count, crossStart, crossEnd, layer, axes, kind) {
    if (!axes.clockwiseBoundaryOrder || (kind !== "incoming" && kind !== "outgoing")) {
      return crossCoordinateAt(index, count, crossStart, crossEnd);
    }

    const midpoint = (axes.layerStart + axes.layerEnd) / 2;
    const isLeftBoundary = layer <= midpoint;

    return isLeftBoundary
      ? crossCoordinateAt(index, count, crossEnd, crossStart)
      : crossCoordinateAt(index, count, crossStart, crossEnd);
  }

  function crossCoordinateAt(index, count, crossStart, crossEnd) {
    if (count <= 1) {
      return (crossStart + crossEnd) / 2;
    }

    return crossStart + ((crossEnd - crossStart) * index) / (count - 1);
  }

  function computeInternalLayers(diagram, internalNodes, incoming) {
    const layers = new Map(internalNodes.map((node) => [node, 1]));
    const knownSources = new Set(incoming);

    const maxUsefulLayer = Math.max(1, internalNodes.length);

    for (let pass = 0; pass < internalNodes.length + diagram.edges.length + 1; pass += 1) {
      let changed = false;

      diagram.edges.forEach((edge) => {
        if (!layers.has(edge.to)) {
          return;
        }

        const sourceLayer = layers.get(edge.from) ?? (knownSources.has(edge.from) ? 0 : 1);
        const nextLayer = Math.max(layers.get(edge.to), Math.min(sourceLayer + 1, maxUsefulLayer));

        if (nextLayer !== layers.get(edge.to)) {
          layers.set(edge.to, nextLayer);
          changed = true;
        }
      });

      if (!changed) {
        break;
      }
    }

    return layers;
  }

  function estimateInternalCross(node, diagram, fixedPositions, axes) {
    const singleIncomingCross = axes.stackInternals
      ? null
      : directSingleIncomingCross(node, diagram, fixedPositions, axes);

    if (singleIncomingCross !== null) {
      return singleIncomingCross;
    }

    const neighborCrosses = [];

    diagram.edges.forEach((edge) => {
      if (edge.from === node && fixedPositions[edge.to]) {
        neighborCrosses.push(axes.crossOf(fixedPositions[edge.to]));
      }

      if (edge.to === node && fixedPositions[edge.from]) {
        neighborCrosses.push(axes.crossOf(fixedPositions[edge.from]));
      }
    });

    if (!neighborCrosses.length) {
      return (axes.crossStart + axes.crossEnd) / 2;
    }

    const average = neighborCrosses.reduce((sum, cross) => sum + cross, 0) / neighborCrosses.length;

    if (axes.stackInternals) {
      return pullCrossTowardCenter(average, axes);
    }

    return average;
  }

  function pullCrossTowardCenter(cross, axes) {
    const center = (axes.crossStart + axes.crossEnd) / 2;

    return center + (cross - center) * 0.5;
  }

  function directSingleIncomingCross(node, diagram, fixedPositions, axes) {
    if (diagram.incoming.length !== 1) {
      return null;
    }

    const incoming = diagram.incoming[0];

    if (!fixedPositions[incoming]) {
      return null;
    }

    const connected = diagram.edges.some((edge) => (
      !edge.hidden
      && (
        (edge.from === incoming && edge.to === node)
        || (edge.to === incoming && edge.from === node)
      )
    ));

    return connected ? axes.crossOf(fixedPositions[incoming]) : null;
  }

  function distributeLayer(nodes, minCross, maxCross) {
    const minGap = 42;
    const sorted = [...nodes].sort((a, b) => a.cross - b.cross || a.node.localeCompare(b.node));

    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].cross - sorted[index - 1].cross < minGap) {
        sorted[index].cross = sorted[index - 1].cross + minGap;
      }
    }

    const overflow = sorted.length ? sorted[sorted.length - 1].cross - maxCross : 0;
    if (overflow > 0) {
      sorted.forEach((item) => {
        item.cross -= overflow;
      });
    }

    for (let index = sorted.length - 2; index >= 0; index -= 1) {
      if (sorted[index + 1].cross - sorted[index].cross < minGap) {
        sorted[index].cross = sorted[index + 1].cross - minGap;
      }
    }

    const underflow = sorted.length ? minCross - sorted[0].cross : 0;
    if (underflow > 0) {
      sorted.forEach((item) => {
        item.cross += underflow;
      });
    }

    return sorted.map((item) => ({
      ...item,
      cross: Math.max(minCross, Math.min(maxCross, item.cross)),
    }));
  }

  async function renderFeynmanElement(source, index) {
    const diagram = parseFeynman(source);
    const layout = await layoutFeynman(diagram);
    const figure = document.createElement("figure");
    const svg = createSvg("svg", {
      class: "feynman-diagram__svg",
      role: "img",
      width: layout.width,
      height: layout.height,
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      "aria-labelledby": `feynman-title-${index}`,
      style: `--feynman-diagram-width: ${layout.width}px;`,
    });
    const title = createSvg("title", { id: `feynman-title-${index}` });

    title.textContent = "Feynman diagram";
    figure.className = "feynman-diagram";
    figure.dataset.feynmanDiagram = "true";
    svg.appendChild(title);
    svg.appendChild(createDefinitions(index));

    renderEdges(diagram, layout, index, (edge) => !isOverlayEdge(edge)).forEach((edge) => {
      svg.appendChild(edge);
    });

    renderJunctionCaps(diagram, layout).forEach((cap) => {
      svg.appendChild(cap);
    });

    Object.entries(layout.positions).forEach(([node, position]) => {
      const vertex = renderVertex(node, position, diagram, index);

      if (vertex) {
        svg.appendChild(vertex);
      }
    });

    renderEdges(diagram, layout, index, isOverlayEdge).forEach((edge) => {
      svg.appendChild(edge);
    });

    renderBraces(diagram, layout).forEach((brace) => {
      svg.appendChild(brace);
    });

    renderLabels(diagram, layout).forEach((label) => {
      svg.appendChild(label);
    });

    await materializePendingMathLabels(svg);

    figure.appendChild(svg);

    if (diagram.errors.length) {
      const errors = document.createElement("figcaption");
      errors.className = "feynman-diagram__errors";
      errors.textContent = diagram.errors.join("; ");
      figure.appendChild(errors);
    }

    return figure;
  }

  function renderLoadingFigure(index) {
    const figure = document.createElement("figure");

    figure.className = "feynman-diagram feynman-diagram--loading";
    figure.dataset.feynmanDiagram = "true";
    figure.setAttribute("aria-busy", "true");
    figure.setAttribute("aria-label", `Rendering Feynman diagram ${index + 1}`);

    return figure;
  }

  function renderErrorFigure(error, index) {
    const figure = document.createElement("figure");
    const errors = document.createElement("figcaption");

    figure.className = "feynman-diagram";
    figure.dataset.feynmanDiagram = "true";
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-labelledby", `feynman-error-${index}`);
    errors.id = `feynman-error-${index}`;
    errors.className = "feynman-diagram__errors";
    errors.textContent = error?.message || String(error || "Unable to render Feynman diagram");
    figure.appendChild(errors);

    return figure;
  }

  function renderEdges(diagram, layout, index, includeEdge) {
    return diagram.edges
      .filter(includeEdge)
      .map((edge) => {
        const from = layout.positions[edge.from];
        const to = layout.positions[edge.to];

        if (!from || !to) {
          return null;
        }

        return renderEdge(edge, from, to, index);
      })
      .filter(Boolean);
  }

  function isOverlayEdge(edge) {
    return edge.type === "ghost" || edge.overlay;
  }

  function renderJunctionCaps(diagram, layout) {
    return junctionCapNodes(diagram, layout).map((cap) => createSvg("circle", {
      class: "feynman-diagram__junction-cap",
      cx: cap.position.x,
      cy: cap.position.y,
      r: GLUON_JUNCTION_CAP_RADIUS,
      "aria-hidden": "true",
    }));
  }

  function junctionCapNodes(diagram, layout) {
    const incident = new Map();

    diagram.edges
      .filter(isVisibleJunctionEdge)
      .forEach((edge) => {
        markIncidentEdge(incident, edge.from, edge);
        markIncidentEdge(incident, edge.to, edge);
      });

    return Object.entries(layout.positions)
      .filter(([node, position]) => (
        position.kind === "internal"
        && !diagram.vertices?.[node]
        && (incident.get(node)?.count ?? 0) > 1
        && incident.get(node)?.hasGluon
      ))
      .map(([node, position]) => ({ node, position }));
  }

  function isVisibleJunctionEdge(edge) {
    return !edge.hidden;
  }

  function markIncidentEdge(incident, node, edge) {
    const current = incident.get(node) || { count: 0, hasGluon: false };

    current.count += 1;
    current.hasGluon = current.hasGluon || edge.type === "gluon";
    incident.set(node, current);
  }

  function createDefinitions(index) {
    const defs = createSvg("defs");
    const marker = createSvg("marker", {
      id: `feynman-arrow-${index}`,
      markerWidth: VISUAL_DEFAULTS.arrowMarkerWidth,
      markerHeight: VISUAL_DEFAULTS.arrowMarkerHeight,
      refX: VISUAL_DEFAULTS.arrowMarkerRefX,
      refY: VISUAL_DEFAULTS.arrowMarkerRefY,
      orient: "auto",
      markerUnits: "strokeWidth",
    });

    marker.appendChild(createSvg("path", {
      d: VISUAL_DEFAULTS.arrowPath,
      class: "feynman-diagram__arrow",
    }));
    defs.appendChild(marker);

    Object.entries(BLOB_HATCH_PATTERNS).forEach(([hatch, pattern]) => {
      defs.appendChild(createBlobHatchPattern(index, hatch, pattern));
    });

    return defs;
  }

  function createBlobHatchPattern(index, hatch, pattern) {
    const patternElement = createSvg("pattern", {
      id: blobHatchPatternId(index, hatch),
      patternUnits: "userSpaceOnUse",
      width: pattern.size,
      height: pattern.size,
    });

    patternElement.appendChild(createSvg("rect", {
      class: "feynman-diagram__hatch-fill",
      x: 0,
      y: 0,
      width: pattern.size,
      height: pattern.size,
    }));

    pattern.paths.forEach((path) => {
      patternElement.appendChild(createSvg("path", {
        class: "feynman-diagram__hatch-line",
        d: path,
      }));
    });

    return patternElement;
  }

  function renderEdge(edge, from, to, index) {
    if (edge.hidden) {
      return null;
    }

    if (edge.type === "fermion") {
      return renderDirectedEdge(edge, from, to, "feynman-diagram__edge feynman-diagram__edge--fermion");
    }

    if (edge.type === "plain") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--plain",
        d: edgePath(edge, from, to),
      });
    }

    if (edge.type === "photon") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--photon",
        d: wavePathForEdge(edge, from, to, 7, 18),
      });
    }

    if (edge.type === "gluon") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--gluon",
        d: gluonPathForEdge(edge, from, to, 5.5, 13),
      });
    }

    if (edge.type === "ghost") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--ghost",
        d: edgePath(edge, from, to),
      });
    }

    if (edge.type === "dashed") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--dashed",
        d: edgePath(edge, from, to),
      });
    }

    if (edge.type === "dashdot") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--dashdot",
        d: edgePath(edge, from, to),
      });
    }

    if (edge.type === "triangle") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--triangle",
        d: trianglePathForEdge(edge, from, to, 7, 16),
      });
    }

    if (edge.type === "square") {
      return createSvg("path", {
        class: "feynman-diagram__edge feynman-diagram__edge--square",
        d: squarePathForEdge(edge, from, to, 6, 18),
      });
    }

    if (edge.type === "double") {
      return renderDoubleEdge(edge, from, to);
    }

    if (edge.arrow) {
      return renderDirectedEdge(edge, from, to, "feynman-diagram__edge feynman-diagram__edge--scalar");
    }

    return createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--scalar",
      d: edgePath(edge, from, to),
    });
  }

  function renderDirectedEdge(edge, from, to, className) {
    const group = createSvg("g", {
      class: "feynman-diagram__edge-group",
    });
    const geometry = edgeGeometry(edge, from, to);

    group.appendChild(createSvg("path", {
      class: className,
      d: geometryToPath(geometry),
    }));

    group.appendChild(renderArrowGlyphOnGeometry(geometry, edge.arrow === "reverse"));

    return group;
  }

  function renderArrowGlyphOnGeometry(geometry, reverse) {
    const sample = geometrySample(geometry, 0.5);
    const vector = normalizeVector(sample.tangent.x, sample.tangent.y);

    if (reverse) {
      vector.ux *= -1;
      vector.uy *= -1;
    }

    return renderArrowGlyphAt(sample.point, vector);
  }

  function renderArrowGlyph(from, to) {
    const vector = lineVector(from, to);
    const center = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
    };

    return renderArrowGlyphAt(center, vector);
  }

  function renderArrowGlyphAt(center, vector, options = {}) {
    const length = options.length ?? VISUAL_DEFAULTS.arrowMarkerWidth + 3;
    const width = options.width ?? VISUAL_DEFAULTS.arrowMarkerHeight;
    const tip = {
      x: center.x + vector.ux * ((2 * length) / 3),
      y: center.y + vector.uy * ((2 * length) / 3),
    };
    const tail = {
      x: center.x - vector.ux * (length / 3),
      y: center.y - vector.uy * (length / 3),
    };
    const left = {
      x: tail.x + vector.px * (width / 2),
      y: tail.y + vector.py * (width / 2),
    };
    const right = {
      x: tail.x - vector.px * (width / 2),
      y: tail.y - vector.py * (width / 2),
    };

    return createSvg("path", {
      class: options.className || "feynman-diagram__arrow",
      d: `M ${round(tip.x)} ${round(tip.y)} L ${round(left.x)} ${round(left.y)} L ${round(right.x)} ${round(right.y)} Z`,
    });
  }

  function renderVertex(node, position, diagram, index = 0) {
    const definition = diagram.vertices?.[node] ?? null;
    const shape = vertexDefinitionShape(definition);

    if (!shape) {
      return null;
    }

    if (shape === "dot") {
      return createSvg("circle", {
        class: "feynman-diagram__vertex feynman-diagram__vertex--dot",
        cx: position.x,
        cy: position.y,
        r: 3.5,
      });
    }

    if (shape === "square-dot") {
      return createSvg("rect", {
        class: "feynman-diagram__vertex feynman-diagram__vertex--square-dot",
        x: position.x - 4,
        y: position.y - 4,
        width: 8,
        height: 8,
      });
    }

    if (shape === "empty-dot") {
      return createSvg("circle", {
        class: "feynman-diagram__vertex feynman-diagram__vertex--empty-dot",
        cx: position.x,
        cy: position.y,
        r: 5,
      });
    }

    if (shape === "cross" || shape === "crossed-dot") {
      const group = createSvg("g", {
        class: `feynman-diagram__vertex-group feynman-diagram__vertex-group--${shape}`,
      });
      const radius = shape === "crossed-dot" ? 6 : 7;

      if (shape === "crossed-dot") {
        group.appendChild(createSvg("circle", {
          class: "feynman-diagram__vertex feynman-diagram__vertex--empty-dot",
          cx: position.x,
          cy: position.y,
          r: radius,
        }));
      }

      group.appendChild(createSvg("line", {
        class: "feynman-diagram__vertex-mark",
        x1: position.x - radius,
        y1: position.y - radius,
        x2: position.x + radius,
        y2: position.y + radius,
      }));
      group.appendChild(createSvg("line", {
        class: "feynman-diagram__vertex-mark",
        x1: position.x - radius,
        y1: position.y + radius,
        x2: position.x + radius,
        y2: position.y - radius,
      }));

      return group;
    }

    if (shape === "blob" || shape === "disk") {
      const options = vertexDefinitionOptions(definition);
      const group = createSvg("g", {
        class: `feynman-diagram__vertex-group feynman-diagram__vertex-group--${shape}`,
      });
      const radii = blobVertexRadii(shape, definition);
      const circular = Math.abs(radii.rx - radii.ry) < 0.001;
      const hatch = options.hatch;
      const shapeAttributes = {
        class: [
          "feynman-diagram__vertex",
          "feynman-diagram__vertex--blob",
          `feynman-diagram__vertex--${shape}`,
          hatch ? "feynman-diagram__vertex--blob-hatched" : "feynman-diagram__vertex--blob-shaded",
        ].join(" "),
        cx: position.x,
        cy: position.y,
      };
      const backdropAttributes = {
        class: "feynman-diagram__vertex-backdrop",
        cx: position.x,
        cy: position.y,
      };

      if (circular) {
        shapeAttributes.r = radii.rx;
        backdropAttributes.r = radii.rx + 1;
      } else {
        shapeAttributes.rx = radii.rx;
        shapeAttributes.ry = radii.ry;
        backdropAttributes.rx = radii.rx + 1;
        backdropAttributes.ry = radii.ry + 1;
      }

      if (hatch) {
        shapeAttributes.fill = `url(#${blobHatchPatternId(index, hatch)})`;
      }

      group.appendChild(createSvg(circular ? "circle" : "ellipse", backdropAttributes));
      group.appendChild(createSvg(circular ? "circle" : "ellipse", shapeAttributes));

      return group;
    }

    return null;
  }

  function vertexDefinitionShape(definition) {
    if (!definition) {
      return null;
    }

    if (typeof definition === "string") {
      return definition;
    }

    return definition.shape ?? null;
  }

  function vertexDefinitionOptions(definition) {
    if (!definition || typeof definition === "string") {
      return {};
    }

    return definition;
  }

  function blobVertexRadii(shape, definition) {
    const options = vertexDefinitionOptions(definition);
    const radius = options.size ?? BLOB_VERTEX_DEFAULT_RADII[shape];

    return {
      rx: options.rx ?? radius,
      ry: options.ry ?? radius,
    };
  }

  function blobHatchPatternId(index, hatch) {
    return `feynman-hatch-${hatch}-${index}`;
  }
  function renderDoubleEdge(edge, from, to) {
    const path = createSvg("path", {
      class: "feynman-diagram__edge feynman-diagram__edge--double",
      d: doubleLinePathForEdge(edge, from, to, 4.6),
    });

    if (!edge.arrow) {
      return path;
    }

    const group = createSvg("g", {
      class: "feynman-diagram__edge-group",
    });
    const geometry = edgeGeometry(edge, from, to);

    group.appendChild(path);
    group.appendChild(renderArrowGlyphOnGeometry(geometry, edge.arrow === "reverse"));

    return group;
  }
  function renderLabels(diagram, layout) {
    const declaredLabels = Object.entries(diagram.labels)
      .map(([target, text]) => {
        if (target.includes("->")) {
          return renderEdgeLabel(target, text, diagram, layout);
        }

        return renderNodeLabel(target, text, layout.positions[target], layout);
      })
      .filter(Boolean);

    const inlineEdgeLabels = diagram.edges
      .map((edge, index) => (
        edge.label
          ? renderEdgeLabelForEdge(edge, edge.label, layout, {
            placementId: edgePlacementId(edge, index),
          })
          : null
      ))
      .filter(Boolean);

    return [...declaredLabels, ...inlineEdgeLabels];
  }

  function renderNodeLabel(target, text, position, layout) {
    if (!position) {
      return null;
    }

    const placement = labelPlacementEntry(layout, `node:${target}`);
    const offset = labelOffset(position.labelSide || position.kind);
    const x = placement?.x ?? position.x + offset.x;
    const y = placement?.y ?? position.y + offset.y;
    const anchor = placement?.anchor || offset.anchor;

    return createDiagramLabel({
      text: text || target,
      x,
      y,
      anchor,
      className: `feynman-diagram__label feynman-diagram__label--${position.kind}`,
    });
  }

  function renderEdgeLabel(target, text, diagram, layout) {
    const edge = findEdgeByLabelTarget(target, diagram.edges);

    if (!edge) {
      return null;
    }

    return renderEdgeLabelForEdge(edge, text, layout, {
      forceNormal: true,
      placementId: `declared-edge:${target}`,
    });
  }

  function renderEdgeLabelForEdge(edge, text, layout, options = {}) {
    const from = layout.positions[edge.from];
    const to = layout.positions[edge.to];

    if (!from || !to) {
      return null;
    }

    const placement = labelPlacementEntry(layout, options.placementId);
    const side = placement?.side || edge.labelSide || "left";
    const position = placement || edgeLabelPosition(edge, from, to, side, {
      ...options,
      sideOverride: side,
    });

    if (isMomentumEdge(edge) && !options.forceNormal) {
      return renderMomentumLabelForEdge(edge, text, from, to, position, { sideOverride: side });
    }

    return createDiagramLabel({
      text,
      x: position.x,
      y: position.y,
      anchor: position.anchor,
      className: "feynman-diagram__label feynman-diagram__label--edge",
    });
  }

  function renderMomentumLabelForEdge(edge, text, from, to, position, options = {}) {
    const group = createSvg("g", {
      class: "feynman-diagram__momentum-label",
    });
    const arrow = momentumArrowGeometry(edge, from, to, options);

    group.appendChild(createSvg("path", {
      class: "feynman-diagram__momentum-arrow",
      d: arrow.path,
    }));
    group.appendChild(renderArrowGlyphAt(arrow.end, arrow.tangent, {
      className: "feynman-diagram__arrow feynman-diagram__momentum-arrowhead",
      length: VISUAL_DEFAULTS.momentumArrowHeadLength,
      width: VISUAL_DEFAULTS.momentumArrowHeadWidth,
    }));

    group.appendChild(createDiagramLabel({
      text,
      x: position.x,
      y: position.y,
      anchor: position.anchor,
      className: "feynman-diagram__label feynman-diagram__label--edge feynman-diagram__label--momentum",
    }));

    return group;
  }

  function labelPlacementEntry(layout, id) {
    return layout?.labelPlacement?.byId?.[id] || null;
  }

  function edgePlacementId(edge, index) {
    return `edge:${edge.id || `${edge.from}->${edge.to}#${index + 1}`}`;
  }

  function findEdgeByLabelTarget(target, edges) {
    const match = String(target || "").match(/^([A-Za-z0-9_.-]+)->([A-Za-z0-9_.-]+)(?:#([0-9]+))?$/);

    if (!match) {
      return null;
    }

    const [, from, to, rawIndex] = match;
    const matches = edges.filter((edge) => edge.from === from && edge.to === to);
    const index = rawIndex ? Number(rawIndex) - 1 : 0;

    return matches[index] || null;
  }

  function edgeLabelPosition(edge, from, to, side, options = {}) {
    const sample = geometrySample(edgeGeometry(edge, from, to), 0.5);
    const tangent = normalizeVector(sample.tangent.x, sample.tangent.y);
    const resolvedSide = options.sideOverride || side;

    if (isMomentumEdge(edge)) {
      if (!options.forceNormal) {
        return momentumLabelPosition(edge, sample.point, tangent, resolvedSide);
      }

      const momentumNormal = momentumNormalForTangent(edge, tangent, resolvedSide);

      return {
        x: sample.point.x - momentumNormal.x * VISUAL_DEFAULTS.edgeLabelOffset,
        y: sample.point.y - momentumNormal.y * VISUAL_DEFAULTS.edgeLabelOffset,
        anchor: "middle",
      };
    }

    const normalSign = resolvedSide === "right" ? 1 : -1;

    return {
      x: sample.point.x + tangent.px * VISUAL_DEFAULTS.edgeLabelOffset * normalSign,
      y: sample.point.y + tangent.py * VISUAL_DEFAULTS.edgeLabelOffset * normalSign,
      anchor: "middle",
    };
  }

  function momentumLabelPosition(edge, point, tangent, sideOverride) {
    const normal = momentumNormalForTangent(edge, tangent, sideOverride);
    const offset = momentumArrowDistance(edge)
      + VISUAL_DEFAULTS.momentumLabelGap
      + momentumLabelDistance(edge);

    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
      anchor: "middle",
    };
  }

  function momentumArrowGeometry(edge, from, to, options = {}) {
    const geometry = edgeGeometry(edge, from, to);
    const shorten = momentumArrowShorten(edge);
    const reverse = edge.momentumDirection === "reverse";
    const start = reverse ? 1 - shorten : shorten;
    const end = reverse ? shorten : 1 - shorten;
    const steps = geometry.kind === "cubic" ? 8 : 1;
    const midpoint = geometrySample(geometry, 0.5);
    const normal = momentumNormalForTangent(
      edge,
      normalizeVector(midpoint.tangent.x, midpoint.tangent.y),
      options.sideOverride
    );
    const offset = momentumArrowDistance(edge);
    const points = [];

    for (let step = 0; step <= steps; step += 1) {
      const t = start + ((end - start) * step) / steps;
      const point = geometryPoint(geometry, t);

      points.push({
        x: point.x + normal.x * offset,
        y: point.y + normal.y * offset,
      });
    }

    const endPoint = points[points.length - 1];
    const beforeEnd = points[points.length - 2] || points[0];

    return {
      path: pointsToPath(points),
      start: points[0],
      end: endPoint,
      tangent: normalizeVector(endPoint.x - beforeEnd.x, endPoint.y - beforeEnd.y),
      points,
    };
  }

  function isMomentumEdge(edge) {
    return edge.labelPlacement === "momentum" || edge.labelPlacement === "momentum-prime";
  }

  function momentumNormalForTangent(edge, tangent, sideOverride) {
    const normal = canonicalMomentumNormal(tangent);
    const normalSign = (sideOverride || (edge.labelPlacement === "momentum-prime" ? "right" : "left")) === "right" ? 1 : -1;

    return {
      x: normal.x * normalSign,
      y: normal.y * normalSign,
    };
  }

  function momentumArrowDistance(edge) {
    return edge.momentum?.arrowDistance ?? VISUAL_DEFAULTS.momentumArrowOffset;
  }

  function momentumLabelDistance(edge) {
    return edge.momentum?.labelDistance ?? 0;
  }

  function momentumArrowShorten(edge) {
    return edge.momentum?.arrowShorten ?? VISUAL_DEFAULTS.momentumArrowShorten;
  }

  function canonicalMomentumNormal(tangent) {
    let ux = tangent.ux;
    let uy = tangent.uy;

    if (Math.abs(ux) >= Math.abs(uy)) {
      if (ux < 0) {
        ux *= -1;
        uy *= -1;
      }
    } else if (uy < 0) {
      ux *= -1;
      uy *= -1;
    }

    return {
      x: -uy,
      y: ux,
    };
  }

  function renderBraces(diagram, layout) {
    return (diagram.braces || [])
      .map((brace) => renderBrace(brace, layout))
      .filter(Boolean);
  }

  function renderBrace(brace, layout) {
    const from = layout.positions[brace.from];
    const to = layout.positions[brace.to];

    if (!from || !to) {
      return null;
    }

    const group = createSvg("g", {
      class: "feynman-diagram__brace-group",
    });
    const geometry = braceGeometry(from, to, brace.side);

    if (geometry.kind === "tex-brace") {
      geometry.pieces.forEach((piece) => {
        group.appendChild(createSvg("path", {
          class: "feynman-diagram__brace feynman-diagram__brace--tex",
          d: piece.path,
          transform: piece.transform,
        }));
      });
    } else {
      group.appendChild(createSvg("path", {
        class: "feynman-diagram__brace",
        d: geometry.path,
      }));
    }

    group.appendChild(createDiagramLabel({
      text: brace.label,
      x: geometry.label.x,
      y: geometry.label.y,
      anchor: geometry.label.anchor,
      className: "feynman-diagram__label feynman-diagram__label--brace",
    }));

    return group;
  }

  function braceGeometry(from, to, side) {
    const gap = 42;
    const curl = 14;
    const labelGap = 22;

    if (side === "left" || side === "right") {
      const sign = side === "right" ? 1 : -1;
      const x = (
        side === "right" ? Math.max(from.x, to.x) : Math.min(from.x, to.x)
      ) + sign * BRACE_SIDE_GAP;
      const y1 = Math.min(from.y, to.y);
      const y2 = Math.max(from.y, to.y);
      const mid = (y1 + y2) / 2;
      const braceY1 = y1 - BRACE_LABEL_PADDING;
      const braceY2 = y2 + BRACE_LABEL_PADDING;
      const geometry = texBraceGeometry(x, braceY1, braceY2, side);

      return {
        kind: "tex-brace",
        x: round(x),
        pieces: geometry.pieces,
        scale: geometry.scale,
        extenderRepeats: geometry.extenderRepeats,
        bounds: {
          y1: round(braceY1),
          y2: round(braceY2),
        },
        label: {
          x: round(x + sign * labelGap),
          y: mid,
          anchor: side === "right" ? "start" : "end",
        },
      };
    }

    const sign = side === "bottom" ? 1 : -1;
    const x1 = Math.min(from.x, to.x);
    const x2 = Math.max(from.x, to.x);
    const mid = (x1 + x2) / 2;
    const y = (side === "bottom" ? Math.max(from.y, to.y) : Math.min(from.y, to.y)) + sign * gap;
    const notch = Math.min(10, Math.max(5, (x2 - x1) / 8));
    const path = [
      `M ${round(x1)} ${round(y)}`,
      `C ${round(x1)} ${round(y + sign * curl)} ${round(mid - notch * 2)} ${round(y + sign * curl)} ${round(mid - notch)} ${round(y)}`,
      `C ${round(mid - notch * 0.4)} ${round(y + sign * curl * 0.45)} ${round(mid + notch * 0.4)} ${round(y + sign * curl * 0.45)} ${round(mid + notch)} ${round(y)}`,
      `C ${round(mid + notch * 2)} ${round(y + sign * curl)} ${round(x2)} ${round(y + sign * curl)} ${round(x2)} ${round(y)}`,
    ].join(" ");

    return {
      kind: "path",
      path,
      label: {
        x: mid,
        y: y + sign * labelGap,
        anchor: "middle",
      },
    };
  }

  function texBraceGeometry(x, y1, y2, side) {
    const span = Math.max(1, y2 - y1);
    const rawRepeats = (
      span / TEX_BRACE_METRICS.targetScale - TEX_BRACE_METRICS.baseHeight
    ) / (2 * TEX_BRACE_METRICS.extenderAdvance);
    const extenderRepeats = Math.max(0, Math.round(rawRepeats));
    const designHeight = TEX_BRACE_METRICS.baseHeight
      + 2 * extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
    const scale = span / designHeight;
    const topY = y1 - TEX_BRACE_METRICS.topMinY * scale;
    const sidePaths = TEX_BRACE_PATHS[side];
    const middleY = TEX_BRACE_METRICS.topAdvance
      + extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
    const bottomExtensionY = middleY + TEX_BRACE_METRICS.middleAdvance;
    const bottomY = bottomExtensionY
      + extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
    const pieces = [
      texBracePiece(sidePaths.top, x, topY, scale, 0),
    ];

    for (let index = 0; index < extenderRepeats; index += 1) {
      pieces.push(texBracePiece(
        TEX_BRACE_PATHS.extender,
        x,
        topY,
        scale,
        TEX_BRACE_METRICS.topAdvance + index * TEX_BRACE_METRICS.extenderAdvance
      ));
    }

    pieces.push(texBracePiece(sidePaths.middle, x, topY, scale, middleY));

    for (let index = 0; index < extenderRepeats; index += 1) {
      pieces.push(texBracePiece(
        TEX_BRACE_PATHS.extender,
        x,
        topY,
        scale,
        bottomExtensionY + index * TEX_BRACE_METRICS.extenderAdvance
      ));
    }

    pieces.push(texBracePiece(sidePaths.bottom, x, topY, scale, bottomY));

    return {
      pieces,
      scale: round(scale),
      extenderRepeats,
    };
  }

  function texBracePiece(path, x, y, scale, yOffset) {
    return {
      path,
      transform: [
        `matrix(${round(scale)} 0 0 ${round(scale)}`,
        `${round(x - TEX_BRACE_METRICS.centerX * scale)}`,
        `${round(y + yOffset * scale)})`,
      ].join(" "),
    };
  }

  function mathJaxTexToSvgAvailable() {
    return typeof window !== "undefined"
      && window.MathJax
      && typeof window.MathJax.tex2svgPromise === "function";
  }

  function whenMathJaxReady() {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }

    if (window.MathJax?.startup?.promise) {
      return window.MathJax.startup.promise;
    }

    if (mathJaxTexToSvgAvailable()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        if (mathJaxTexToSvgAvailable() || attempts++ > 200) {
          window.clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }
  function createDiagramLabel({ text, x, y, anchor, className }) {
    const source = String(text ?? "");

    if (labelNeedsMathJax(source)) {
      const group = createSvg("g", {
        class: `${className} feynman-diagram__label--math-pending`.trim(),
        "data-math-tex": source,
        "data-label-x": x,
        "data-label-y": y,
        "data-label-anchor": anchor,
      });
      const fallback = createSvg("text", {
        class: "feynman-diagram__label feynman-diagram__label--fallback",
        x,
        y,
        "text-anchor": anchor,
        "dominant-baseline": "middle",
      });

      appendLabelMarkup(fallback, source);
      group.appendChild(fallback);

      return group;
    }

    const label = createSvg("text", {
      class: className,
      x,
      y,
      "text-anchor": anchor,
      "dominant-baseline": "middle",
    });

    appendLabelMarkup(label, source);

    return label;
  }

  function mathJaxDisplayFontSize(className) {
    const base = String(className || "").includes("edge")
      ? VISUAL_DEFAULTS.edgeLabelFontSize
      : VISUAL_DEFAULTS.labelFontSize;

    return base * VISUAL_DEFAULTS.mathLabelFontScale;
  }

  function parseMathJaxSvgLength(value, emPixels) {
    if (value == null || value === "") {
      return 0;
    }

    const raw = String(value).trim();
    const match = raw.match(/^([+-]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(ex|em|px)?$/i);

    if (!match) {
      return Number.parseFloat(raw) || 0;
    }

    const amount = Number.parseFloat(match[1]);
    const unit = (match[2] || "px").toLowerCase();

    if (unit === "ex") {
      return amount * emPixels * 0.431;
    }

    if (unit === "em") {
      return amount * emPixels;
    }

    return amount;
  }

  function prefixSvgIds(root, prefix) {
    const idMap = new Map();

    root.querySelectorAll("[id]").forEach((element) => {
      const oldId = element.id;
      const newId = `${prefix}__${oldId}`;

      idMap.set(oldId, newId);
      element.id = newId;
    });

    root.querySelectorAll("[href]").forEach((element) => {
      const href = element.getAttribute("href");

      if (href?.startsWith("#")) {
        const mapped = idMap.get(href.slice(1));

        if (mapped) {
          element.setAttribute("href", `#${mapped}`);
        }
      }
    });

    root.querySelectorAll("*").forEach((element) => {
      const xlinkHref = element.getAttributeNS("http://www.w3.org/1999/xlink", "href");

      if (xlinkHref?.startsWith("#")) {
        const mapped = idMap.get(xlinkHref.slice(1));

        if (mapped) {
          element.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${mapped}`);
        }
      }
    });
  }

  function embedMathJaxSvgGroup(container, { x, y, anchor, className, idPrefix }) {
    const sourceSvg = container?.querySelector?.("svg");

    if (!sourceSvg) {
      return createSvg("g");
    }

    const emPixels = mathJaxDisplayFontSize(className);
    let width = parseMathJaxSvgLength(sourceSvg.getAttribute("width"), emPixels);
    let height = parseMathJaxSvgLength(sourceSvg.getAttribute("height"), emPixels);

    if (!(width > 0 && height > 0)) {
      width = emPixels * 2.4;
      height = emPixels * 1.05;
    }

    const group = createSvg("g", {
      class: `${className || ""} feynman-diagram__label--mathjax`.trim(),
      transform: `translate(${round(foreignObjectX(x, width, anchor))} ${round(y - height / 2)})`,
    });
    const nested = document.importNode(sourceSvg, true);

    nested.setAttribute("width", width);
    nested.setAttribute("height", height);
    nested.setAttribute("overflow", "visible");
    nested.setAttribute("class", "feynman-diagram__label-math-svg");
    prefixSvgIds(nested, idPrefix);
    group.appendChild(nested);

    return group;
  }

  async function materializePendingMathLabels(root) {
    if (!root?.querySelectorAll) {
      return;
    }

    const pending = [...root.querySelectorAll("[data-math-tex]")];

    if (!pending.length) {
      return;
    }

    await whenMathJaxReady();

    if (!mathJaxTexToSvgAvailable()) {
      return;
    }

    await Promise.all(pending.map(async (group) => {
      const tex = group.dataset.mathTex;

      if (!tex) {
        return;
      }

      try {
        const fontSize = mathJaxDisplayFontSize(
          group.getAttribute("class")?.replace("feynman-diagram__label--math-pending", "").trim(),
        );
        const mathNode = await window.MathJax.tex2svgPromise(tex, {
          display: false,
          em: fontSize,
          ex: fontSize * 0.431,
        });
        const replacement = embedMathJaxSvgGroup(mathNode, {
          x: Number(group.dataset.labelX),
          y: Number(group.dataset.labelY),
          anchor: group.dataset.labelAnchor || "middle",
          className: group.getAttribute("class")?.replace("feynman-diagram__label--math-pending", "").trim(),
          idPrefix: `feynman-math-${mathLabelSerial += 1}`,
        });

        group.replaceWith(replacement);
      } catch {
        group.removeAttribute("data-math-tex");
        group.classList.remove("feynman-diagram__label--math-pending");
      }
    }));
  }

  function foreignObjectX(x, width, anchor) {
    if (anchor === "start") {
      return x;
    }

    if (anchor === "end") {
      return x - width;
    }

    return x - width / 2;
  }

  function appendLabelMarkup(label, source) {
    const segments = parseLabelMarkup(source);

    label.setAttribute("aria-label", labelMarkupToText(source));
    segments.forEach((segment) => {
      if (!segment.text) {
        return;
      }

      const tspan = createSvg("tspan");
      tspan.textContent = labelSegmentText(segment);

      if (segment.kind !== "normal") {
        tspan.setAttribute("baseline-shift", segment.kind === "sup" ? "super" : "sub");
        tspan.setAttribute("font-size", `${VISUAL_DEFAULTS.scriptFontSizePercent}%`);
      }

      if (segment.overline) {
        tspan.setAttribute("text-decoration", "overline");
      }

      label.appendChild(tspan);
    });
  }

  function labelOffset(kind) {
    if (kind === "left" || kind === "incoming") {
      return { x: -VISUAL_DEFAULTS.labelHorizontalOffset, y: 0, anchor: "end" };
    }

    if (kind === "right" || kind === "outgoing") {
      return { x: VISUAL_DEFAULTS.labelHorizontalOffset, y: 0, anchor: "start" };
    }

    if (kind === "bottom") {
      return { x: 0, y: VISUAL_DEFAULTS.labelBottomOffset, anchor: "middle" };
    }

    return { x: 0, y: -VISUAL_DEFAULTS.labelTopOffset, anchor: "middle" };
  }

  function createSvg(tagName, attributes) {
    const element = document.createElementNS(SVG_NS, tagName);

    Object.entries(attributes || {}).forEach(([name, value]) => {
      element.setAttribute(name, String(value));
    });

    return element;
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function injectStyles() {
    if (document.getElementById("feynman-diagram-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "feynman-diagram-styles";
    style.textContent = `
      .feynman-diagram {
        margin: 1.25rem 0;
        overflow-x: auto;
      }

      .feynman-diagram__svg {
        display: block;
        width: min(100%, var(--feynman-diagram-width, 46rem));
        max-width: 46rem;
        height: auto;
        color: var(--md-typeset-color, #1f2933);
      }

      .feynman-diagram__edge {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: ${VISUAL_DEFAULTS.edgeStrokeWidth};
      }

      .feynman-diagram__edge--scalar {
        stroke-dasharray: 7 6;
      }

      .feynman-diagram__edge--gluon {
        stroke-width: ${VISUAL_DEFAULTS.gluonStrokeWidth};
      }

      .feynman-diagram__edge--ghost {
        stroke-dasharray: 1 7;
      }

      .feynman-diagram__edge--dashed {
        stroke-dasharray: 10 7;
      }

      .feynman-diagram__edge--dashdot {
        stroke-dasharray: 11 6 1 6;
      }

      .feynman-diagram__edge--double {
        stroke-width: ${VISUAL_DEFAULTS.gluonStrokeWidth};
      }

      .feynman-diagram__junction-cap {
        fill: currentColor;
        stroke: none;
      }

      .feynman-diagram__brace {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: ${VISUAL_DEFAULTS.edgeStrokeWidth};
      }

      .feynman-diagram__brace--tex {
        fill: currentColor;
        stroke: none;
      }

      .feynman-diagram__momentum-arrow {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: ${VISUAL_DEFAULTS.momentumArrowStrokeWidth};
      }

      .feynman-diagram__arrow,
      .feynman-diagram__vertex--dot,
      .feynman-diagram__vertex--square-dot {
        fill: currentColor;
      }

      .feynman-diagram__vertex {
        stroke: currentColor;
        stroke-width: ${VISUAL_DEFAULTS.vertexStrokeWidth};
      }

      .feynman-diagram__vertex--empty-dot {
        fill: var(--md-default-bg-color, #fff);
      }

      .feynman-diagram__vertex-backdrop {
        fill: var(--markfeyn-diagram-bg, var(--md-default-bg-color, #fff));
        stroke: none;
      }

      .feynman-diagram__vertex--blob {
        stroke-width: ${VISUAL_DEFAULTS.blobStrokeWidth};
      }

      .feynman-diagram__vertex--blob-shaded {
        fill: currentColor;
        fill-opacity: 0.14;
      }

      .feynman-diagram__vertex--blob-hatched {
        fill-opacity: 1;
      }

      .feynman-diagram__hatch-fill {
        fill: currentColor;
        fill-opacity: 0.08;
        stroke: none;
      }

      .feynman-diagram__hatch-line {
        fill: none;
        stroke: currentColor;
        stroke-linecap: square;
        stroke-opacity: 0.55;
        stroke-width: 1.35;
      }

      .feynman-diagram__vertex-mark {
        stroke: currentColor;
        stroke-linecap: round;
        stroke-width: ${VISUAL_DEFAULTS.vertexMarkStrokeWidth};
      }

      .feynman-diagram__label {
        fill: currentColor;
        font-family: ${VISUAL_DEFAULTS.labelFontFamily};
        font-size: ${VISUAL_DEFAULTS.labelFontSize}px;
        font-style: ${VISUAL_DEFAULTS.labelFontStyle};
      }

      .feynman-diagram__label--edge {
        font-size: ${VISUAL_DEFAULTS.edgeLabelFontSize}px;
      }

      .feynman-diagram__label--brace {
        font-size: ${VISUAL_DEFAULTS.edgeLabelFontSize}px;
      }

      .feynman-diagram__label--fallback {
        opacity: 0.92;
      }

      .feynman-diagram__label--mathjax {
        fill: currentColor;
      }

      .feynman-diagram__errors {
        color: var(--md-code-hl-special-color, #b00020);
        font-size: 0.75rem;
        margin-top: 0.25rem;
      }

      .feynman-diagram--loading {
        min-height: 9rem;
      }
    `;

    document.head.appendChild(style);
  }

  function renderAll(root) {
    if (typeof document === "undefined") {
      return;
    }

    injectStyles();

    const scope = root && root.querySelectorAll ? root : document;
    const blocks = scope.querySelectorAll(
      "code.language-feynman, pre.language-feynman > code",
    );

    blocks.forEach((code, index) => {
      const pre = code.closest("pre");

      if (!pre || pre.dataset.feynmanProcessed === "true") {
        return;
      }

      pre.dataset.feynmanProcessed = "true";
      const renderIndex = diagramSerial + index;
      const placeholder = renderLoadingFigure(renderIndex);

      pre.replaceWith(placeholder);
      renderFeynmanElement(code.textContent, renderIndex)
        .then((figure) => {
          placeholder.replaceWith(figure);
        })
        .catch((error) => {
          placeholder.replaceWith(renderErrorFigure(error, renderIndex));
        });
    });

    diagramSerial += blocks.length;
  }

  function boot() {
    if (typeof document === "undefined") {
      return;
    }

    if (window.document$ && typeof window.document$.subscribe === "function") {
      window.document$.subscribe((root) => renderAll(root));
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => renderAll(document));
      return;
    }

    renderAll(document);
  }

  const api = {
    parseFeynman,
    layoutFeynman,
    layoutFeynmanFallbackSync,
    edgePath,
    wavePath,
    wavePathForEdge,
    gluonPath,
    gluonPathForEdge,
    trianglePath,
    trianglePathForEdge,
    squarePath,
    squarePathForEdge,
    doubleLinePath,
    doubleLinePathForEdge,
    edgeLabelPosition,
    momentumArrowGeometry,
    braceGeometry,
    junctionCapNodes,
    parseLabelMarkup,
    labelNeedsMathJax,
    mathJaxDisplayFontSize,
    parseMathJaxSvgLength,
    labelMarkupToText,
    labelSegmentText,
    materializePendingMathLabels,
    visualDefaults: VISUAL_DEFAULTS,
    renderAll,
  };

  if (typeof globalThis !== "undefined") {
    globalThis.FeynmanDiagrams = api;
  } else if (typeof window !== "undefined") {
    window.FeynmanDiagrams = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  boot();
})();
