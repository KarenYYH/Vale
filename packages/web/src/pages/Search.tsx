import React, { useState, useCallback } from "react";
import { api } from "../api.js";
import type { SearchResult, QueryResponse } from "../api.js";

type Mode = "search" | "ask";

export function SearchPage({ onNoteOpen }: { onNoteOpen: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("ask");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [answer, setAnswer] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError("");
    setLoading(true);
    setResults(null);
    setAnswer(null);
    try {
      if (mode === "ask") {
        const res = await api.query(query);
        setAnswer(res);
      } else {
        const res = await api.search(query);
        setResults(res.results);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, mode]);

  const tierLabel: Record<QueryResponse["tier"], string> = {
    "spawn-cli": "AI (agent)",
    "api-llm": "AI (single-turn)",
    "retrieval": "Knowledge base context",
  };
  const tierClass: Record<QueryResponse["tier"], string> = {
    "spawn-cli": "badge-purple",
    "api-llm": "badge-green",
    "retrieval": "badge-yellow",
  };

  return (
    <div style={{ padding: "20px 16px", maxWidth: 720, margin: "0 auto" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={mode === "ask" ? "" : "secondary"}
            style={{ flex: 1 }}
            onClick={() => setMode("ask")}
          >Ask</button>
          <button
            type="button"
            className={mode === "search" ? "" : "secondary"}
            style={{ flex: 1 }}
            onClick={() => setMode("search")}
          >Search</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "ask" ? "Ask a question…" : "Search notes…"}
            autoFocus
          />
          <button type="submit" disabled={loading} style={{ whiteSpace: "nowrap" }}>
            {loading ? "…" : mode === "ask" ? "Ask" : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <p style={{ color: "var(--red)", marginTop: 12, fontSize: 14 }}>{error}</p>
      )}

      {answer && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Answer</span>
            <span className={`badge ${tierClass[answer.tier]}`}>{tierLabel[answer.tier]}</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--text)" }}>
            {answer.answer}
          </p>
          {answer.matches && answer.matches.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Sources</p>
              {answer.matches.slice(0, 5).map((m, i) => (
                <button
                  key={i}
                  className="secondary"
                  onClick={() => onNoteOpen(m.path)}
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4, fontSize: 13 }}
                >
                  📄 {m.path}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {results && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {results.length === 0 && (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No results found.</p>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              className="card secondary"
              onClick={() => onNoteOpen(r.path)}
              style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
            >
              <p style={{ fontWeight: 600, fontSize: 14 }}>{r.title ?? r.path}</p>
              {r.snippet && (
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.5 }}>
                  {r.snippet}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
