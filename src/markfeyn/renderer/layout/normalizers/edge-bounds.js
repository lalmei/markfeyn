import { edgePath } from "../../geometry/paths.js";

function layoutEdgePathBounds(diagram, positions) {
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };
  let hasGeometry = false;

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    const from = positions[edge.from];
    const to = positions[edge.to];

    if (!from || !to) {
      return;
    }

    const numbers = edgePath(edge, from, to).match(/-?\d+(?:\.\d+)?/g);

    if (!numbers) {
      return;
    }

    numbers.map(Number).forEach((value, index) => {
      if (index % 2 === 0) {
        hasGeometry = true;
        bounds.minX = Math.min(bounds.minX, value);
        bounds.maxX = Math.max(bounds.maxX, value);
        return;
      }

      bounds.minY = Math.min(bounds.minY, value);
      bounds.maxY = Math.max(bounds.maxY, value);
    });
  });

  return hasGeometry ? bounds : null;
}

export function fitLayoutTranslationToEdgeBounds(diagram, positions, layoutOptions) {
  const bounds = layoutEdgePathBounds(diagram, positions);

  if (!bounds) {
    return;
  }

  const minX = layoutOptions.marginX;
  const maxX = layoutOptions.width - layoutOptions.marginX;
  const minY = layoutOptions.marginY;
  const maxY = layoutOptions.height - layoutOptions.marginY;
  let offsetX = 0;
  let offsetY = 0;

  if (bounds.minX < minX) {
    offsetX = minX - bounds.minX;
  } else if (bounds.maxX > maxX) {
    offsetX = maxX - bounds.maxX;
  }

  if (bounds.minY < minY) {
    offsetY = minY - bounds.minY;
  } else if (bounds.maxY > maxY) {
    offsetY = maxY - bounds.maxY;
  }

  if (!offsetX && !offsetY) {
    return;
  }

  Object.values(positions).forEach((position) => {
    position.x += offsetX;
    position.y += offsetY;
  });
}
