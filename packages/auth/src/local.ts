import { SignJWT, jwtVerify } from "jose";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import type { AuthProvider, Principal, ValePermission, IncomingRequest } from "./types.js";
import { getHeader } from "./types.js";

const { hash, compare } = bcrypt;
const BCRYPT_ROUNDS = 10;

interface UserRecord {
  userId: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  tenantId?: string;
}

interface UsersStore {
  users: UserRecord[];
}

export class LocalAuthProvider implements AuthProvider {
  private readonly secret: Uint8Array;
  private readonly sessionTtl: string;
  private readonly usersFile: string;

  constructor(opts: {
    jwtSecret: string;
    sessionTtl?: string;
    workspacePath: string;
  }) {
    this.secret = new TextEncoder().encode(opts.jwtSecret);
    this.sessionTtl = opts.sessionTtl ?? "7d";
    this.usersFile = join(opts.workspacePath, ".vale", "users.json");
  }

  // ── JWT helpers ──

  async signToken(payload: Record<string, unknown>): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(this.sessionTtl)
      .sign(this.secret);
  }

  async verifyToken(token: string): Promise<Record<string, unknown> | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret);
      return payload as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // ── AuthProvider interface ──

  async authenticate(req: IncomingRequest): Promise<Principal> {
    const header = getHeader(req, "authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new AuthError(401, "Missing or invalid Authorization header");
    }
    const payload = await this.verifyToken(header.slice(7));
    if (!payload) {
      throw new AuthError(401, "Invalid or expired token");
    }
    return {
      userId: payload.sub as string,
      displayName: (payload.displayName as string) ?? payload.sub as string,
      source: "local",
      roles: (payload.roles as string[]) ?? ["viewer"],
      tenantId: payload.tenantId as string | undefined,
    };
  }

  authorize(principal: Principal, perm: ValePermission): boolean {
    const { roles } = principal;
    switch (perm) {
      case "read":
      case "tool:readonly":
        return roles.some((r) => ["viewer", "editor", "admin"].includes(r));
      case "write":
      case "tool:write":
        return roles.some((r) => ["editor", "admin"].includes(r));
      case "tool:dangerous":
      case "admin":
        return roles.includes("admin");
      default:
        return false;
    }
  }

  // ── Login ──

  async login(username: string, password: string): Promise<string> {
    const store = await this.loadUsers();
    const user = store.users.find((u) => u.userId === username);
    if (!user) throw new AuthError(401, "Invalid credentials");

    const valid = await compare(password, user.passwordHash);
    if (!valid) throw new AuthError(401, "Invalid credentials");

    return this.signToken({
      sub: user.userId,
      displayName: user.displayName,
      roles: user.roles,
      tenantId: user.tenantId,
    });
  }

  async refreshToken(token: string): Promise<string> {
    const payload = await this.verifyToken(token);
    if (!payload) throw new AuthError(401, "Invalid or expired token");

    // Re-validate against current state (I5): the user must still exist, and
    // the refreshed token must carry the user's CURRENT roles/displayName —
    // not the (possibly stale) claims baked into the old token.
    const userId = payload.sub as string | undefined;
    if (!userId) throw new AuthError(401, "Invalid token: missing subject");

    const store = await this.loadUsers();
    const user = store.users.find((u) => u.userId === userId);
    if (!user) throw new AuthError(401, "User no longer exists");

    return this.signToken({
      sub: user.userId,
      displayName: user.displayName,
      roles: user.roles,
      tenantId: user.tenantId,
    });
  }

  // ── User management ──

  async createUser(opts: {
    userId: string;
    displayName: string;
    password: string;
    roles?: string[];
    tenantId?: string;
  }): Promise<void> {
    const store = await this.loadUsers();
    if (store.users.find((u) => u.userId === opts.userId)) {
      throw new AuthError(409, `User '${opts.userId}' already exists`);
    }
    const passwordHash = await hash(opts.password, BCRYPT_ROUNDS);
    store.users.push({
      userId: opts.userId,
      displayName: opts.displayName,
      passwordHash,
      roles: opts.roles ?? ["viewer"],
      tenantId: opts.tenantId,
    });
    await this.saveUsers(store);
  }

  /** List users without exposing password hashes. */
  async listUsers(): Promise<Array<Omit<UserRecord, "passwordHash">>> {
    const store = await this.loadUsers();
    return store.users.map(({ passwordHash: _ph, ...rest }) => rest);
  }

  // ── Storage ──

  private async loadUsers(): Promise<UsersStore> {
    try {
      const raw = await readFile(this.usersFile, "utf-8");
      return JSON.parse(raw) as UsersStore;
    } catch {
      return { users: [] };
    }
  }

  private async saveUsers(store: UsersStore): Promise<void> {
    await mkdir(join(this.usersFile, ".."), { recursive: true });
    await writeFile(this.usersFile, JSON.stringify(store, null, 2), "utf-8");
  }
}

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
