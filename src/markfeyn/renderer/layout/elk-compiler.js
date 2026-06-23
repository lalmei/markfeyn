import { ELK_LAYOUT_OPTIONS, buildElkLayoutOptions } from "./elk-options.js";
import { compareStable, semanticNodeById } from "./model.js";
import { compareExternalOrdering } from "./external-order.js";

export function buildSemanticElkGraph(semantic, layoutOptions, nodeDimensions, externalOrdering) {
  const vertices = semantic.vertices.slice().sort((a, b) => compareStable(a.id, b.id));
  const useExplicitPorts = shouldUseExplicitPorts(semantic, layoutOptions);
  const portsByNode = inferPorts(semantic, layoutOptions, externalOrdering, useExplicitPorts);

  return {
    id: "markfeyn-root",
    layoutOptions: buildElkLayoutOptions(layoutOptions),
    children: vertices.map((vertex) => ({
      id: vertex.id,
      ...nodeDimensions(vertex.id),
      ports: useExplicitPorts ? (portsByNode.get(vertex.id) || []).map((port) => ({
        id: port.id,
        layoutOptions: {
          [ELK_LAYOUT_OPTIONS.portSide]: port.side,
          [ELK_LAYOUT_OPTIONS.portIndex]: String(port.order),
        },
      })) : [],
      layoutOptions: nodeLayoutOptions(vertex, layoutOptions, useExplicitPorts, portsByNode.get(vertex.id) || []),
    })),
    edges: semantic.propagators
      .filter((edge) => edge.source !== edge.target)
      .map((edge) => ({
        id: edge.id,
        sources: [useExplicitPorts ? portId(edge.id, edge.source, "source") : edge.source],
        targets: [useExplicitPorts ? portId(edge.id, edge.target, "target") : edge.target],
        layoutOptions: edgeLayoutOptions(edge, layoutOptions),
      })),
  };
}

export function inferPorts(semantic, layoutOptions = {}, externalOrdering = null, useExplicitPorts = shouldUseExplicitPorts(semantic, layoutOptions)) {
  const vertexById = semanticNodeById(semantic);
  const ports = new Map(semantic.vertices.map((vertex) => [vertex.id, []]));

  semantic.propagators
    .filter((edge) => edge.source !== edge.target)
    .forEach((edge) => {
      addPort(ports, edge.source, {
        id: portId(edge.id, edge.source, "source"),
        propagator: edge.id,
        side: sideForEndpoint(edge, edge.source, vertexById, layoutOptions),
        order: portOrder(edge, edge.source, vertexById, externalOrdering),
        edgeIndex: edge.metadata.edgeIndex,
      });
      addPort(ports, edge.target, {
        id: portId(edge.id, edge.target, "target"),
        propagator: edge.id,
        side: sideForEndpoint(edge, edge.target, vertexById, layoutOptions),
        order: portOrder(edge, edge.target, vertexById, externalOrdering),
        edgeIndex: edge.metadata.edgeIndex,
      });
    });

  ports.forEach((nodePorts) => {
    nodePorts.sort((left, right) => {
      const sideOrder = sideRank(left.side) - sideRank(right.side);
      return sideOrder
        || left.order - right.order
        || left.edgeIndex - right.edgeIndex
        || compareStable(left.id, right.id);
    });

    nodePorts.forEach((port, index) => {
      port.order = index;
    });
  });

  return ports;
}

export function inferredPortDiagnostics(semantic, layoutOptions = {}, externalOrdering = null) {
  const useExplicitPorts = shouldUseExplicitPorts(semantic, layoutOptions);
  const ports = inferPorts(semantic, layoutOptions, externalOrdering, useExplicitPorts);
  const constraints = {};

  ports.forEach((nodePorts, node) => {
    constraints[node] = nodePorts.map((port) => ({
      id: port.id,
      side: port.side,
      order: port.order,
      propagator: port.propagator,
    }));
  });

  return {
    applied: useExplicitPorts,
    layout: layoutOptions.layout || "spring",
    direction: effectiveDirection(layoutOptions),
    constraints,
  };
}

function nodeLayoutOptions(vertex, layoutOptions, useExplicitPorts, ports) {
  const options = {};

  if (layoutOptions.layout === "layered") {
    if (vertex.externalRole === "incoming") {
      options[ELK_LAYOUT_OPTIONS.layerConstraint] = "FIRST";
    }

    if (vertex.externalRole === "outgoing") {
      options[ELK_LAYOUT_OPTIONS.layerConstraint] = "LAST";
    }
  }

  if (useExplicitPorts && ports.length) {
    options[ELK_LAYOUT_OPTIONS.portConstraints] = "FIXED_ORDER";
  }

  return options;
}

function edgeLayoutOptions(edge, layoutOptions) {
  if (layoutOptions.layout === "spring-electrical") {
    return {
      [ELK_LAYOUT_OPTIONS.forceRepulsivePower]: "2",
    };
  }

  return {};
}

function addPort(ports, node, port) {
  if (!ports.has(node)) {
    ports.set(node, []);
  }

  ports.get(node).push(port);
}

function sideForEndpoint(edge, node, vertexById, layoutOptions) {
  const role = vertexById.get(node)?.externalRole;
  const other = edge.source === node ? edge.target : edge.source;
  const otherRole = vertexById.get(other)?.externalRole;

  if (role === "incoming") {
    return terminalSide("incoming", layoutOptions);
  }

  if (role === "outgoing") {
    return terminalSide("outgoing", layoutOptions);
  }

  if (otherRole === "incoming") {
    return internalSideForTerminal("incoming", layoutOptions);
  }

  if (otherRole === "outgoing") {
    return internalSideForTerminal("outgoing", layoutOptions);
  }

  return edge.source === node ? forwardSide(layoutOptions) : backwardSide(layoutOptions);
}

function terminalSide(role, layoutOptions) {
  if (role === "incoming") {
    return forwardSide(layoutOptions);
  }

  return backwardSide(layoutOptions);
}

function internalSideForTerminal(role, layoutOptions) {
  if (role === "incoming") {
    return backwardSide(layoutOptions);
  }

  return forwardSide(layoutOptions);
}

function forwardSide(layoutOptions) {
  return effectiveDirection(layoutOptions) === "LEFT" ? "WEST" : "EAST";
}

function backwardSide(layoutOptions) {
  return effectiveDirection(layoutOptions) === "LEFT" ? "EAST" : "WEST";
}

function portOrder(edge, node, vertexById, externalOrdering) {
  const role = vertexById.get(node)?.externalRole;

  if (role === "incoming" || role === "outgoing" || role === "unclassified") {
    return externalIndex(externalOrdering, node);
  }

  const other = edge.source === node ? edge.target : edge.source;
  const otherRole = vertexById.get(other)?.externalRole;

  if (otherRole === "incoming" || otherRole === "outgoing" || otherRole === "unclassified") {
    return externalIndex(externalOrdering, other);
  }

  return edge.metadata.edgeIndex;
}

function externalIndex(externalOrdering, node) {
  const index = (externalOrdering?.all || [])
    .slice()
    .sort((left, right) => compareExternalOrdering(externalOrdering, left.id, right.id))
    .findIndex((entry) => entry.id === node);

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function shouldUseExplicitPorts(semantic, layoutOptions) {
  return isLayeredLayout(layoutOptions.layout)
    && semantic.incoming.length > 0
    && semantic.outgoing.length > 0;
}

function effectiveDirection(layoutOptions) {
  const direction = String(layoutOptions.direction || "").toUpperCase();

  if (direction === "LEFT" || direction === "RIGHT") {
    return direction;
  }

  return layoutOptions.orientation?.endsWith("reverse") ? "LEFT" : "RIGHT";
}

function isLayeredLayout(layout) {
  const normalized = String(layout || "spring")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized === "layered" || normalized === "layered layout";
}

function sideRank(side) {
  return { WEST: 0, NORTH: 1, SOUTH: 2, EAST: 3 }[side] ?? 4;
}

function portId(edgeId, node, endpointKind) {
  return `${node}__${endpointKind}__${edgeId}`.replace(/[^A-Za-z0-9_.-]/g, "_");
}
