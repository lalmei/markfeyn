import { applyIncrementalStability } from "./layout/incremental.js";
import {
  attachLayoutAnalysis,
  prepareFeynmanLayout,
} from "./layout/layout.js";
import { finalizeLayout } from "./layout/normalization.js";
import { resolveLayoutOptions } from "./layout/options.js";
import {
  applyParallelPropagatorCurves,
  layoutFeynmanPreparedFallbackRaw,
  layoutFeynmanPreparedRaw,
} from "./layout/strategies.js";

export function createLayoutEngine() {
  return {
    async layoutFeynman(diagram, options) {
      const prepared = prepareFeynmanLayout(diagram, options);
      const layoutDiagram = prepared.compatibleDiagram;
      const layoutOptions = resolveLayoutOptions(layoutDiagram, options);
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
      }

      const finalLayout = applyIncrementalStability(
        finalizeLayout(layoutDiagram, rawLayout, layoutOptions),
        prepared.incremental
      );

      return attachLayoutAnalysis(
        finalLayout,
        prepared,
        { enabled: layoutOptions.debug || layoutOptions.profile, elkGraph: prepared.compiledElkGraph }
      );
    },

    layoutFeynmanFallbackSync(diagram, options) {
      const prepared = prepareFeynmanLayout(diagram, options);
      const layoutDiagram = prepared.compatibleDiagram;
      const layoutOptions = resolveLayoutOptions(layoutDiagram, options);

      applyParallelPropagatorCurves(layoutDiagram, prepared);

      const fallbackStartedAt = profileNow();
      const rawLayout = layoutFeynmanPreparedFallbackRaw(layoutDiagram, layoutOptions, prepared);
      prepared.profile?.push("layout-fallback", profileNow() - fallbackStartedAt);

      return attachLayoutAnalysis(
        applyIncrementalStability(
          finalizeLayout(layoutDiagram, rawLayout, layoutOptions),
          prepared.incremental
        ),
        prepared,
        { enabled: layoutOptions.debug || layoutOptions.profile, elkGraph: prepared.compiledElkGraph }
      );
    },
  };
}

function profileNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
