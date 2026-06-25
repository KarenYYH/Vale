import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VALE_DIR, SKILLS_DIR } from "@vale/shared";
import {
  initSkills,
  getInstalledSkills,
  findSkill,
  getSkillDirectoryText,
  getSkillPromptText,
  getAllTriggers,
} from "../src/registry.js";
import { makeManifest, writeSkill } from "./helpers.js";

let tmp: string;
let wsSkillsDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "vale-skills-registry-"));
  // loadAllSkills resolves workspace skills at <ws>/.vale/skills (SKILLS_DIR
  // already includes the ".vale" prefix).
  wsSkillsDir = join(tmp, SKILLS_DIR);
  await mkdir(wsSkillsDir, { recursive: true });
});

afterEach(async () => {
  // Reset module-level state so tests do not leak into each other.
  await initSkills(join(tmpdir(), "vale-empty-nonexistent-workspace-xyz"));
  await rm(tmp, { recursive: true, force: true });
});

describe("getInstalledSkills", () => {
  test("returns empty array before any skills are loaded", async () => {
    await initSkills(tmp); // empty skills dir
    expect(getInstalledSkills()).toEqual([]);
  });

  test("returns all loaded skills", async () => {
    await writeSkill(wsSkillsDir, "a", makeManifest({ name: "a", type: "prompt" }));
    await writeSkill(wsSkillsDir, "b", makeManifest({ name: "b", type: "query" }));
    await initSkills(tmp);

    const all = getInstalledSkills();
    expect(all.map((s) => s.manifest.name).sort()).toEqual(["a", "b"]);
  });

  test("filters by skill type", async () => {
    await writeSkill(wsSkillsDir, "p1", makeManifest({ name: "p1", type: "prompt" }));
    await writeSkill(wsSkillsDir, "p2", makeManifest({ name: "p2", type: "prompt" }));
    await writeSkill(wsSkillsDir, "q1", makeManifest({ name: "q1", type: "query" }));
    await initSkills(tmp);

    const prompts = getInstalledSkills("prompt");
    expect(prompts.map((s) => s.manifest.name).sort()).toEqual(["p1", "p2"]);

    const queries = getInstalledSkills("query");
    expect(queries.map((s) => s.manifest.name)).toEqual(["q1"]);
  });

  test("returns a copy, not the internal array", async () => {
    await writeSkill(wsSkillsDir, "a", makeManifest({ name: "a" }));
    await initSkills(tmp);

    const first = getInstalledSkills();
    first.push({} as never);
    const second = getInstalledSkills();
    expect(second).toHaveLength(1);
  });
});

describe("findSkill", () => {
  test("finds a skill by name", async () => {
    await writeSkill(wsSkillsDir, "target", makeManifest({ name: "target" }));
    await initSkills(tmp);

    const found = findSkill("target");
    expect(found).toBeDefined();
    expect(found!.manifest.name).toBe("target");
  });

  test("returns undefined for an unknown name", async () => {
    await writeSkill(wsSkillsDir, "exists", makeManifest({ name: "exists" }));
    await initSkills(tmp);

    expect(findSkill("nope")).toBeUndefined();
  });
});

describe("getSkillDirectoryText", () => {
  test("returns empty string when no skills are enabled", async () => {
    await initSkills(tmp);
    expect(getSkillDirectoryText()).toBe("");
  });

  test("formats each skill as a bullet with name, type, and description", async () => {
    await writeSkill(
      wsSkillsDir,
      "fmt",
      makeManifest({
        name: "fmt",
        type: "lint",
        description: "Lints things.",
      }),
    );
    await initSkills(tmp);

    const text = getSkillDirectoryText();
    expect(text).toContain("- **fmt** (lint): Lints things.");
  });

  test("includes triggers line when triggers are present", async () => {
    await writeSkill(
      wsSkillsDir,
      "trig",
      makeManifest({
        name: "trig",
        description: "Has triggers.",
        triggers: ["do thing", "make widget"],
      }),
    );
    await initSkills(tmp);

    const text = getSkillDirectoryText();
    expect(text).toContain("Triggers: do thing, make widget");
  });

  test("omits triggers line when there are no triggers", async () => {
    await writeSkill(
      wsSkillsDir,
      "notrig",
      makeManifest({ name: "notrig", description: "No triggers." }),
    );
    await initSkills(tmp);

    const text = getSkillDirectoryText();
    expect(text).not.toContain("Triggers:");
  });
});

describe("getSkillPromptText", () => {
  test("returns empty string when no skills have prompt content", async () => {
    await writeSkill(wsSkillsDir, "noprompt", makeManifest({ name: "noprompt" }));
    await initSkills(tmp);

    expect(getSkillPromptText()).toBe("");
  });

  test("concatenates prompt content with displayName headers", async () => {
    await writeSkill(
      wsSkillsDir,
      "withprompt",
      makeManifest({ name: "withprompt", displayName: "With Prompt" }),
      "Prompt body here.",
    );
    await initSkills(tmp);

    const text = getSkillPromptText();
    expect(text).toContain("## Skill: With Prompt");
    expect(text).toContain("Prompt body here.");
  });

  test("joins multiple prompt skills with a separator", async () => {
    await writeSkill(
      wsSkillsDir,
      "one",
      makeManifest({ name: "one", displayName: "One" }),
      "Body one.",
    );
    await writeSkill(
      wsSkillsDir,
      "two",
      makeManifest({ name: "two", displayName: "Two" }),
      "Body two.",
    );
    await initSkills(tmp);

    const text = getSkillPromptText();
    expect(text).toContain("---");
    expect(text).toContain("Body one.");
    expect(text).toContain("Body two.");
  });
});

describe("getAllTriggers", () => {
  test("returns empty array when no skills have triggers", async () => {
    await writeSkill(wsSkillsDir, "plain", makeManifest({ name: "plain" }));
    await initSkills(tmp);

    expect(getAllTriggers()).toEqual([]);
  });

  test("flattens triggers across skills with skillName references", async () => {
    await writeSkill(
      wsSkillsDir,
      "s1",
      makeManifest({ name: "s1", triggers: ["t1", "t2"] }),
    );
    await writeSkill(
      wsSkillsDir,
      "s2",
      makeManifest({ name: "s2", triggers: ["t3"] }),
    );
    await initSkills(tmp);

    const triggers = getAllTriggers();
    expect(triggers).toHaveLength(3);
    expect(triggers).toContainEqual({ skillName: "s1", trigger: "t1" });
    expect(triggers).toContainEqual({ skillName: "s1", trigger: "t2" });
    expect(triggers).toContainEqual({ skillName: "s2", trigger: "t3" });
  });
});
