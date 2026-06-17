import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export function NotePage({ path, onBack }: { path: string; onBack: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.note(path)
      .then((d) => { if (!cancelled) setContent(d.content); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div style={{ padding: "16px", maxWidth: 720, margin: "0 auto" }}>
      <button className="secondary" onClick={onBack} style={{ marginBottom: 16, fontSize: 13 }}>
        ← Back
      </button>
      <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>{path}</p>
      {error && <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>}
      {content === null && !error && (
        <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Loading…</p>
      )}
      {content !== null && (
        <pre style={{
          whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14,
          lineHeight: 1.7, fontFamily: "var(--font)", color: "var(--text)",
        }}>
          {content}
        </pre>
      )}
    </div>
  );
}
