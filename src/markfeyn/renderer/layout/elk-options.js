export const ELK_LAYOUT_OPTIONS = Object.freeze({
  algorithm: "elk.algorithm",
  direction: "elk.direction",
  randomSeed: "elk.randomSeed",
  separateConnectedComponents: "elk.separateConnectedComponents",
  spacingNodeNode: "elk.spacing.nodeNode",
  padding: "elk.padding",
  layeredNodeNodeBetweenLayers: "elk.layered.spacing.nodeNodeBetweenLayers",
  layeredEdgeNodeBetweenLayers: "elk.layered.spacing.edgeNodeBetweenLayers",
  layeredFavorStraightEdges: "elk.layered.nodePlacement.favorStraightEdges",
  layerConstraint: "elk.layered.layering.layerConstraint",
  portConstraints: "elk.portConstraints",
  portSide: "elk.port.side",
  portIndex: "elk.port.index",
  forceRepulsivePower: "elk.force.repulsivePower",
  forceIterations: "elk.force.iterations",
  forceRepulsion: "elk.force.repulsion",
  mrtreeSearchOrder: "elk.mrtree.searchOrder",
  mrtreeWeighting: "elk.mrtree.weighting",
});

export function buildElkLayoutOptions(layoutOptions) {
  const options = {
    [ELK_LAYOUT_OPTIONS.algorithm]: elkAlgorithmForLayout(layoutOptions.layout),
    [ELK_LAYOUT_OPTIONS.direction]: directionForLayout(layoutOptions),
    [ELK_LAYOUT_OPTIONS.randomSeed]: String(layoutOptions.deterministicSeed ?? 1),
    [ELK_LAYOUT_OPTIONS.separateConnectedComponents]: "true",
    [ELK_LAYOUT_OPTIONS.spacingNodeNode]: String(layoutOptions.layout === "spring-electrical" ? 96 : 64),
    [ELK_LAYOUT_OPTIONS.padding]: `[top=${layoutOptions.marginY},left=${layoutOptions.marginX},bottom=${layoutOptions.marginY},right=${layoutOptions.marginX}]`,
  };

  if (layoutOptions.layout === "layered") {
    // These layered options keep process diagrams readable while preserving model order.
    options[ELK_LAYOUT_OPTIONS.layeredNodeNodeBetweenLayers] = "96";
    options[ELK_LAYOUT_OPTIONS.layeredEdgeNodeBetweenLayers] = "42";
    options[ELK_LAYOUT_OPTIONS.layeredFavorStraightEdges] = "true";
  }

  if (layoutOptions.layout === "tree") {
    options[ELK_LAYOUT_OPTIONS.mrtreeSearchOrder] = "DFS";
    options[ELK_LAYOUT_OPTIONS.mrtreeWeighting] = "DESCENDANTS";
  }

  if (layoutOptions.layout === "spring" || layoutOptions.layout === "spring-electrical") {
    options[ELK_LAYOUT_OPTIONS.forceIterations] = layoutOptions.layout === "spring-electrical" ? "160" : "100";
    options[ELK_LAYOUT_OPTIONS.forceRepulsion] = layoutOptions.layout === "spring-electrical" ? "1.2" : "0.6";
  }

  return options;
}

export function elkAlgorithmForLayout(layout) {
  if (layout === "tree") {
    return "mrtree";
  }

  if (layout === "spring" || layout === "spring-electrical") {
    return "force";
  }

  return "layered";
}

export function directionForLayout(layoutOptions) {
  if (layoutOptions.direction) {
    return layoutOptions.direction;
  }

  if (layoutOptions.orientation?.endsWith("reverse")) {
    return "LEFT";
  }

  return "RIGHT";
}
