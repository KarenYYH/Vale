import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SKILLS_DIR } from "@vale/shared";
import { makeListSkillsTool } from "../src/tools/list-skills.js";
import { makeRunSkillTool } from "../src/tools/run-skill.js";

// list_skills / run_skill must be wired to the real @vale/skills package
// (load from <ws>/.vale/skills), not return the old "[]" / "not found" stubs.

let ws: string;
const ctx = () => ({ workspacePath: ws } as never);

async function writeSkill(name: string, prompt?: string) {
  const dir = join(ws, SKILLS_DIR, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "skill.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      type: "prompt",
      displayName: name,
      description: `${name} description`,
      author: { name: "T" },
      license: "MIT",
      price: "free",
      engines: { vale: "*" },
      permissions: [],
    }),
    "utf-8",
  );
  if (prompt !== undefined) {
    await mkdir(join(dir, "prompts"), { recursive: true });
    await writeFile(join(dir, "prompts", "system.md"), prompt, "utf-8");
  }
}

beforeEach(async () => {
  ws = await mkdtemp(join(tmpdir(), "vale-skilltools-"));
  await mkdir(join(ws, ".vale"), { recursive: true });
});

afterEach(async () => {
  await rm(ws, { recursive: true, force: true });
});

describe("list_skills wired to @vale/skills", () => {
  test("reports no skills on an empty workspace", async () => {
    const tool = makeListSkillsTool(ctx());
    const res = await tool.handler({}, ctx());
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toMatch(/no skills/i);
  });

  test("lists an installed skill by name", async () => {
    await writeSkill("pdf-ingest", "Do PDF things.");
    const tool = makeListSkillsTool(ctx());
    const res = await tool.handler({}, ctx());
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("pdf-ingest");
  });
});

describe("run_skill wired to @vale/skills", () => {
  test("executes a prompt skill and returns its prompt content", async () => {
    await writeSkill("summarize", "You are a summarizer. Be concise.");
    const tool = makeRunSkillTool(ctx());
    const res = await tool.handler({ name: "summarize", input: {} }, ctx());
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("summarizer");
  });

  test("returns an error for a skill that does not exist", async () => {
    const tool = makeRunSkillTool(ctx());
    const res = await tool.handler({ name: "nonexistent", input: {} }, ctx());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/not found|nonexistent/i);
  });
});
