// ── AuthProvider abstraction (§3.2 of multi-surface-design.md) ──

export interface Principal {
  userId: string;
  displayName: string;
  source: "local" | "oa-dingtalk" | "oa-feishu" | "oa-wework" | "sso-oidc";
  roles: string[];
  tenantId?: string;
}

export type ValePermission =
  | "read"
  | "write"
  | "admin"
  | "tool:readonly"
  | "tool:write"
  | "tool:dangerous";

export interface AuthProvider {
  authenticate(req: IncomingRequest): Promise<Principal>;
  authorize(principal: Principal, perm: ValePermission): boolean;
}

// Minimal request interface — compatible with Node IncomingMessage and Hono Request
export interface IncomingRequest {
  headers: { get?(name: string): string | null; [name: string]: unknown };
}

export function getHeader(req: IncomingRequest, name: string): string | undefined {
  if (typeof req.headers.get === "function") {
    return req.headers.get(name) ?? undefined;
  }
  const h = req.headers as Record<string, string | string[] | undefined>;
  const val = h[name.toLowerCase()];
  return Array.isArray(val) ? val[0] : val;
}
