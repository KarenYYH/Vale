import React, { useState, useEffect } from "react";
import { hasToken, clearToken } from "./api.js";
import { LoginPage } from "./pages/Login.js";
import { SearchPage } from "./pages/Search.js";
import { NotePage } from "./pages/Note.js";

type Route =
  | { name: "login" }
  | { name: "search" }
  | { name: "note"; path: string };

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
