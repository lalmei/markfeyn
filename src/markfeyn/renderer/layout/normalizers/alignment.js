

export function applyAlignmentConstraints(diagram, positions, layoutOptions) {
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
