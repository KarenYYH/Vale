import { describe, test, expect } from "vitest";
import { buildAgentEnv } from "../src/spawn.js";

// I1: the spawned CLI must only receive the API-key env var for its own
// provider. Injecting the same key into BOTH ANTHROPIC_API_KEY and
// OPENAI_API_KEY leaks (e.g.) an OpenAI key into a Claude process and vice
// versa.

describe("buildAgentEnv (I1)", () => {
  test("claude only gets ANTHROPIC_API_KEY", () => {
    const env = buildAgentEnv("claude", "sk-ant-123", {});
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-123");
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  test("codex only gets OPENAI_API_KEY", () => {
    const env = buildAgentEnv("codex", "sk-oai-456", {});
    expect(env.OPENAI_API_KEY).toBe("sk-oai-456");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test("does not clobber an existing unrelated key in the base env", () => {
    const env = buildAgentEnv("claude", "sk-ant-123", {
      OPENAI_API_KEY: "pre-existing",
    });
    // We must not propagate a foreign provider key into the claude process.
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-123");
  });

  test("preserves other base env entries (e.g. PATH)", () => {
    const env = buildAgentEnv("claude", "sk-ant-123", { PATH: "/usr/bin" });
    expect(env.PATH).toBe("/usr/bin");
  });
});
