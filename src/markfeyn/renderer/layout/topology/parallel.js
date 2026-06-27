import { compareStable } from "../model.js";

export function detectParallelEdgeGroups(semantic, visibleEdges) {
  const internal = new Set(semantic.internalVertices);
  const grouped = new Map();

  visibleEdges
    .filter((edge) => edge.source !== edge.target)
    .forEach((edge) => {
      const nodes = [edge.source, edge.target].sort(compareStable);
      const key = nodes.join("|");

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          nodes,
          internal: nodes.every((node) => internal.has(node)),
          edges: [],
        });
      }

      grouped.get(key).edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeIndex: edge.metadata.edgeIndex,
        style: edge.style,
        curveSide: edge.metadata.curve?.side,
        curveAmount: edge.metadata.curve?.amount,
      });
    });

  return Array.from(grouped.values())
    .filter((group) => group.edges.length > 1)
    .map((group) => ({
      ...group,
      edges: group.edges.sort((left, right) => left.edgeIndex - right.edgeIndex || compareStable(left.id, right.id)),
      selfEnergyLike: group.internal && group.edges.length >= 2,
    }))
    .sort((left, right) => compareStable(left.id, right.id));
}
