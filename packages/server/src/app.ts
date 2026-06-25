import { Hono } from "hono";
import { cors } from "hono/cors";
import { LocalAuthProvider } from "@vale/auth";
import type { ValeConfigParsed } from "@vale/shared";
import type { AnswerEngine } from "@vale/agent";
import { mountAuth } from "./middleware/auth.js";
import { makeAuthRoutes } from "./routes/auth.js";
import { makeKnowledgeRoutes } from "./routes/knowledge.js";
import { resolveCorsOrigin } from "./security.js";

export interface AppOptions {
  workspacePath: string;
  config: ValeConfigParsed;
  auth: LocalAuthProvider;
  answerEngine?: AnswerEngine;
}

export function createApp(opts: AppOptions) {
  const { workspacePath, auth, answerEngine } = opts;
  const app = new Hono();

  const corsOrigin = resolveCorsOrigin({ envOrigins: process.env.VALE_CORS_ORIGINS });
  app.use("*", cors({ origin: corsOrigin, allowMethods: ["GET", "POST", "PUT", "DELETE"] }));
  app.use("*", mountAuth(auth));

  app.get("/api/ping", (ctx) => ctx.json({ ok: true, version: "0.1.0" }));

  app.route("/api/auth", makeAuthRoutes(auth));
  app.route("/api", makeKnowledgeRoutes(workspacePath, answerEngine));

  return app;
}
