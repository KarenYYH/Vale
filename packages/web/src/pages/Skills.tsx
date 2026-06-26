import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import type { SkillInfo } from "../api.js";

const typeBadge: Record<string, string> = {
  prompt: "badge-purple",
  ingest: "badge-green",
  query: "badge-green",
  lint: "badge-yellow",
};

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.skills();
        if (!cancelled) setSkills(res.skills);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: "20px 16px", maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Skills</h2>

      {loading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>}

      {skills && skills.length === 0 && (
        <div className="card">
          <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
            No skills installed. Add skills under <code>.vale/skills/</code> or browse the
            marketplace at <a href="https://skills.vale.sh" target="_blank" rel="noreferrer">skills.vale.sh</a>.
          </p>
        </div>
      )}

      {skills && skills.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {skills.map((s) => (
            <div key={s.name} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  {s.displayName ?? s.name}
                  {!s.enabled && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}> (disabled)</span>}
                </span>
                <span className={`badge ${typeBadge[s.type] ?? "badge-yellow"}`}>{s.type}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>{s.description}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 12, color: "var(--text-dim)", flexWrap: "wrap" }}>
                <span>v{s.version}</span>
                {s.triggers.length > 0 && <span>· triggers: {s.triggers.join(", ")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
