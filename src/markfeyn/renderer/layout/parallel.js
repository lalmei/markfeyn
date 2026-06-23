export function parallelPropagatorCurvePlan(topology) {
  const assignments = [];

  (topology.parallelEdgeGroups || []).forEach((group) => {
    if (!group.internal || group.edges.length < 2) {
      return;
    }

    const count = group.edges.length;
    const center = (count - 1) / 2;

    group.edges.forEach((edge, index) => {
      const canonicalSide = index <= center ? "left" : "right";
      const side = edge.source === group.nodes[0] ? canonicalSide : oppositeSide(canonicalSide);
      const distance = Math.abs(index - center) + 0.5;
      const amount = count === 2
        ? 0.5
        : Math.min(0.72, 0.26 + distance * 0.18);

      assignments.push({
        propagator: edge.id,
        edgeIndex: edge.edgeIndex,
        group: group.id,
        side,
        amount,
      });
    });
  });

  return assignments;
}

function oppositeSide(side) {
  return side === "left" ? "right" : "left";
}
