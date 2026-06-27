import { createSvg } from "./dom.js";
import {
  blobHatchPatternId,
  blobVertexRadii,
  vertexDefinitionOptions,
  vertexDefinitionShape,
} from "./vertex-shapes.js";

export function renderVertex(node, position, diagram, index = 0) {
  const definition = diagram.vertices?.[node] ?? null;
  const shape = vertexDefinitionShape(definition);

  if (!shape) {
    return null;
  }

  if (shape === "dot") {
    return createSvg("circle", {
      class: "feynman-diagram__vertex feynman-diagram__vertex--dot",
      cx: position.x,
      cy: position.y,
      r: 3.5,
    });
  }

  if (shape === "square-dot") {
    return createSvg("rect", {
      class: "feynman-diagram__vertex feynman-diagram__vertex--square-dot",
      x: position.x - 4,
      y: position.y - 4,
      width: 8,
      height: 8,
    });
  }

  if (shape === "empty-dot") {
    return createSvg("circle", {
      class: "feynman-diagram__vertex feynman-diagram__vertex--empty-dot",
      cx: position.x,
      cy: position.y,
      r: 5,
    });
  }

  if (shape === "cross" || shape === "crossed-dot") {
    const group = createSvg("g", {
      class: `feynman-diagram__vertex-group feynman-diagram__vertex-group--${shape}`,
    });
    const radius = shape === "crossed-dot" ? 6 : 7;

    if (shape === "crossed-dot") {
      group.appendChild(createSvg("circle", {
        class: "feynman-diagram__vertex feynman-diagram__vertex--empty-dot",
        cx: position.x,
        cy: position.y,
        r: radius,
      }));
    }

    group.appendChild(createSvg("line", {
      class: "feynman-diagram__vertex-mark",
      x1: position.x - radius,
      y1: position.y - radius,
      x2: position.x + radius,
      y2: position.y + radius,
    }));
    group.appendChild(createSvg("line", {
      class: "feynman-diagram__vertex-mark",
      x1: position.x - radius,
      y1: position.y + radius,
      x2: position.x + radius,
      y2: position.y - radius,
    }));

    return group;
  }

  if (shape === "blob" || shape === "disk") {
    const options = vertexDefinitionOptions(definition);
    const group = createSvg("g", {
      class: `feynman-diagram__vertex-group feynman-diagram__vertex-group--${shape}`,
    });
    const radii = blobVertexRadii(shape, definition);
    const circular = Math.abs(radii.rx - radii.ry) < 0.001;
    const hatch = options.hatch;
    const shapeAttributes = {
      class: [
        "feynman-diagram__vertex",
        "feynman-diagram__vertex--blob",
        `feynman-diagram__vertex--${shape}`,
        hatch ? "feynman-diagram__vertex--blob-hatched" : "feynman-diagram__vertex--blob-shaded",
      ].join(" "),
      cx: position.x,
      cy: position.y,
    };
    const backdropAttributes = {
      class: "feynman-diagram__vertex-backdrop",
      cx: position.x,
      cy: position.y,
    };

    if (circular) {
      shapeAttributes.r = radii.rx;
      backdropAttributes.r = radii.rx + 1;
    } else {
      shapeAttributes.rx = radii.rx;
      shapeAttributes.ry = radii.ry;
      backdropAttributes.rx = radii.rx + 1;
      backdropAttributes.ry = radii.ry + 1;
    }

    if (hatch) {
      shapeAttributes.fill = `url(#${blobHatchPatternId(index, hatch)})`;
    }

    group.appendChild(createSvg(circular ? "circle" : "ellipse", backdropAttributes));
    group.appendChild(createSvg(circular ? "circle" : "ellipse", shapeAttributes));

    return group;
  }

  return null;
}
