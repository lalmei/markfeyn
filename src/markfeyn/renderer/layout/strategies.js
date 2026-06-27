import { buildSemanticElkGraph } from "./elk-compiler.js";
import { layoutWithElk } from "./elk-runner.js";
import { layoutFeynmanFallbackRaw, layoutTree } from "./fallback.js";
import {
  shouldUseSymmetricContactLayout,
  shouldUseSymmetricTreeLayout,
  shouldUseSymmetricUnclassifiedLayout,
} from "./layout.js";
import { selectLoopCandidateLayout } from "./loop-candidates.js";
import { selectMultiloopLayout } from "./multiloop.js";
import {
  elkNodeDimensions,
  normalizeElkLayout,
} from "./normalization.js";
import {
  layoutSymmetricContact,
  layoutSymmetricTree,
  layoutSymmetricUnclassifiedRefinement,
} from "./symmetric.js";

export async function layoutFeynmanPreparedRaw(diagram, layoutOptions, prepared) {
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

export function layoutFeynmanPreparedFallbackRaw(diagram, layoutOptions, prepared) {
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

export function applyParallelPropagatorCurves(diagram, prepared) {
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

async function layoutFeynmanWithElk(diagram, layoutOptions, prepared) {
  return layoutWithElk(diagram, layoutOptions, prepared, {
    buildSemanticElkGraph,
    elkNodeDimensions,
    normalizeElkLayout,
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
