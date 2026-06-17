import type { Layer } from "../constants.js";

/** A parsed wikilink — [[Target]] or [[Target|alias]] or [[Target#heading]] */
export interface WikiLink {
  /** Source file path (where the link appears) */
  from: string;
  /** Target page name (resolved from link text) */
  to: string;
  /** Line number in source file */
  line: number;
  /** Raw link text including brackets */
  raw: string;
}

/** Bidirectional link index for the entire workspace */
export interface LinkIndex {
  /** source → links this page contains */
  outgoing: Map<string, WikiLink[]>;
  /** target → links pointing to this page */
  incoming: Map<string, WikiLink[]>;
}

/** A node in the knowledge graph visualization */
export interface GraphNode {
  id: string;
  label: string;
  path: string;
  layer: Layer | "other";
  outgoingCount: number;
  incomingCount: number;
}

/** An edge in the knowledge graph visualization */
export interface GraphEdge {
  source: string;
  target: string;
  count: number;
}

/** Complete knowledge graph data structure */
export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
