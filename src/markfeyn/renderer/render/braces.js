import { createSvg, round } from "./dom.js";
import { createDiagramLabel } from "./labels.js";
import {
  BRACE_LABEL_PADDING,
  BRACE_SIDE_GAP,
  TEX_BRACE_METRICS,
  TEX_BRACE_PATHS,
} from "./visual-defaults.js";

export function renderBraces(diagram, layout) {
  return (diagram.braces || [])
    .map((brace) => renderBrace(brace, layout))
    .filter(Boolean);
}

export function renderBrace(brace, layout) {
  const from = layout.positions[brace.from];
  const to = layout.positions[brace.to];

  if (!from || !to) {
    return null;
  }

  const group = createSvg("g", {
    class: "feynman-diagram__brace-group",
  });
  const geometry = braceGeometry(from, to, brace.side);

  if (geometry.kind === "tex-brace") {
    geometry.pieces.forEach((piece) => {
      group.appendChild(createSvg("path", {
        class: "feynman-diagram__brace feynman-diagram__brace--tex",
        d: piece.path,
        transform: piece.transform,
      }));
    });
  } else {
    group.appendChild(createSvg("path", {
      class: "feynman-diagram__brace",
      d: geometry.path,
    }));
  }

  group.appendChild(createDiagramLabel({
    text: brace.label,
    x: geometry.label.x,
    y: geometry.label.y,
    anchor: geometry.label.anchor,
    className: "feynman-diagram__label feynman-diagram__label--brace",
  }));

  return group;
}

export function braceGeometry(from, to, side) {
  const gap = 42;
  const curl = 14;
  const labelGap = 22;

  if (side === "left" || side === "right") {
    const sign = side === "right" ? 1 : -1;
    const x = (
      side === "right" ? Math.max(from.x, to.x) : Math.min(from.x, to.x)
    ) + sign * BRACE_SIDE_GAP;
    const y1 = Math.min(from.y, to.y);
    const y2 = Math.max(from.y, to.y);
    const mid = (y1 + y2) / 2;
    const braceY1 = y1 - BRACE_LABEL_PADDING;
    const braceY2 = y2 + BRACE_LABEL_PADDING;
    const geometry = texBraceGeometry(x, braceY1, braceY2, side);

    return {
      kind: "tex-brace",
      x: round(x),
      pieces: geometry.pieces,
      scale: geometry.scale,
      extenderRepeats: geometry.extenderRepeats,
      bounds: {
        y1: round(braceY1),
        y2: round(braceY2),
      },
      label: {
        x: round(x + sign * labelGap),
        y: mid,
        anchor: side === "right" ? "start" : "end",
      },
    };
  }

  const sign = side === "bottom" ? 1 : -1;
  const x1 = Math.min(from.x, to.x);
  const x2 = Math.max(from.x, to.x);
  const mid = (x1 + x2) / 2;
  const y = (side === "bottom" ? Math.max(from.y, to.y) : Math.min(from.y, to.y)) + sign * gap;
  const notch = Math.min(10, Math.max(5, (x2 - x1) / 8));
  const path = [
    `M ${round(x1)} ${round(y)}`,
    `C ${round(x1)} ${round(y + sign * curl)} ${round(mid - notch * 2)} ${round(y + sign * curl)} ${round(mid - notch)} ${round(y)}`,
    `C ${round(mid - notch * 0.4)} ${round(y + sign * curl * 0.45)} ${round(mid + notch * 0.4)} ${round(y + sign * curl * 0.45)} ${round(mid + notch)} ${round(y)}`,
    `C ${round(mid + notch * 2)} ${round(y + sign * curl)} ${round(x2)} ${round(y + sign * curl)} ${round(x2)} ${round(y)}`,
  ].join(" ");

  return {
    kind: "path",
    path,
    label: {
      x: mid,
      y: y + sign * labelGap,
      anchor: "middle",
    },
  };
}

function texBraceGeometry(x, y1, y2, side) {
  const span = Math.max(1, y2 - y1);
  const rawRepeats = (
    span / TEX_BRACE_METRICS.targetScale - TEX_BRACE_METRICS.baseHeight
  ) / (2 * TEX_BRACE_METRICS.extenderAdvance);
  const extenderRepeats = Math.max(0, Math.round(rawRepeats));
  const designHeight = TEX_BRACE_METRICS.baseHeight
    + 2 * extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
  const scale = span / designHeight;
  const topY = y1 - TEX_BRACE_METRICS.topMinY * scale;
  const sidePaths = TEX_BRACE_PATHS[side];
  const middleY = TEX_BRACE_METRICS.topAdvance
    + extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
  const bottomExtensionY = middleY + TEX_BRACE_METRICS.middleAdvance;
  const bottomY = bottomExtensionY
    + extenderRepeats * TEX_BRACE_METRICS.extenderAdvance;
  const pieces = [
    texBracePiece(sidePaths.top, x, topY, scale, 0),
  ];

  for (let index = 0; index < extenderRepeats; index += 1) {
    pieces.push(texBracePiece(
      TEX_BRACE_PATHS.extender,
      x,
      topY,
      scale,
      TEX_BRACE_METRICS.topAdvance + index * TEX_BRACE_METRICS.extenderAdvance
    ));
  }

  pieces.push(texBracePiece(sidePaths.middle, x, topY, scale, middleY));

  for (let index = 0; index < extenderRepeats; index += 1) {
    pieces.push(texBracePiece(
      TEX_BRACE_PATHS.extender,
      x,
      topY,
      scale,
      bottomExtensionY + index * TEX_BRACE_METRICS.extenderAdvance
    ));
  }

  pieces.push(texBracePiece(sidePaths.bottom, x, topY, scale, bottomY));

  return {
    pieces,
    scale: round(scale),
    extenderRepeats,
  };
}

function texBracePiece(path, x, y, scale, yOffset) {
  return {
    path,
    transform: [
      `matrix(${round(scale)} 0 0 ${round(scale)}`,
      `${round(x - TEX_BRACE_METRICS.centerX * scale)}`,
      `${round(y + yOffset * scale)})`,
    ].join(" "),
  };
}
