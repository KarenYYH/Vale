import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalAuthProvider } from "@vale/auth";
import { loadConfig } from "@vale/shared";
import { createApp } from "../src/app.js";
import type { Hono } from "hono";

// C1: RBAC must actually be enforced — a viewer token must NOT be able to
// perform write operations (PUT /api/notes, POST /api/ingest), and read
// operations must require at least the `read` permission.

let workspacePath: string;
let app: Hono;
let viewerToken: string;
let editorToken: string;

const JWT_SECRET = "test-secret-key-at-least-32-chars-long!!";

async function mkToken(auth: LocalAuthProvider, userId: string, roles: string[]) {
  // Sign directly via the provider's token helper so we control roles.
  return auth.signToken({ sub: userId, displayName: userId, roles });
}

beforeAll(async () => {
  workspacePath = await mkdtemp(join(tmpdir(), "vale-rbac-"));
  const config = await loadConfig(workspacePath);
  const auth = new LocalAuthProvider({ jwtSecret: JWT_SECRET, workspacePath });
  app = createApp({ workspacePath, config, auth });
  viewerToken = await mkToken(auth, "viewer-user", ["viewer"]);
  editorToken = await mkToken(auth, "editor-user", ["editor"]);
});

afterAll(async () => {
  await rm(workspacePath, { recursive: true, force: true });
});

function req(path: string, init: RequestInit = {}) {
  return app.request(`http://localhost${path}`, init);
}

describe("RBAC enforcement", () => {
  test("unauthenticated write is rejected (401)", async () => {
    const res = await req("/api/notes/foo.md", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
    expect(res.status).toBe(401);
  });

  test("viewer CANNOT write a note (403 forbidden)", async () => {
    const res = await req("/api/notes/foo.md", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ content: "hi" }),
    });
    expect(res.status).toBe(403);
  });

  test("viewer CANNOT trigger ingest (403 forbidden)", async () => {
    const res = await req("/api/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ path: "raw/" }),
    });
    expect(res.status).toBe(403);
  });

  test("viewer CAN read (search) — not forbidden", async () => {
    const res = await req("/api/search?q=test", {
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    // Read is permitted for viewer: must not be 401/403.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  test("editor CAN write — passes the authorization gate (not 403)", async () => {
    const res = await req("/api/notes/note.md", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${editorToken}`,
      },
      body: JSON.stringify({ content: "# Hello" }),
    });
    // Editor is authorized; the write itself should succeed in a temp workspace.
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  test("health endpoint stays public (no auth required)", async () => {
    const res = await req("/api/health");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
