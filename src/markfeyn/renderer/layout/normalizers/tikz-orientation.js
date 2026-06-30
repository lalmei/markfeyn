import { lineVector } from "../../geometry/paths.js";
import { centerMultiTerminalFanJunctions } from "./spring.js";
import {
  clamp,
  degreesToRadians,
  diagramAxes,
  enforceDeclaredExternalOrder,
  nodeKind,
  positionBounds,
  terminalNeighborsByInternal,
} from "../coordinates.js";

export function centerTikzOrientationEndpointFans(diagram, positions, axes, layoutOptions) {
  const orientation = layoutOptions.tikzOrientation;

  if (!orientation) {
    return;
  }

  centerMultiTerminalFanJunctions(
    diagram,
    positions,
    axes,
    new Set([orientation.from, orientation.to])
  );
}

export function applyTikzPostLayoutOrientation(diagram, layout, layoutOptions) {
  const orientation = layoutOptions.tikzOrientation;

  if (!orientation) {
    return;
  }

  const from = layout.positions[orientation.from];
  const to = layout.positions[orientation.to];

  if (!from || !to) {
    return;
  }

  const currentAngle = Math.atan2(to.y - from.y, to.x - from.x);
  const targetAngle = degreesToRadians(orientation.angle);
  const rotation = targetAngle - currentAngle;
  const pivot = { x: from.x, y: from.y };

  Object.values(layout.positions).forEach((position) => {
    rotatePositionAround(position, pivot, rotation);
  });

  if (orientation.flip) {
    Object.values(layout.positions).forEach((position) => {
      reflectPositionAcrossLine(position, pivot, targetAngle);
    });
  }

  fanTikzOrientationMixedTerminalPairs(diagram, layout, orientation);
  fanTikzOrientationProcessTerminalGroups(diagram, layout, orientation);
  enforceDeclaredExternalOrder(diagram, layout.positions, diagramAxes(layoutOptions));
  fitLayoutPositions(layout, layoutOptions);
}

function fanTikzOrientationMixedTerminalPairs(diagram, layout, orientation) {
  const from = layout.positions[orientation.from];
  const to = layout.positions[orientation.to];

  if (!from || !to) {
    return;
  }

  const axis = lineVector(from, to);
  const axisGap = clamp(Math.min(layout.width, layout.height) * 0.24, 72, 104);
  const fanGap = orientation.axis === "vertical"
    ? clamp(Math.min(layout.width, layout.height) * 0.45, 126, 150)
    : clamp(Math.min(layout.width, layout.height) * 0.33, 84, 126);

  [
    { internal: orientation.from, outward: -1 },
    { internal: orientation.to, outward: 1 },
  ].forEach(({ internal, outward }) => {
    const endpoint = layout.positions[internal];
    const terminals = mixedTerminalPairForInternal(diagram, internal);

    if (!endpoint || !terminals) {
      return;
    }

    moveTerminalIntoOrientationFan(
      layout.positions[terminals.incoming],
      endpoint,
      axis,
      outward,
      1,
      axisGap,
      fanGap
    );
    moveTerminalIntoOrientationFan(
      layout.positions[terminals.outgoing],
      endpoint,
      axis,
      outward,
      -1,
      axisGap,
      fanGap
    );
  });
}

function mixedTerminalPairForInternal(diagram, internal) {
  const terminals = { incoming: [], outgoing: [] };
  const terminalKinds = new Set(["incoming", "outgoing"]);

  diagram.edges.forEach((edge) => {
    if (edge.hidden) {
      return;
    }

    let terminal = null;

    if (edge.from === internal && terminalKinds.has(nodeKind(edge.to, diagram))) {
      terminal = edge.to;
    }

    if (edge.to === internal && terminalKinds.has(nodeKind(edge.from, diagram))) {
      terminal = edge.from;
    }

    if (!terminal) {
      return;
    }

    terminals[nodeKind(terminal, diagram)].push(terminal);
  });

  if (terminals.incoming.length !== 1 || terminals.outgoing.length !== 1) {
    return null;
  }

  return {
    incoming: terminals.incoming[0],
    outgoing: terminals.outgoing[0],
  };
}

function fanTikzOrientationProcessTerminalGroups(diagram, layout, orientation) {
  const from = layout.positions[orientation.from];
  const to = layout.positions[orientation.to];

  if (!from || !to) {
    return;
  }

  const axis = lineVector(from, to);
  const axisGap = clamp(Math.min(layout.width, layout.height) * 0.24, 72, 104);
  const fanGap = clamp(Math.min(layout.width, layout.height) * 0.33, 84, 126);

  [
    { internal: orientation.from, kind: "incoming", outward: -1 },
    { internal: orientation.to, kind: "outgoing", outward: 1 },
  ].forEach(({ internal, kind, outward }) => {
    const endpoint = layout.positions[internal];
    const terminals = Array.from(terminalNeighborsByInternal(diagram, kind).get(internal) || [])
      .filter((terminal) => layout.positions[terminal])
      .sort((left, right) => terminalDeclarationOrder(diagram, kind, left) - terminalDeclarationOrder(diagram, kind, right) || left.localeCompare(right));

    if (!endpoint || terminals.length < 2) {
      return;
    }

    terminals.forEach((terminal, index) => {
      const side = terminals.length === 1
        ? 0
        : -1 + (2 * index) / (terminals.length - 1);
      const position = layout.positions[terminal];

      position.x = endpoint.x + axis.ux * axisGap * outward + axis.px * fanGap * side;
      position.y = endpoint.y + axis.uy * axisGap * outward + axis.py * fanGap * side;
    });
  });
}

function terminalDeclarationOrder(diagram, kind, terminal) {
  const list = kind === "incoming" ? diagram.incoming : diagram.outgoing;
  const index = list.indexOf(terminal);

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function moveTerminalIntoOrientationFan(position, endpoint, axis, outward, side, axisGap, fanGap) {
  if (!position) {
    return;
  }

  position.x = endpoint.x + axis.ux * axisGap * outward + axis.px * fanGap * side;
  position.y = endpoint.y + axis.uy * axisGap * outward + axis.py * fanGap * side;
}

function rotatePositionAround(position, pivot, angle) {
  const dx = position.x - pivot.x;
  const dy = position.y - pivot.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  position.x = pivot.x + dx * cos - dy * sin;
  position.y = pivot.y + dx * sin + dy * cos;
}

function reflectPositionAcrossLine(position, pivot, angle) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const dx = position.x - pivot.x;
  const dy = position.y - pivot.y;
  const parallel = dx * ux + dy * uy;
  const projection = {
    x: pivot.x + parallel * ux,
    y: pivot.y + parallel * uy,
  };

  position.x = 2 * projection.x - position.x;
  position.y = 2 * projection.y - position.y;
}

function fitLayoutPositions(layout, layoutOptions) {
  const positions = Object.values(layout.positions);

  if (!positions.length) {
    return;
  }

  const bounds = positionBounds(positions);
  const availableWidth = Math.max(1, layoutOptions.width - 2 * layoutOptions.marginX);
  const availableHeight = Math.max(1, layoutOptions.height - 2 * layoutOptions.marginY);
  const scale = Math.min(
    1,
    availableWidth / Math.max(1, bounds.maxX - bounds.minX),
    availableHeight / Math.max(1, bounds.maxY - bounds.minY)
  );
  const scaledWidth = (bounds.maxX - bounds.minX) * scale;
  const scaledHeight = (bounds.maxY - bounds.minY) * scale;
  const offsetX = layoutOptions.marginX + (availableWidth - scaledWidth) / 2 - bounds.minX * scale;
  const offsetY = layoutOptions.marginY + (availableHeight - scaledHeight) / 2 - bounds.minY * scale;

  positions.forEach((position) => {
    position.x = position.x * scale + offsetX;
    position.y = position.y * scale + offsetY;
  });
}
