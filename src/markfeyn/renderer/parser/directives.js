import {
  isNodeIdentifier,
  isTikzOrientationCommand,
} from "./options.js";

export function parseExplicitTikzOrientationCommand(parts, diagram, lineNumber) {
  const command = parts[0];

  if (!isTikzOrientationCommand(command)) {
    diagram.errors.push(`Line ${lineNumber}: tikz must use "tikz vertical a to b" or "tikz horizontal a to b"`);
    return;
  }

  parseTikzOrientationCommand(command, parts.slice(1), diagram, lineNumber);
}

export function parseTikzOrientationCommand(command, parts, diagram, lineNumber, options = {}) {
  const axis = command.startsWith("vertical") ? "vertical" : "horizontal";
  const flip = command.endsWith("'");

  if (
    parts.length !== 3
    || parts[1] !== "to"
    || !isNodeIdentifier(parts[0])
    || !isNodeIdentifier(parts[2])
  ) {
    diagram.errors.push(`Line ${lineNumber}: ${command} must use "${command} a to b"`);
    return;
  }

  if (options.deprecated) {
    diagram.warnings.push(
      `Line ${lineNumber}: "${command} ${parts.join(" ")}" is deprecated; use "tikz ${command} ${parts.join(" ")}" for post-layout rotation or "align ${axis} ${parts[0]} ${parts[2]}" for a native layout constraint`
    );
  }

  diagram.options.tikzOrientation = {
    axis,
    from: parts[0],
    to: parts[2],
    flip,
    angle: axis === "vertical" ? 90 : 0,
  };
}

export function parseAlignmentCommand(parts, diagram, lineNumber) {
  const axis = String(parts[0] || "").toLowerCase();

  if (axis !== "vertical" && axis !== "horizontal") {
    diagram.errors.push(`Line ${lineNumber}: align must use "align vertical a b" or "align horizontal a b"`);
    return;
  }

  const nodes = parts
    .slice(1)
    .filter((part) => part !== "to");

  if (nodes.length < 2 || nodes.some((node) => !isNodeIdentifier(node))) {
    diagram.errors.push(`Line ${lineNumber}: align ${axis} requires at least two node names`);
    return;
  }

  diagram.options.alignments = [
    ...(diagram.options.alignments || []),
    { axis, nodes },
  ];
}

export function parseManualPosition(parts, diagram, lineNumber) {
  if (parts.length !== 3) {
    diagram.errors.push(`Line ${lineNumber}: position must use "position node x y"`);
    return;
  }

  const [node, rawX, rawY] = parts;
  const x = Number(rawX);
  const y = Number(rawY);

  if (!node || !Number.isFinite(x) || !Number.isFinite(y)) {
    diagram.errors.push(`Line ${lineNumber}: position coordinates must be numbers`);
    return;
  }

  diagram.manualPositions[node] = { x, y };
}
