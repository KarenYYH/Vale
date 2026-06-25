import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalAuthProvider, AuthError } from "../src/index.js";

// I5: refreshToken must re-validate the user against current state — a token
// for a deleted user must not be refreshable, and refreshed tokens must carry
// the user's CURRENT roles (not the stale roles baked into the old token).

let workspacePath: string;
const SECRET = "test-secret-key-at-least-32-chars-long!!";

beforeEach(async () => {
  workspacePath = await mkdtemp(join(tmpdir(), "vale-auth-"));
});

afterEach(async () => {
  await rm(workspacePath, { recursive: true, force: true });
});

function provider() {
  return new LocalAuthProvider({ jwtSecret: SECRET, workspacePath });
}

describe("refreshToken user re-validation (I5)", () => {
  test("refreshes a token for an existing user", async () => {
    const auth = provider();
    await auth.createUser({ userId: "alice", displayName: "Alice", password: "pw1", roles: ["editor"] });
    const token = await auth.login("alice", "pw1");
    const refreshed = await auth.refreshToken(token);
    const principal = await auth.authenticate({
      headers: { get: (n: string) => (n.toLowerCase() === "authorization" ? `Bearer ${refreshed}` : null) },
    });
    expect(principal.userId).toBe("alice");
  });

  test("rejects refresh for a user that no longer exists", async () => {
    const auth = provider();
    await auth.createUser({ userId: "bob", displayName: "Bob", password: "pw1", roles: ["viewer"] });
    const token = await auth.login("bob", "pw1");

    // Simulate user deletion by writing an empty users store.
    const fresh = provider();
    // Directly remove the user via a new store with no users:
    await rm(join(workspacePath, ".vale", "users.json"), { force: true });

    await expect(fresh.refreshToken(token)).rejects.toBeInstanceOf(AuthError);
  });

  test("refreshed token reflects CURRENT roles, not stale token roles", async () => {
    const auth = provider();
    await auth.createUser({ userId: "carol", displayName: "Carol", password: "pw1", roles: ["admin"] });
    const adminToken = await auth.login("carol", "pw1");

    // Demote carol to viewer by recreating the store.
    const demoter = provider();
    // Overwrite by deleting + recreating with viewer role.
    await rm(join(workspacePath, ".vale", "users.json"), { force: true });
    await demoter.createUser({ userId: "carol", displayName: "Carol", password: "pw2", roles: ["viewer"] });

    const refreshed = await demoter.refreshToken(adminToken);
    const principal = await demoter.authenticate({
      headers: { get: (n: string) => (n.toLowerCase() === "authorization" ? `Bearer ${refreshed}` : null) },
    });
    expect(principal.roles).toEqual(["viewer"]);
    expect(principal.roles).not.toContain("admin");
  });
});
