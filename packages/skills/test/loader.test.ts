import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VALE_DIR, SKILLS_DIR } from "@vale/shared";
import { loadSkillFromPath, loadAllSkills } from "../src/loader.js";
import { makeManifest, writeSkill } from "./helpers.js";

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "vale-skills-loader-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("loadSkillFromPath", () => {
  test("loads a valid skill with manifest and prompt", async () => {
    const skillDir = await writeSkill(
      tmp,
      "good",
      makeManifest({ name: "good", displayName: "Good Skill" }),
      "You are a helpful skill.",
    );

    const skill = await loadSkillFromPath(skillDir);

    expect(skill).not.toBeNull();
    expect(skill!.manifest.name).toBe("good");
    expect(skill!.manifest.displayName).toBe("Good Skill");
    expect(skill!.promptContent).toBe("You are a helpful skill.");
    expect(skill!.installPath).toBe(skillDir);
    expect(skill!.enabled).toBe(true);
    expect(typeof skill!.installedAt).toBe("number");
  });

  test("prompt is optional — promptContent is null when missing", async () => {
    const skillDir = await writeSkill(
      tmp,
      "noprompt",
      makeManifest({ name: "noprompt" }),
      // no prompt
    );

    const skill = await loadSkillFromPath(skillDir);

    expect(skill).not.toBeNull();
    expect(skill!.promptContent).toBeNull();
  });

  test("returns null when skill.json is missing", async () => {
    const skillDir = join(tmp, "empty");
    await mkdir(skillDir, { recursive: true });

    const skill = await loadSkillFromPath(skillDir);

    expect(skill).toBeNull();
  });

  test("returns null when skill.json is malformed JSON", async () => {
    const skillDir = join(tmp, "broken");
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "skill.json"), "{ not valid json", "utf-8");

    const skill = await loadSkillFromPath(skillDir);

    expect(skill).toBeNull();
  });

  test("returns null when manifest is missing required `name`", async () => {
    const manifest = makeManifest();
    // @ts-expect-error — intentionally delete a required field
    delete manifest.name;
    const skillDir = await writeSkill(tmp, "noname", manifest);

    const skill = await loadSkillFromPath(skillDir);

    expect(skill).toBeNull();
  });

  test("returns null when manifest is missing required `version`", async () => {
    const manifest = makeManifest();
    // @ts-expect-error — intentionally delete a required field
    delete manifest.version;
    const skillDir = await writeSkill(tmp, "noversion", manifest);

    const skill = await loadSkillFromPath(skillDir);

    expect(skill).toBeNull();
  });

  test("returns null when manifest is missing required `type`", async () => {
    const manifest = makeManifest();
    // @ts-expect-error — intentionally delete a required field
    delete manifest.type;
    const skillDir = await writeSkill(tmp, "notype", manifest);

    const skill = await loadSkillFromPath(skillDir);

    expect(skill).toBeNull();
  });

  test("returns null for a nonexistent path", async () => {
    const skill = await loadSkillFromPath(join(tmp, "does-not-exist"));
    expect(skill).toBeNull();
  });
});

describe("loadAllSkills", () => {
  test("returns empty array when workspace has no skills dir", async () => {
    const skills = await loadAllSkills(tmp);
    expect(skills).toEqual([]);
  });

  test("loads skills from the workspace .vale/skills directory", async () => {
    const wsSkillsDir = join(tmp, SKILLS_DIR);
    await mkdir(wsSkillsDir, { recursive: true });
    await writeSkill(wsSkillsDir, "alpha", makeManifest({ name: "alpha" }));
    await writeSkill(wsSkillsDir, "beta", makeManifest({ name: "beta" }));

    const skills = await loadAllSkills(tmp);

    const names = skills.map((s) => s.manifest.name).sort();
    expect(names).toEqual(["alpha", "beta"]);
  });

  test("uses SKILLS_DIR constant path layout", async () => {
    // SKILLS_DIR is ".vale/skills"; loadAllSkills joins workspace + SKILLS_DIR.
    expect(SKILLS_DIR).toBe(`${VALE_DIR}/skills`);
  });

  test("loads built-in skills from appSkillsPath", async () => {
    const appDir = join(tmp, "builtin");
    await mkdir(appDir, { recursive: true });
    await writeSkill(appDir, "core", makeManifest({ name: "core" }));

    const skills = await loadAllSkills(tmp, appDir);

    expect(skills.map((s) => s.manifest.name)).toContain("core");
  });

  test("workspace skill overrides built-in with the same name", async () => {
    const appDir = join(tmp, "builtin");
    await mkdir(appDir, { recursive: true });
    await writeSkill(
      appDir,
      "shared",
      makeManifest({ name: "shared", version: "1.0.0" }),
    );

    const wsSkillsDir = join(tmp, SKILLS_DIR);
    await mkdir(wsSkillsDir, { recursive: true });
    await writeSkill(
      wsSkillsDir,
      "shared",
      makeManifest({ name: "shared", version: "2.0.0" }),
    );

    const skills = await loadAllSkills(tmp, appDir);
    const shared = skills.filter((s) => s.manifest.name === "shared");

    expect(shared).toHaveLength(1);
    expect(shared[0].manifest.version).toBe("2.0.0");
  });

  test("merges built-in and workspace skills with distinct names", async () => {
    const appDir = join(tmp, "builtin");
    await mkdir(appDir, { recursive: true });
    await writeSkill(appDir, "builtin-only", makeManifest({ name: "builtin-only" }));

    const wsSkillsDir = join(tmp, SKILLS_DIR);
    await mkdir(wsSkillsDir, { recursive: true });
    await writeSkill(wsSkillsDir, "ws-only", makeManifest({ name: "ws-only" }));

    const skills = await loadAllSkills(tmp, appDir);
    const names = skills.map((s) => s.manifest.name).sort();

    expect(names).toEqual(["builtin-only", "ws-only"]);
  });

  test("skips dotfile-prefixed directories", async () => {
    const wsSkillsDir = join(tmp, SKILLS_DIR);
    await mkdir(wsSkillsDir, { recursive: true });
    await writeSkill(wsSkillsDir, "visible", makeManifest({ name: "visible" }));
    await writeSkill(wsSkillsDir, ".hidden", makeManifest({ name: "hidden" }));

    const skills = await loadAllSkills(tmp);
    const names = skills.map((s) => s.manifest.name);

    expect(names).toContain("visible");
    expect(names).not.toContain("hidden");
  });

  test("filters out invalid skill directories (null entries dropped from map)", async () => {
    const wsSkillsDir = join(tmp, SKILLS_DIR);
    await mkdir(wsSkillsDir, { recursive: true });
    await writeSkill(wsSkillsDir, "valid", makeManifest({ name: "valid" }));
    // a directory with broken manifest -> loadSkillFromPath returns null
    const brokenDir = join(wsSkillsDir, "broken");
    await mkdir(brokenDir, { recursive: true });
    await writeFile(join(brokenDir, "skill.json"), "nope", "utf-8");

    const skills = await loadAllSkills(tmp);

    // Note: null entries are still set into the map under key `undefined`
    // because the code does `if (skill) skillMap.set(...)` — invalid skills
    // are guarded by the `if (skill)` check, so only "valid" survives.
    expect(skills.map((s) => s.manifest.name)).toEqual(["valid"]);
  });
});
