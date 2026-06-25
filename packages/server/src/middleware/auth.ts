import type { Context, Next } from "hono";
import { LocalAuthProvider, AuthError } from "@vale/auth";
import type { Principal, ValePermission } from "@vale/auth";

declare module "hono" {
  interface ContextVariableMap {
    principal: Principal;
    auth: LocalAuthProvider;
  }
}

/**
 * Hono middleware: verify Bearer JWT, inject principal into context.
 * Requires ctx.get('auth') to be set upstream by mountAuth().
 */
export async function requireAuth(ctx: Context, next: Next): Promise<Response | void> {
  const auth = ctx.get("auth");
  try {
    const principal = await auth.authenticate({
      headers: { get: (name: string) => ctx.req.header(name) ?? null },
    });
    ctx.set("principal", principal);
    await next();
  } catch (e) {
    if (e instanceof AuthError) {
      return ctx.json({ error: e.message }, e.status as 401 | 403);
    }
    throw e;
  }
}

/** Inject the auth provider into every request. */
export function mountAuth(auth: LocalAuthProvider) {
  return async (ctx: Context, next: Next) => {
    ctx.set("auth", auth);
    await next();
  };
}

/**
 * Hono middleware: enforce that the authenticated principal holds `perm` (C1).
 * Must run after requireAuth (which sets `principal`). Returns 403 when the
 * principal lacks the permission, 401 if somehow unauthenticated.
 */
export function requirePerm(perm: ValePermission) {
  return async (ctx: Context, next: Next): Promise<Response | void> => {
    const auth = ctx.get("auth");
    const principal = ctx.get("principal");
    if (!principal) {
      return ctx.json({ error: "Unauthenticated" }, 401);
    }
    if (!auth.authorize(principal, perm)) {
      return ctx.json({ error: `Forbidden: requires '${perm}' permission` }, 403);
    }
    await next();
  };
}
