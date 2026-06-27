import { compareStable } from "../model.js";
import {
  compareCycleNodeList,
  edgePairKey,
} from "./regions.js";

export function analyzeBiconnectedComponents(adjacency, edges) {
  const edgeIdsByPair = edgeIdsByPairMap(edges);
  const discovery = new Map();
  const low = new Map();
  const parent = new Map();
  const edgeStack = [];
  const articulation = new Set();
  const bridges = [];
  const componentsFound = [];
  let time = 0;

  Array.from(adjacency.keys()).sort(compareStable).forEach((root) => {
    if (discovery.has(root)) {
      return;
    }

    let rootChildren = 0;

    function visit(node) {
      discovery.set(node, time);
      low.set(node, time);
      time += 1;

      Array.from(adjacency.get(node) || []).sort(compareStable).forEach((neighbor) => {
        const edge = canonicalEdge(node, neighbor);

        if (!discovery.has(neighbor)) {
          parent.set(neighbor, node);
          rootChildren += node === root ? 1 : 0;
          edgeStack.push(edge);
          visit(neighbor);
          low.set(node, Math.min(low.get(node), low.get(neighbor)));

          if ((node === root && rootChildren > 1) || (node !== root && low.get(neighbor) >= discovery.get(node))) {
            articulation.add(node);
            componentsFound.push(popComponent(edgeStack, edge, edgeIdsByPair));
          }

          if (low.get(neighbor) > discovery.get(node)) {
            bridges.push(edgeSummary(node, neighbor, edgeIdsByPair));
          }
        } else if (parent.get(node) !== neighbor && discovery.get(neighbor) < discovery.get(node)) {
          low.set(node, Math.min(low.get(node), discovery.get(neighbor)));
          edgeStack.push(edge);
        }
      });
    }

    visit(root);

    if (edgeStack.length) {
      componentsFound.push(popComponent(edgeStack, null, edgeIdsByPair));
    }
  });

  return {
    components: componentsFound
      .filter((component) => component.nodes.length)
      .map((component, index) => ({
        id: `bcc:${index + 1}`,
        ...component,
        loopOrder: Math.max(0, component.edges.length - component.nodes.length + 1),
      }))
      .sort(compareComponentSummaries),
    articulationVertices: Array.from(articulation).sort(compareStable),
    bridges: bridges.sort((left, right) => compareStable(left.id, right.id)),
  };
}

function edgeIdsByPairMap(edges) {
  const map = new Map();

  edges.forEach((edge) => {
    const key = edgePairKey(edge.source, edge.target);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(edge.id);
  });

  map.forEach((ids) => ids.sort(compareStable));

  return map;
}

function canonicalEdge(source, target) {
  const [left, right] = [source, target].sort(compareStable);

  return { source: left, target: right, key: `${left}|${right}` };
}

function edgeSummary(source, target, edgeIdsByPair) {
  const edge = canonicalEdge(source, target);

  return {
    id: edgeIdsByPair.get(edge.key)?.[0] || edge.key,
    source: edge.source,
    target: edge.target,
    edges: edgeIdsByPair.get(edge.key) || [],
  };
}

function popComponent(edgeStack, stopEdge, edgeIdsByPair) {
  const nodes = new Set();
  const edges = new Set();

  while (edgeStack.length) {
    const edge = edgeStack.pop();

    nodes.add(edge.source);
    nodes.add(edge.target);
    (edgeIdsByPair.get(edge.key) || [edge.key]).forEach((edgeId) => edges.add(edgeId));

    if (!stopEdge || edge.key === stopEdge.key) {
      break;
    }
  }

  return {
    nodes: Array.from(nodes).sort(compareStable),
    edges: Array.from(edges).sort(compareStable),
  };
}

function compareComponentSummaries(left, right) {
  return compareCycleNodeList(left.nodes, right.nodes)
    || compareCycleNodeList(left.edges, right.edges);
}
