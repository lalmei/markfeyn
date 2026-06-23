import { compareStable } from "./model.js";
import { previousOrderFromLayout } from "./incremental.js";

export function analyzeExternalOrdering(semantic, options = {}) {
  const previousOrder = normalizePreviousOrder(
    options.previousSemanticOrder
      || options.previousExternalOrder
      || previousOrderFromLayout(options.previousLayout)
      || semantic.source.previousSemanticOrder
      || semantic.source.externalOrder
  );
  const orderFor = makeOrderResolver(semantic, previousOrder);
  const incoming = orderRole(semantic.incoming, "incoming", orderFor);
  const outgoing = orderRole(semantic.outgoing, "outgoing", orderFor);
  const unclassified = orderRole(semantic.unclassified, "unclassified", orderFor);
  const byId = new Map([...incoming, ...outgoing, ...unclassified].map((entry) => [entry.id, entry]));
  const all = semantic.externalVertices
    .map((id) => byId.get(id) || orderFor(id, "unclassified"))
    .sort(compareExternalOrder);

  return {
    mode: semantic.incoming.length && semantic.outgoing.length ? "process" : "symmetric",
    incoming,
    outgoing,
    unclassified,
    all,
    previousOrder: previousOrder.list,
  };
}

export function compareExternalOrdering(ordering, left, right) {
  const indexById = new Map((ordering?.all || []).map((entry, index) => [entry.id, index]));
  const leftIndex = indexById.get(left);
  const rightIndex = indexById.get(right);

  if (leftIndex !== undefined && rightIndex !== undefined) {
    return leftIndex - rightIndex;
  }

  if (leftIndex !== undefined) {
    return -1;
  }

  if (rightIndex !== undefined) {
    return 1;
  }

  return compareStable(left, right);
}

export function externalOrderingDiagnostic(ordering) {
  return {
    stage: "external-order",
    severity: "info",
    message: `External ordering: ${ordering.mode}`,
    data: {
      mode: ordering.mode,
      incoming: summarizeEntries(ordering.incoming),
      outgoing: summarizeEntries(ordering.outgoing),
      unclassified: summarizeEntries(ordering.unclassified),
    },
  };
}

function orderRole(nodes, role, orderFor) {
  return nodes
    .map((id) => orderFor(id, role))
    .sort(compareExternalOrder)
    .map((entry, index) => ({
      ...entry,
      order: index,
    }));
}

function makeOrderResolver(semantic, previousOrder) {
  const vertexById = new Map(semantic.vertices.map((vertex) => [vertex.id, vertex]));
  const explicitIncoming = orderMap(semantic.incoming);
  const explicitOutgoing = orderMap(semantic.outgoing);

  return (id, role) => {
    const explicitIndex = role === "incoming"
      ? explicitIncoming.get(id)
      : role === "outgoing"
        ? explicitOutgoing.get(id)
        : undefined;
    const previousIndex = previousOrder.indexById.get(id);
    const declarationIndex = vertexById.get(id)?.metadata?.declarationIndex ?? Number.MAX_SAFE_INTEGER;

    if (explicitIndex !== undefined) {
      return orderEntry(id, role, 0, explicitIndex, "explicit");
    }

    if (previousIndex !== undefined) {
      return orderEntry(id, role, 1, previousIndex, "previous");
    }

    if (declarationIndex !== Number.MAX_SAFE_INTEGER) {
      return orderEntry(id, role, 2, declarationIndex, "declaration");
    }

    return orderEntry(id, role, 3, 0, "stable-id");
  };
}

function orderEntry(id, role, priority, value, source) {
  return {
    id,
    role,
    priority,
    value,
    source,
  };
}

function compareExternalOrder(left, right) {
  return left.priority - right.priority
    || left.value - right.value
    || compareStable(left.id, right.id);
}

function normalizePreviousOrder(value) {
  const list = [];

  if (Array.isArray(value)) {
    list.push(...value);
  } else if (value && typeof value === "object") {
    [
      value.incoming,
      value.outgoing,
      value.unclassified,
      value.externalVertices,
      value.all,
    ].forEach((items) => {
      if (Array.isArray(items)) {
        items.forEach((item) => list.push(typeof item === "string" ? item : item?.id));
      }
    });
  }

  const indexById = new Map();

  list.filter(Boolean).forEach((id) => {
    if (!indexById.has(id)) {
      indexById.set(id, indexById.size);
    }
  });

  return {
    list: Array.from(indexById.keys()),
    indexById,
  };
}

function orderMap(nodes) {
  return new Map(nodes.map((node, index) => [node, index]));
}

function summarizeEntries(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    order: entry.order,
    source: entry.source,
  }));
}
