import {
  applyManualPositions,
  enforceDeclaredExternalOrder,
} from "./coordinates.js";
import { applyAlignmentConstraints } from "./normalizers/alignment.js";
import { fitLayoutTranslationToEdgeBounds } from "./normalizers/edge-bounds.js";
import {
  elkNodeDimensions,
  normalizeElkLayout as normalizeElkLayoutCore,
} from "./normalizers/elk.js";
import {
  alignInternalsAcrossInvisibleTerminalPairs,
  alignInternalsToDeclaredTerminalRows,
  alignVerticalProcessTerminalStacks,
  straightenSingleTerminalLegs,
  terminalCrossLocks,
} from "./normalizers/process.js";
import {
  alignHorizontalBackboneInternals,
  centerDefaultSpringExchangeFans,
  fitCurvedInternalEdgeGroupsToViewBox,
  orientHorizontalBackboneInternals,
} from "./normalizers/spring.js";
import {
  applyTikzPostLayoutOrientation,
  centerTikzOrientationEndpointFans,
} from "./normalizers/tikz-orientation.js";

export { elkNodeDimensions, terminalCrossLocks };

export function normalizeElkLayout(diagram, layoutOptions, elkGraph) {
  return normalizeElkLayoutCore(
    diagram,
    layoutOptions,
    elkGraph,
    applyLayoutNormalizations
  );
}

export function applyLayoutNormalizations(diagram, positions, axes, layoutOptions) {
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

export function finalizeLayout(diagram, layout, layoutOptions) {
  applyTikzPostLayoutOrientation(diagram, layout, layoutOptions);
  applyManualPositions(layout.positions, diagram, layoutOptions);
  layout.options = layoutOptions;

  return layout;
}

function usesSpringStyleNormalization(layoutOptions) {
  return layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical";
}
