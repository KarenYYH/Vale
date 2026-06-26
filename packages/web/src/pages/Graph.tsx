import React, { useState, useEffect, useMemo } from "react";
import { api } from "../api.js";
import type { KnowledgeGraph, GraphNode } from "../api.js";

const layerColor: Record<string, string> = {
  wiki: "#6366f1",
  zettel: "#10b981",
  raw: "#f59e0b",
  projects: "#ec4899",
  other: "#94a3b8",
};

interface Positioned extends GraphNode {
  x: number;
  y: number;
}

/**
 * Deterministic layout: a few iterations of repulsion + edge attraction,
 * seeded on a circle. Good enough to reveal clusters for a few hundred nodes
 * without pulling in a graph library.
 */
function layout(graph: KnowledgeGraph, w: number, h: number): Positioned[] {
  const n = graph.nodes.length;
  if (n === 0) return [];
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) * 0.38;
  const nodes: Positioned[] = graph.nodes.map((node, i) => ({
    ...node,
    x: cx + radius * Math.cos((2 * Math.PI * i) / n),
    y: cy + radius * Math.sin((2 * Math.PI * i) / n),
  }));
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));

  for (let iter = 0; iter < 80; iter++) {
    const fx = new Array(n).fill(0);
    const fy = new Array(n).fill(0);
    // Repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d2 = dx * dx + dy * dy || 1;
        const f = 1800 / d2;
        const dx2 = dx * f, dy2 = dy * f;
        fx[i] += dx2; fy[i] += dy2;
        fx[j] -= dx2; fy[j] -= dy2;
      }
    }
    // Attraction along edges
    for (const e of graph.edges) {
      const a = idx.get(e.source), b = idx.get(e.target);
      if (a === undefined || b === undefined) continue;
      const dx = nodes[a].x - nodes[b].x;
      const dy = nodes[a].y - nodes[b].y;
      const f = 0.01;
      fx[a] -= dx * f; fy[a] -= dy * f;
      fx[b] += dx * f; fy[b] += dy * f;
    }
    for (let i = 0; i < n; i++) {
      nodes[i].x = Math.max(20, Math.min(w - 20, nodes[i].x + Math.max(-15, Math.min(15, fx[i]))));
      nodes[i].y = Math.max(20, Math.min(h - 20, nodes[i].y + Math.max(-15, Math.min(15, fy[i]))));
    }
  }
  return nodes;
}

export function GraphPage({ onNoteOpen }: { onNoteOpen: (path: string) => void }) {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<string | null>(null);

  const W = 720, H = 520;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const g = await api.graph();
        if (!cancelled) setGraph(g);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const positioned = useMemo(
    () => (graph ? layout(graph, W, H) : []),
    [graph],
  );
  const posById = useMemo(
    () => new Map(positioned.map((p) => [p.id, p])),
    [positioned],
  );

  return (
    <div style={{ padding: "20px 16px", maxWidth: 760, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Knowledge Graph</h2>

      {loading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>}

      {graph && graph.nodes.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
          No linked notes yet. Add <code>[[wikilinks]]</code> between notes to build the graph.
        </p>
      )}

      {graph && graph.nodes.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>
            {graph.nodes.length} nodes · {graph.edges.length} links
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", background: "var(--surface)" }}>
              {graph.edges.map((e, i) => {
                const a = posById.get(e.source), b = posById.get(e.target);
                if (!a || !b) return null;
                const active = hover === e.source || hover === e.target;
                return (
                  <line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={active ? "var(--text-dim)" : "var(--border)"}
                    strokeWidth={active ? 1.5 : 0.75}
                  />
                );
              })}
              {positioned.map((nd) => {
                const r = 5 + Math.min(10, (nd.incomingCount + nd.outgoingCount) * 1.5);
                return (
                  <g key={nd.id} style={{ cursor: "pointer" }}
                     onMouseEnter={() => setHover(nd.id)}
                     onMouseLeave={() => setHover(null)}
                     onClick={() => onNoteOpen(nd.path)}>
                    <circle cx={nd.x} cy={nd.y} r={r}
                      fill={layerColor[nd.layer] ?? layerColor.other}
                      opacity={hover && hover !== nd.id ? 0.4 : 1} />
                    {(hover === nd.id || graph.nodes.length <= 40) && (
                      <text x={nd.x + r + 2} y={nd.y + 3} fontSize={10} fill="var(--text)">
                        {nd.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", fontSize: 12 }}>
            {Object.entries(layerColor).map(([layer, color]) => (
              <span key={layer} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-dim)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
                {layer}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
