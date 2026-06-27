import { compareStable } from "../model.js";

export function adjacencyMap(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node, new Set()]));

  edges.forEach((edge) => {
    if (edge.source === edge.target) {
      return;
    }

    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }

    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set());
    }

    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  });

  return adjacency;
}

export function components(adjacency) {
  const visited = new Set();
  const result = [];

  Array.from(adjacency.keys()).sort(compareStable).forEach((node) => {
    if (visited.has(node)) {
      return;
    }

    const component = [];
    const stack = [node];
    visited.add(node);

    while (stack.length) {
      const current = stack.pop();
      component.push(current);

      Array.from(adjacency.get(current) || [])
        .sort(compareStable)
        .forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        });
    }

    result.push(component.sort(compareStable));
  });

  return result;
}

export function graphCentersFor(adjacency, preferredNodes) {
  const candidates = (preferredNodes.length ? preferredNodes : Array.from(adjacency.keys())).sort(compareStable);
  let best = [];
  let bestEccentricity = Infinity;

  candidates.forEach((node) => {
    const distances = breadthFirstDistances(adjacency, node);
    const eccentricity = Math.max(...Array.from(distances.values()));

    if (eccentricity < bestEccentricity) {
      best = [node];
      bestEccentricity = eccentricity;
    } else if (eccentricity === bestEccentricity) {
      best.push(node);
    }
  });

  return best.length ? best.sort(compareStable) : [];
}

export function breadthFirstDistances(adjacency, start) {
  const distances = new Map([[start, 0]]);
  const queue = [start];

  while (queue.length) {
    const current = queue.shift();
    const nextDistance = distances.get(current) + 1;

    Array.from(adjacency.get(current) || [])
      .sort(compareStable)
      .forEach((neighbor) => {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, nextDistance);
          queue.push(neighbor);
        }
      });
  }

  return distances;
}
