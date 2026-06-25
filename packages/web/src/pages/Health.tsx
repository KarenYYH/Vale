import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import type { HealthStats, LintIssue } from "../api.js";

const sevColor: Record<LintIssue["severity"], string> = {
  error: "var(--red)",
  warning: "var(--yellow, #b8860b)",
  info: "var(--text-dim)",
};

export function HealthPage({ onNoteOpen }: { onNoteOpen: (path: string) => void }) {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [issues, setIssues] = useState<LintIssue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [h, l] = await Promise.all([api.health(), api.lint()]);
        if (!cancelled) {
          setStats(h);
          setIssues(l.issues);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const scoreColor = (s: number) =>
    s >= 80 ? "var(--green, #2e7d32)" : s >= 50 ? "#b8860b" : "var(--red)";

  return (
    <div style={{ padding: "20px 16px", maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Workspace Health</h2>

      {loading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>}

      {stats && (
        <>
          <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor(stats.healthScore) }}>
              {stats.healthScore}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Health score / 100</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            <Stat label="Files indexed" value={stats.totalFiles} />
            <Stat label="Embedding chunks" value={stats.totalEmbeddings} />
            <Stat label="Graph nodes" value={stats.nodeCount} />
            <Stat label="Links" value={stats.linkCount} />
            <Stat label="Broken links" value={stats.brokenLinks} warn={stats.brokenLinks > 0} />
            <Stat label="Orphan pages" value={stats.orphans} warn={stats.orphans > 0} />
          </div>
        </>
      )}

      {issues && (
        <div>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>
            Lint issues {issues.length > 0 && <span style={{ color: "var(--text-dim)" }}>({issues.length})</span>}
          </h3>
          {issues.length === 0 && (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No issues found. 🎉</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {issues.slice(0, 200).map((iss, i) => (
              <button
                key={i}
                className="card secondary"
                onClick={() => onNoteOpen(iss.filePath)}
                style={{ textAlign: "left", width: "100%", display: "flex", gap: 8, alignItems: "baseline" }}
              >
                <span style={{ color: sevColor[iss.severity], fontSize: 11, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                  {iss.severity}
                </span>
                <span style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--text-dim)" }}>{iss.rule}</span> — {iss.message}
                  <br />
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {iss.filePath}{iss.line ? `:${iss.line}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: warn ? "var(--red)" : "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{label}</div>
    </div>
  );
}
