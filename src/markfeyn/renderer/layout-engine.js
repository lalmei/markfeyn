import { applyIncrementalStability } from "./layout/incremental.js";
import {
  attachLayoutAnalysis,
  prepareFeynmanLayout,
} from "./layout/layout.js";
import { finalizeLayout } from "./layout/normalization.js";
import { resolveLayoutOptions } from "./layout/options.js";
import { measureMinVertexDistance } from "./layout/crowding.js";
import { DEFAULT_DIAGRAM_OPTIONS } from "./parser/constants.js";
import {
  applyParallelPropagatorCurves,
  layoutFeynmanPreparedFallbackRaw,
  layoutFeynmanPreparedRaw,
} from "./layout/strategies.js";

// When no explicit size/width/height was requested, the default canvas is
// grown so that vertices stay at least this far apart (in SVG px). The ELK
// force layout is deterministic given the same seed, so re-resolving the
// layout at a larger canvas scales the already-computed relative spacing
// roughly linearly, letting a couple of measure-and-retry passes converge
// on the target without guessing at a closed-form size formula.
const AUTO_GROWTH_TARGET_SPACING = 40;
const AUTO_GROWTH_MAX_WIDTH = 1600;
const AUTO_GROWTH_MAX_ATTEMPTS = 3;

export function createLayoutFallbackDiagnostic(error) {
  return {
    stage: "layout-fallback",
    severity: "warning",
    message: `Layout engine failed, using fallback layout: ${error?.message || String(error)}`,
    data: {},
  };
}

export function createLayoutEngine() {
  return {
    async layoutFeynman(diagram, options) {
      const grown = isSizeExplicit(diagram, options)
        ? null
        : { attempt: 0 };
      let currentOptions = options;

      for (;;) {
        const prepared = prepareFeynmanLayout(diagram, currentOptions);
        const layoutDiagram = prepared.compatibleDiagram;
        const layoutOptions = resolveLayoutOptions(layoutDiagram, currentOptions);
        let rawLayout;

        applyParallelPropagatorCurves(layoutDiagram, prepared);

        try {
          const layoutStartedAt = profileNow();
          rawLayout = await layoutFeynmanPreparedRaw(layoutDiagram, layoutOptions, prepared);
          prepared.profile?.push("layout", profileNow() - layoutStartedAt);
        } catch (error) {
          const fallbackStartedAt = profileNow();
          rawLayout = layoutFeynmanPreparedFallbackRaw(layoutDiagram, layoutOptions, prepared);
          prepared.profile?.push("layout-fallback", profileNow() - fallbackStartedAt);
          prepared.diagnostics.push(createLayoutFallbackDiagnostic(error));
        }

        const finalLayout = applyIncrementalStability(
          finalizeLayout(layoutDiagram, rawLayout, layoutOptions),
          prepared.incremental
        );

        const attached = attachLayoutAnalysis(
          finalLayout,
          prepared,
          { enabled: layoutOptions.debug || layoutOptions.profile, elkGraph: prepared.compiledElkGraph }
        );

        const nextOptions = grown && nextAutoGrowthOptions(currentOptions, layoutOptions, attached, grown);

        if (!nextOptions) {
          return attached;
        }

        currentOptions = nextOptions;
      }
    },

    layoutFeynmanFallbackSync(diagram, options) {
      const grown = isSizeExplicit(diagram, options)
        ? null
        : { attempt: 0 };
      let currentOptions = options;

      for (;;) {
        const prepared = prepareFeynmanLayout(diagram, currentOptions);
        const layoutDiagram = prepared.compatibleDiagram;
        const layoutOptions = resolveLayoutOptions(layoutDiagram, currentOptions);

        applyParallelPropagatorCurves(layoutDiagram, prepared);

        const fallbackStartedAt = profileNow();
        const rawLayout = layoutFeynmanPreparedFallbackRaw(layoutDiagram, layoutOptions, prepared);
        prepared.profile?.push("layout-fallback", profileNow() - fallbackStartedAt);

        const attached = attachLayoutAnalysis(
          applyIncrementalStability(
            finalizeLayout(layoutDiagram, rawLayout, layoutOptions),
            prepared.incremental
          ),
          prepared,
          { enabled: layoutOptions.debug || layoutOptions.profile, elkGraph: prepared.compiledElkGraph }
        );

        const nextOptions = grown && nextAutoGrowthOptions(currentOptions, layoutOptions, attached, grown);

        if (!nextOptions) {
          return attached;
        }

        currentOptions = nextOptions;
      }
    },
  };
}

// `diagram.options` is seeded from DEFAULT_DIAGRAM_OPTIONS by the parser, so
// `size` is always present there ("medium" unless a `size ...` directive
// overrode it) — only a value different from the default means the user
// actually asked for it. `width`/`height` are never defaulted, so their mere
// presence (in diagram.options or in the call-time options override) means
// the user set them explicitly, either via `options width=... height=...` or
// by passing them programmatically.
function isSizeExplicit(diagram, options) {
  const diagramOptions = diagram?.options || {};
  const diagramSizeExplicit = diagramOptions.size != null && diagramOptions.size !== DEFAULT_DIAGRAM_OPTIONS.size;

  return Boolean(
    diagramSizeExplicit
    || diagramOptions.width != null
    || diagramOptions.height != null
    || options?.size != null
    || options?.width != null
    || options?.height != null
  );
}

// Returns a new options object to retry the layout with, or null when no
// further growth is needed (or allowed).
function nextAutoGrowthOptions(currentOptions, layoutOptions, layout, grown) {
  grown.attempt += 1;

  if (grown.attempt >= AUTO_GROWTH_MAX_ATTEMPTS) {
    return null;
  }

  const minDistance = measureMinVertexDistance(layout.positions);

  if (minDistance == null || minDistance >= AUTO_GROWTH_TARGET_SPACING) {
    return null;
  }

  const rawScale = AUTO_GROWTH_TARGET_SPACING / Math.max(minDistance, 1);
  const grownWidth = Math.min(AUTO_GROWTH_MAX_WIDTH, Math.round(layoutOptions.width * rawScale));

  if (grownWidth <= layoutOptions.width) {
    return null;
  }

  const actualScale = grownWidth / layoutOptions.width;
  const grownHeight = Math.round(layoutOptions.height * actualScale);

  return { ...currentOptions, width: grownWidth, height: grownHeight };
}

function profileNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
