import React, { useState, useEffect } from "react";
import { hasToken, clearToken } from "./api.js";
import { LoginPage } from "./pages/Login.js";
import { SearchPage } from "./pages/Search.js";
import { NotePage } from "./pages/Note.js";
import { GraphPage } from "./pages/Graph.js";
import { HealthPage } from "./pages/Health.js";
import { SkillsPage } from "./pages/Skills.js";

type Route =
  | { name: "login" }
  | { name: "search" }
  | { name: "graph" }
  | { name: "health" }
  | { name: "skills" }
  | { name: "note"; path: string };

const TABS: Array<{ name: Route["name"]; label: string }> = [
  { name: "search", label: "Search" },
  { name: "graph", label: "Graph" },
  { name: "health", label: "Health" },
  { name: "skills", label: "Skills" },
];

export function App() {
  const [route, setRoute] = useState<Route>(
    hasToken() ? { name: "search" } : { name: "login" },
  );

  useEffect(() => {
    const handler = () => {
      if (!hasToken()) setRoute({ name: "login" });
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (route.name === "login") {
    return (
      <LoginPage onLogin={() => setRoute({ name: "search" })} />
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "0 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 52, flexShrink: 0,
      }}>
        <button
          className="secondary"
          onClick={() => setRoute({ name: "search" })}
          style={{ fontWeight: 700, fontSize: 16, padding: "6px 10px", border: "none", background: "none", color: "var(--text)" }}
        >
          🗂️ Vale
        </button>
        <nav style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.name}
              className={route.name === t.name ? "" : "secondary"}
              onClick={() => setRoute({ name: t.name } as Route)}
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          className="secondary"
          onClick={() => { clearToken(); setRoute({ name: "login" }); }}
          style={{ fontSize: 12, padding: "6px 12px" }}
        >
          Sign out
        </button>
      </header>

      <main style={{ flex: 1, overflowY: "auto" }}>
        {route.name === "search" && (
          <SearchPage onNoteOpen={(path) => setRoute({ name: "note", path })} />
        )}
        {route.name === "graph" && (
          <GraphPage onNoteOpen={(path) => setRoute({ name: "note", path })} />
        )}
        {route.name === "health" && (
          <HealthPage onNoteOpen={(path) => setRoute({ name: "note", path })} />
        )}
        {route.name === "skills" && <SkillsPage />}
        {route.name === "note" && (
          <NotePage
            path={route.path}
            onBack={() => setRoute({ name: "search" })}
          />
        )}
      </main>
    </div>
  );
}
