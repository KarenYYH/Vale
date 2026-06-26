const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4567";

let _token = localStorage.getItem("vale_token") ?? "";

export function setToken(t: string) {
  _token = t;
  localStorage.setItem("vale_token", t);
}
export function clearToken() {
  _token = "";
  localStorage.removeItem("vale_token");
}
export function hasToken() { return !!_token; }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...((_token) ? { Authorization: `Bearer ${_token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) {
    clearToken();
    window.location.hash = "#/login";
    throw new Error("Unauthorized");
  }
  const data = await res.json() as T;
  return data;
}

export const api = {
  login: (username: string, password: string) =>
    req<{ token: string }>("POST", "/auth/login", { username, password }),

  search: (q: string, mode = "hybrid") =>
    req<{ results: SearchResult[] }>("GET", `/search?q=${encodeURIComponent(q)}&mode=${mode}`),

  query: (question: string) =>
    req<QueryResponse>("POST", "/query", { question }),

  health: () =>
    req<HealthStats>("GET", "/health"),

  graph: () =>
    req<KnowledgeGraph>("GET", "/graph"),

  lint: () =>
    req<{ summary: string; issues: LintIssue[] }>("GET", "/lint"),

  skills: () =>
    req<{ skills: SkillInfo[] }>("GET", "/skills"),

  note: (path: string) =>
    req<{ path: string; content: string }>("GET", `/notes/${encodeURIComponent(path)}`),
};

export interface SearchResult {
  path: string;
  title?: string;
  snippet?: string;
  score?: number;
}

export interface QueryResponse {
  answer: string;
  tier: "spawn-cli" | "api-llm" | "retrieval";
  matches?: SearchResult[];
  answerPath?: string;
}

export interface HealthStats {
  totalFiles: number;
  totalEmbeddings: number;
  nodeCount: number;
  linkCount: number;
  brokenLinks: number;
  orphans: number;
  healthScore: number;
}

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  layer: string;
  outgoingCount: number;
  incomingCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  count: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LintIssue {
  filePath: string;
  line?: number;
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface SkillInfo {
  name: string;
  displayName?: string;
  type: string;
  description: string;
  version: string;
  enabled: boolean;
  triggers: string[];
}
