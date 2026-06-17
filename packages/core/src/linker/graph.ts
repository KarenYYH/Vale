import type { LinkIndex, GraphNode, GraphEdge, KnowledgeGraph, Layer } from "@vale/shared";

/**
 * Transform a bidirectional link index into a knowledge graph
 * suitable for visualization (D3, force-graph, etc.).
 */
export function buildGraph(linkIndex: LinkIndex): KnowledgeGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  // Create nodes from all pages that exist
  for (const filePath of linkIndex.outgoing.keys()) {
    const layer = detectLayer(filePath);
    nodeMap.set(filePath, {
      id: filePath,
      label: filePath.split("/").pop()?.replace(/\.(md|txt)$/, "") ?? filePath,
      path: filePath,
      layer,
      outgoingCount: linkIndex.outgoing.get(filePath)?.length ?? 0,
      incomingCount: linkIndex.incoming.get(filePath)?.length ?? 0,
    });
  }

  // Create nodes for link targets that don't have their own page
  for (const target of linkIndex.incoming.keys()) {
    if (nodeMap.has(target)) continue;
    // target might be a bare page name without extension
    const existingKey = [...nodeMap.keys()].find(
      (k) => k === target || k === target + ".md",
    );
    if (existingKey) continue;

    nodeMap.set(target, {
      id: target,
      label: target.split("/").pop() ?? target,
      path: target,
      layer: "other",
      outgoingCount: 0,
      incomingCount: linkIndex.incoming.get(target)?.length ?? 0,
    });
  }

  // Build edges
  for (const [source, links] of linkIndex.outgoing) {
    for (const link of links) {
      const target = link.to;
      const edgeKey = `${source}→${target}`;

      const existing = edgeMap.get(edgeKey);
      if (existing) {
        existing.count++;
      } else {
        edgeMap.set(edgeKey, { source, target, count: 1 });
      }
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
  };
}

/** Detect which layer a file belongs to based on its path */
function detectLayer(filePath: string): Layer | "other" {
  if (filePath.startsWith("zettel/") || filePath.includes("/zettel/")) return "zettel";
  if (filePath.startsWith("wiki/") || filePath.includes("/wiki/")) return "wiki";
  if (filePath.startsWith("raw/") || filePath.includes("/raw/")) return "raw";
  return "other";
}
