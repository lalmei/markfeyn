import { applyIncrementalStability } from "./layout/incremental.js";
import {
  attachLayoutAnalysis,
  prepareFeynmanLayout,
} from "./layout/layout.js";

export function createLayoutEngine(helpers) {
  return {
    async layoutFeynman(diagram, options) {
      const prepared = prepareFeynmanLayout(diagram, options);
      const layoutDiagram = prepared.compatibleDiagram;
      const layoutOptions = helpers.resolveLayoutOptions(layoutDiagram, options);
      let rawLayout;

      helpers.applyParallelPropagatorCurves(layoutDiagram, prepared);

      try {
        const layoutStartedAt = helpers.profileNow();
        rawLayout = await helpers.layoutFeynmanPreparedRaw(layoutDiagram, layoutOptions, prepared);
        prepared.profile?.push("layout", helpers.profileNow() - layoutStartedAt);
      } catch (error) {
        const fallbackStartedAt = helpers.profileNow();
        rawLayout = helpers.layoutFeynmanPreparedFallbackRaw(layoutDiagram, layoutOptions, prepared);
        prepared.profile?.push("layout-fallback", helpers.profileNow() - fallbackStartedAt);
      }

      const finalLayout = applyIncrementalStability(
        helpers.finalizeLayout(layoutDiagram, rawLayout, layoutOptions),
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
      const layoutOptions = helpers.resolveLayoutOptions(layoutDiagram, options);

      helpers.applyParallelPropagatorCurves(layoutDiagram, prepared);

      const fallbackStartedAt = helpers.profileNow();
      const rawLayout = helpers.layoutFeynmanPreparedFallbackRaw(layoutDiagram, layoutOptions, prepared);
      prepared.profile?.push("layout-fallback", helpers.profileNow() - fallbackStartedAt);

      return attachLayoutAnalysis(
        applyIncrementalStability(
          helpers.finalizeLayout(layoutDiagram, rawLayout, layoutOptions),
          prepared.incremental
        ),
        prepared,
        { enabled: layoutOptions.debug || layoutOptions.profile, elkGraph: prepared.compiledElkGraph }
      );
    },
  };
}
