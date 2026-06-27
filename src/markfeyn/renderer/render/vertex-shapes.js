import { BLOB_VERTEX_DEFAULT_RADII } from "../parser/constants.js";

export function vertexDefinitionShape(definition) {
  if (!definition) {
    return null;
  }

  if (typeof definition === "string") {
    return definition;
  }

  return definition.shape ?? null;
}

export function vertexDefinitionOptions(definition) {
  if (!definition || typeof definition === "string") {
    return {};
  }

  return definition;
}

export function blobVertexRadii(shape, definition) {
  const options = vertexDefinitionOptions(definition);
  const radius = options.size ?? BLOB_VERTEX_DEFAULT_RADII[shape];

  return {
    rx: options.rx ?? radius,
    ry: options.ry ?? radius,
  };
}

export function blobHatchPatternId(index, hatch) {
  return `feynman-hatch-${hatch}-${index}`;
}
