import { Hono } from "hono";
import { LocalAuthProvider } from "@vale/auth";

export function makeAuthRoutes(auth: LocalAuthProvider) {
  const app = new Hono();

  // POST /api/auth/login  { username, password } → { token }
  app.post("/login", async (ctx) => {
    const body = await ctx.req.json<{ username?: string; password?: string }>();
    const { username, password } = body ?? {};
    if (!username || !password) {
      return ctx.json({ error: "username and password required" }, 400);
    }
    try {
      const token = await auth.login(username, password);
      return ctx.json({ token });
    } catch (e: unknown) {
      const status = (e as { status?: number }).status ?? 500;
      const message = (e as Error).message ?? "Login failed";
      return ctx.json({ error: message }, status as 401 | 500);
    }
  });

  // POST /api/auth/refresh  Authorization: Bearer <token> → { token }
  app.post("/refresh", async (ctx) => {
    const header = ctx.req.header("authorization") ?? "";
    if (!header.startsWith("Bearer ")) {
      return ctx.json({ error: "Missing token" }, 401);
    }
    try {
      const token = await auth.refreshToken(header.slice(7));
      return ctx.json({ token });
    } catch (e: unknown) {
      const status = (e as { status?: number }).status ?? 401;
      return ctx.json({ error: (e as Error).message }, status as 401);
    }
  });

  return app;
}
