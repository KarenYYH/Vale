import { describe, test, expect } from "vitest";
import { resolveJwtSecret, resolveCorsOrigin } from "../src/security.js";

// ── C2: JWT secret must fail closed in production ──

describe("resolveJwtSecret", () => {
  test("throws in production when no secret is provided", () => {
    expect(() =>
      resolveJwtSecret({ envSecret: undefined, configSecret: undefined, isDev: false }),
    ).toThrow(/secret/i);
  });

  test("throws in production when secret is the well-known placeholder", () => {
    expect(() =>
      resolveJwtSecret({
        envSecret: undefined,
        configSecret: "change-me-in-production",
        isDev: false,
      }),
    ).toThrow(/placeholder|change-me/i);
  });

  test("throws in production when secret is too short to be safe", () => {
    expect(() =>
      resolveJwtSecret({ envSecret: "short", configSecret: undefined, isDev: false }),
    ).toThrow(/short|length|32/i);
  });

  test("accepts a strong secret in production", () => {
    const strong = "a".repeat(32);
    expect(
      resolveJwtSecret({ envSecret: strong, configSecret: undefined, isDev: false }),
    ).toBe(strong);
  });

  test("env secret takes precedence over config secret", () => {
    const envStrong = "e".repeat(40);
    const cfgStrong = "c".repeat(40);
    expect(
      resolveJwtSecret({ envSecret: envStrong, configSecret: cfgStrong, isDev: false }),
    ).toBe(envStrong);
  });

  test("in dev, generates a usable ephemeral secret when none provided", () => {
    const secret = resolveJwtSecret({
      envSecret: undefined,
      configSecret: undefined,
      isDev: true,
    });
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(secret).not.toBe("change-me-in-production");
  });
});

// ── C3: CORS must never be a wildcard ──

describe("resolveCorsOrigin", () => {
  test("never returns wildcard, even with no configuration", () => {
    const origin = resolveCorsOrigin({ envOrigins: undefined });
    expect(origin).not.toBe("*");
  });

  test("defaults to localhost dev origins when nothing configured", () => {
    const origin = resolveCorsOrigin({ envOrigins: undefined });
    const list = Array.isArray(origin) ? origin : [origin];
    expect(list.some((o) => o.includes("localhost") || o.includes("127.0.0.1"))).toBe(true);
  });

  test("parses a comma-separated env allow-list", () => {
    const origin = resolveCorsOrigin({
      envOrigins: "https://a.example.com, https://b.example.com",
    });
    expect(origin).toEqual(["https://a.example.com", "https://b.example.com"]);
  });
});
