import ELK from "elkjs/lib/elk.bundled.js";

let elkInstance = null;

export async function layoutWithElk(diagram, layoutOptions, prepared, helpers) {
  const elk = getElk();
  const graph = helpers.buildSemanticElkGraph(
    prepared.semantic,
    layoutOptions,
    (node) => helpers.elkNodeDimensions(node, diagram),
    prepared.externalOrdering
  );
  prepared.compiledElkGraph = graph;
  const result = await elk.layout(graph);

  return helpers.normalizeElkLayout(diagram, layoutOptions, result);
}

function getElk() {
  if (!elkInstance) {
    elkInstance = new ELK({
      algorithms: ["layered", "mrtree", "force"],
    });
  }

  return elkInstance;
}
