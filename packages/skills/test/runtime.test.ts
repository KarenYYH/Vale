import { describe, test, expect } from "vitest";
import type { InstalledSkill } from "@vale/shared";
import { executeSkill } from "../src/runtime.js";
import { makeManifest } from "./helpers.js";

function makeSkill(
  overrides: Partial<InstalledSkill> = {},
  manifestOverrides = {},
): InstalledSkill {
  return {
    manifest: makeManifest(manifestOverrides),
    installPath: "/tmp/example",
    installedAt: Date.now(),
    promptContent: null,
    enabled: true,
    ...overrides,
  };
}

describe("executeSkill — prompt-only mode", () => {
  test("returns prompt content as output with meta", async () => {
    const skill = makeSkill(
      { promptContent: "Do the thing." },
      { name: "ex", type: "prompt", executionMode: "prompt-only" },
    );

    const result = await executeSkill(skill, {}, "/workspace");

    expect(result.output).toBe("Do the thing.");
    expect(result.error).toBeUndefined();
    expect(result.meta).toEqual({
      skillName: "ex",
      skillType: "prompt",
      executionMode: "prompt-only",
    });
  });

  test("defaults to prompt-only when executionMode is unset", async () => {
    const skill = makeSkill(
      { promptContent: "Default mode body." },
      { name: "def" }, // no executionMode
    );

    const result = await executeSkill(skill, {}, "/workspace");

    expect(result.output).toBe("Default mode body.");
    expect(result.meta?.executionMode).toBe("prompt-only");
  });

  test("returns a friendly message when prompt content is absent", async () => {
    const skill = makeSkill(
      { promptContent: null },
      { displayName: "No Body Skill", executionMode: "prompt-only" },
    );

    const result = await executeSkill(skill, {}, "/workspace");

    expect(result.output).toContain('Skill "No Body Skill" has no prompt content.');
    expect(result.error).toBeUndefined();
    expect(result.meta).toBeUndefined();
  });
});

describe("executeSkill — unimplemented modes", () => {
  test("sandbox mode returns a not-implemented error", async () => {
    const skill = makeSkill({}, { executionMode: "sandbox" });

    const result = await executeSkill(skill, {}, "/workspace");

    expect(result.output).toBe("");
    expect(result.error).toContain("Sandbox execution not yet implemented");
  });

  test("native mode returns a not-implemented error", async () => {
    const skill = makeSkill({}, { executionMode: "native" });

    const result = await executeSkill(skill, {}, "/workspace");

    expect(result.output).toBe("");
    expect(result.error).toContain("Native execution not yet implemented");
  });

  test("unknown execution mode returns an error naming the mode", async () => {
    const skill = makeSkill({}, {});
    // @ts-expect-error — force an out-of-spec mode to hit the default branch
    skill.manifest.executionMode = "bogus";

    const result = await executeSkill(skill, {}, "/workspace");

    expect(result.output).toBe("");
    expect(result.error).toContain("Unknown execution mode: bogus");
  });
});
