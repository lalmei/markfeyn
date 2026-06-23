import { createCompatibilityDiagram, createSemanticDiagram } from "./model.js";
import { validateSemanticDiagram } from "./validate.js";
import { analyzeTopology } from "./topology.js";
import { analyzeOrientation } from "./orientation.js";
import { inferredPortDiagnostics } from "./elk-compiler.js";
import { analyzeExternalOrdering, externalOrderingDiagnostic } from "./external-order.js";
import { parallelPropagatorCurvePlan } from "./parallel.js";
import { scoreDiagnostic, scoreLayout } from "./score.js";
import {
  analyzeSymmetricUnclassifiedRefinement,
  symmetricUnclassifiedDiagnostic,
} from "./symmetric-unclassified.js";
import { analyzeMultiloop, multiloopDiagnostic } from "./multiloop.js";
import { analyzeIncrementalStability, incrementalDiagnostic } from "./incremental.js";
import { labelPlacementDiagnostic, resolveLabelPlacement } from "./labels.js";

export function prepareFeynmanLayout(diagram, options = {}) {
  const profile = createProfile(options);
  const semantic = profile.measure("semantic", () => createSemanticDiagram(diagram));
  const validation = profile.measure("validation", () => validateSemanticDiagram(semantic));
  const topology = profile.measure("topology", () => analyzeTopology(semantic));
  const orientation = profile.measure("orientation", () => analyzeOrientation(semantic, topology, options));
  const incremental = analyzeIncrementalStability(semantic, options);
  const externalOrdering = profile.measure("external-order", () => analyzeExternalOrdering(semantic, {
    ...options,
    previousLayout: incremental.previousLayout,
  }));
  const layoutOptionsHint = { ...(semantic.source.options || {}), ...options };
  const inferredPorts = profile.measure("port-constraints", () => (
    inferredPortDiagnostics(semantic, layoutOptionsHint, externalOrdering, orientation)
  ));
  const parallelCurvePlan = profile.measure("parallel-edges", () => parallelPropagatorCurvePlan(topology));
  const symmetricUnclassified = profile.measure("symmetric-unclassified", () => (
    analyzeSymmetricUnclassifiedRefinement(semantic, topology, orientation)
  ));
  const multiloop = profile.measure("multiloop", () => analyzeMultiloop(semantic, topology));
  const diagnostics = [
    ...validation.diagnostics,
    info(`Detected topology: ${topology.detectedTopology}`, "topology", {
      topology: topology.detectedTopology,
      confidence: topology.confidence,
      loopOrder: topology.loopOrder,
      cycles: topology.cycles,
      loopCandidate: topology.loopCandidate,
      parallelEdgeGroups: topology.parallelEdgeGroups,
      selfEnergyBubbles: topology.selfEnergyBubbles,
      limitations: topology.limitations,
    }),
    ...topologyLimitDiagnostics(topology),
    info(`Orientation mode: ${orientation.mode}`, "orientation", {
      mode: orientation.mode,
      evidence: orientation.evidence,
      ambiguities: orientation.ambiguities,
    }),
    externalOrderingDiagnostic(externalOrdering),
    info("Layered port constraints prepared", "port-constraints", inferredPorts),
    info("Parallel propagator groups prepared", "parallel-edges", {
      groups: topology.parallelEdgeGroups,
      curvePlan: parallelCurvePlan,
    }),
    multiloopDiagnostic(multiloop),
    incrementalDiagnostic(incremental),
    symmetricUnclassifiedDiagnostic(symmetricUnclassified),
  ];

  return {
    semantic,
    validation,
    topology,
    orientation,
    externalOrdering,
    diagnostics,
    compatibleDiagram: createCompatibilityDiagram(diagram, semantic),
    inferredPorts,
    parallelCurvePlan,
    symmetricUnclassified,
    multiloop,
    incremental,
    profile,
  };
}

export function shouldUseSymmetricContactLayout(prepared) {
  return (
    prepared.orientation.mode === "symmetric"
    && prepared.topology.detectedTopology === "contactInteraction"
  );
}

export function shouldUseSymmetricUnclassifiedLayout(prepared) {
  return Boolean(prepared.symmetricUnclassified?.applicable);
}

export function shouldUseSymmetricTreeLayout(prepared) {
  return (
    prepared.orientation.mode === "symmetric"
    && (prepared.topology.detectedTopology === "tree" || prepared.topology.detectedTopology === "decay")
    && !shouldUseSymmetricUnclassifiedLayout(prepared)
  );
}

export function attachLayoutAnalysis(layout, prepared, debug = {}) {
  const labelPlacementStartedAt = now();
  const labelPlacement = resolveLabelPlacement(layout, prepared);
  prepared.profile?.push("label-placement", now() - labelPlacementStartedAt);
  layout.labelPlacement = labelPlacement;

  const scoreStartedAt = now();
  const score = scoreLayout(layout, prepared);
  prepared.profile?.push("score", now() - scoreStartedAt);

  layout.analysis = {
    topology: prepared.topology,
    orientation: prepared.orientation,
    externalOrdering: prepared.externalOrdering,
    validation: prepared.validation,
  };
  layout.score = score;
  layout.diagnostics = [
    ...prepared.diagnostics,
    ...loopCandidateDiagnostics(prepared),
    labelPlacementDiagnostic(labelPlacement),
    scoreDiagnostic(score),
  ];

  if (debug.enabled) {
    layout.debug = {
      semanticGraph: prepared.semantic,
      compiledElkGraph: debug.elkGraph || null,
      elkGraph: debug.elkGraph || null,
      inferredPorts: prepared.inferredPorts.constraints,
      portConstraints: prepared.inferredPorts,
      externalOrdering: prepared.externalOrdering,
      parallelCurvePlan: prepared.parallelCurvePlan,
      loopCandidates: prepared.loopCandidateSelection || null,
      multiloopCandidates: prepared.multiloopCandidateSelection || null,
      labelPlacement,
      profile: prepared.profile?.entries || null,
      constraints: {
        ports: prepared.inferredPorts.constraints,
        portConstraints: prepared.inferredPorts,
      },
    };
  }

  return layout;
}

function info(message, stage, data = {}) {
  return {
    stage,
    severity: "info",
    message,
    data,
  };
}

function loopCandidateDiagnostics(prepared) {
  const selected = prepared.loopCandidateSelection?.selected;

  if (!selected) {
    return [];
  }

  return [
    info(
      selected.labelAware
        ? `Selected label-aware loop candidate: ${selected.id}${selected.labelInfluenced ? " (label score changed baseline choice)" : ""}`
        : `Selected loop candidate: ${selected.id}`,
      "loop-candidate",
      selected
    ),
  ];
}

function createProfile(options) {
  const enabled = Boolean(options.debug || options.profile);
  const entries = [];

  return {
    entries,
    measure(stage, callback) {
      if (!enabled) {
        return callback();
      }

      const startedAt = now();
      const result = callback();
      entries.push({ stage, ms: roundMs(now() - startedAt) });

      return result;
    },
    push(stage, ms) {
      if (enabled) {
        entries.push({ stage, ms: roundMs(ms) });
      }
    },
  };
}

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function roundMs(value) {
  return Number(value.toFixed(3));
}

function topologyLimitDiagnostics(topology) {
  return (topology.limitations || []).map((limitation) => ({
    stage: "topology",
    severity: "warning",
    message: limitation.message,
    data: limitation,
  }));
}
