import { semanticNodeById } from "./model.js";

export function validateSemanticDiagram(semantic) {
  const diagnostics = [];
  const vertices = semanticNodeById(semantic);
  const vertexIds = semantic.vertices.map((vertex) => vertex.id);
  const propagatorIds = semantic.propagators.map((propagator) => propagator.id);

  duplicateValues(vertexIds).forEach((id) => {
    diagnostics.push(error(`Duplicate vertex id "${id}".`, { vertex: id }));
  });

  duplicateValues(propagatorIds).forEach((id) => {
    diagnostics.push(error(`Duplicate propagator id "${id}".`, { propagator: id }));
  });

  semantic.propagators.forEach((propagator) => {
    if (!vertices.has(propagator.source)) {
      diagnostics.push(error(`Propagator "${propagator.id}" references missing source "${propagator.source}".`, {
        propagator: propagator.id,
        vertex: propagator.source,
      }));
    }

    if (!vertices.has(propagator.target)) {
      diagnostics.push(error(`Propagator "${propagator.id}" references missing target "${propagator.target}".`, {
        propagator: propagator.id,
        vertex: propagator.target,
      }));
    }

    if (propagator.source === propagator.target) {
      diagnostics.push(warning(`Self-loop "${propagator.id}" has limited milestone-1 layout support.`, {
        propagator: propagator.id,
      }));
    }
  });

  const incoming = new Set(semantic.source.incoming || []);
  const outgoing = new Set(semantic.source.outgoing || []);

  Array.from(incoming).filter((node) => outgoing.has(node)).forEach((node) => {
    diagnostics.push(error(`Vertex "${node}" is declared both incoming and outgoing.`, { vertex: node }));
  });

  duplicateValues(semantic.source.incoming || []).forEach((node) => {
    diagnostics.push(error(`Incoming vertex "${node}" is declared more than once.`, { vertex: node }));
  });

  duplicateValues(semantic.source.outgoing || []).forEach((node) => {
    diagnostics.push(error(`Outgoing vertex "${node}" is declared more than once.`, { vertex: node }));
  });

  semantic.vertices.forEach((vertex) => {
    if (vertex.fixed && !vertex.positionHint) {
      diagnostics.push(error(`Fixed vertex "${vertex.id}" is missing a position hint.`, { vertex: vertex.id }));
    }
  });

  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
    diagnostics,
  };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  });

  return Array.from(duplicates);
}

function error(message, data = {}) {
  return {
    stage: "validation",
    severity: "error",
    message,
    data,
  };
}

function warning(message, data = {}) {
  return {
    stage: "validation",
    severity: "warning",
    message,
    data,
  };
}
