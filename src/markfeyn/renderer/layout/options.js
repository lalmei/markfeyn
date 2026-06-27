import {
  DEFAULT_DIAGRAM_OPTIONS,
  SIZE_PRESETS,
} from "../parser/constants.js";
import {
  isNodeIdentifier,
  normalizeLayoutName,
  normalizeOrientation,
  normalizeQuality,
  normalizeTikzOrientation,
} from "../parser/options.js";

export function resolveLayoutOptions(diagram, options) {
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

export function resolveRequestedLayout(diagram, options) {
  const merged = {
    ...DEFAULT_DIAGRAM_OPTIONS,
    ...(diagram.options || {}),
    ...(options || {}),
  };

  return normalizeLayoutName(merged.layout) || DEFAULT_DIAGRAM_OPTIONS.layout;
}

export function normalizeAlignmentConstraints(value) {
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
