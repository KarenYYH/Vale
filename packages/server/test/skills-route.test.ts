import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalAuthProvider } from "@vale/auth";
import { loadConfig, SKILLS_DIR } from "@vale/shared";
import { createApp } from "../src/app.js";
import type { Hono } from "hono";

// The web dashboard's Skills page depends on GET /api/skills. Verify the route
// is mounted, auth-gated, and returns skills loaded from <ws>/.vale/skills.

let ws: string;
let app: Hono;
let token: string;
const SECRET = "test-secret-key-at-least-32-chars-long!!";

beforeAll(async () => {
  ws = await mkdtemp(join(tmpdir(), "vale-skillsroute-"));
  await mkdir(join(ws, ".vale"), { recursive: true });
  // Install one skill on disk.
  const skillDir = join(ws, SKILLS_DIR, "summarize");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, "skill.json"),
    JSON.stringify({
      name: "summarize", version: "1.0.0", type: "prompt",
      displayName: "Summarize", description: "Summarize notes",
      author: { name: "T" }, license: "MIT", price: "free",
      engines: { vale: "*" }, permissions: [],
    }),
    "utf-8",
  );

  const config = await loadConfig(ws);
  const auth = new LocalAuthProvider({ jwtSecret: SECRET, workspacePath: ws });
  app = createApp({ workspacePath: ws, config, auth });
  token = await auth.signToken({ sub: "u", displayName: "u", roles: ["viewer"] });
});

afterAll(async () => {
  await rm(ws, { recursive: true, force: true });
});

describe("GET /api/skills", () => {
  test("requires authentication", async () => {
    const res = await app.request("http://localhost/api/skills");
    expect(res.status).toBe(401);
  });

  test("returns installed skills for an authed reader", async () => {
    const res = await app.request("http://localhost/api/skills", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { skills: Array<{ name: string }> };
    expect(body.skills.some((s) => s.name === "summarize")).toBe(true);
  });
});
