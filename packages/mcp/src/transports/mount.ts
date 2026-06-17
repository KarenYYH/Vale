import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ValeMcpServer } from "../server.js";
import type { ValeMcpContext } from "../tools/types.js";

const VALE_VERSION = "0.1.0";

/**
 * Create an SDK Server and register all Vale tools onto it.
 * Shared by both stdio and HTTP transports.
 */
export function mountValeMcpServer(
  vale: ValeMcpServer,
  ctx: ValeMcpContext,
): Server {
  const server = new Server(
    { name: "vale", version: VALE_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: vale.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: buildJsonSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    return vale.executeTool(name, args as Record<string, unknown>, ctx);
  });

  return server;
}

/**
 * Convert a Zod shape (Record<field, ZodType>) to a JSON Schema object.
 */
function buildJsonSchema(shape: Record<string, unknown>): object {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, zodType] of Object.entries(shape)) {
    const zt = zodType as z.ZodTypeAny;
    properties[key] = zodTypeToJsonSchema(zt);
    if (!(zt instanceof z.ZodOptional) && !(zt instanceof z.ZodDefault)) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function zodTypeToJsonSchema(zt: z.ZodTypeAny): object {
  if (zt instanceof z.ZodDefault) {
    const inner = zodTypeToJsonSchema(zt._def.innerType);
    return { ...inner, default: zt._def.defaultValue() };
  }
  if (zt instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zt._def.innerType);
  }

  const base: Record<string, unknown> = {};
  if (zt.description) base.description = zt.description;

  if (zt instanceof z.ZodString) return { type: "string", ...base };
  if (zt instanceof z.ZodNumber) return { type: "number", ...base };
  if (zt instanceof z.ZodBoolean) return { type: "boolean", ...base };
  if (zt instanceof z.ZodArray) {
    return { type: "array", items: zodTypeToJsonSchema(zt._def.type), ...base };
  }
  if (zt instanceof z.ZodObject) {
    return buildJsonSchema(zt._def.shape());
  }
  if (zt instanceof z.ZodEnum) {
    return { type: "string", enum: zt._def.values, ...base };
  }
  if (zt instanceof z.ZodRecord) {
    return { type: "object", additionalProperties: true, ...base };
  }
  return { type: "string", ...base };
}
