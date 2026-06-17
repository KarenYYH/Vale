#!/usr/bin/env node
/**
 * Vale CLI — entry point.
 *
 * Usage:
 *   vale init [path]          Initialize a new workspace
 *   vale serve                 Start MCP server
 *   vale doctor                Check workspace health
 *   vale ingest [paths...]     Ingest files
 *   vale search <query>        Search knowledge base
 *   vale graph                 Knowledge graph
 *   vale lint                  Lint checks
 *   vale skill                 Skill management
 *   vale config                Configuration
 *   vale web                   Start web dashboard
 *   vale version               Print version
 */

import { parseArgs } from "node:util";

const VERSION = "0.1.0";

/** Flags that take a value, so we can strip both flag and value from positionals. */
const VALUE_FLAGS = new Set([
  "--workspace",
  "--port",
  "--host",
  "--export",
  "--role",
  "--password",
]);

/** Read the value following a flag, e.g. getFlag(args, "--workspace"). */
function getFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Resolve the workspace path from --workspace or cwd. */
function getWorkspace(args: string[]): string {
  return getFlag(args, "--workspace") ?? process.cwd();
}

/**
 * Extract positional arguments: drop every `--flag` and, for value-taking
 * flags, the value that follows them too.
 */
function positionals(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      if (VALUE_FLAGS.has(a)) i++; // skip the flag's value
      continue;
    }
    out.push(a);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case "version":
    case "--version":
    case "-v":
      console.log(`vale ${VERSION}`);
      break;

    case "init":
      await runInit(args.slice(1));
      break;

    case "serve":
      await runServe(args.slice(1));
      break;

    case "doctor":
      await runDoctor(args.slice(1));
      break;

    case "ingest":
      await runIngest(args.slice(1));
      break;

    case "search":
      await runSearch(args.slice(1));
      break;

    case "graph":
      await runGraph(args.slice(1));
      break;

    case "lint":
      await runLint(args.slice(1));
      break;

    case "skill":
      await runSkill(args.slice(1));
      break;

    case "config":
      await runConfig(args.slice(1));
      break;

    case "user":
      await runUser(args.slice(1));
      break;

    case "web":
      await runWeb(args.slice(1));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error(`Run \`vale help\` for available commands.`);
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
Vale ${VERSION} — AI-native knowledge management protocol

Usage:
  vale <command> [options]

Commands:
  init [path]          Initialize a new Vale workspace
  serve                 Start the MCP server (stdio or HTTP)
  doctor                Check workspace health
  ingest [paths...]     Ingest files into the knowledge base
  search <query>        Search the knowledge base
  graph                 Export knowledge graph
  lint                  Run quality checks
  skill                 Manage skills (install, list, search)
  config                Manage configuration
  user                  Manage local accounts (create, list)
  web                   Start web dashboard
  version               Print version

For detailed help on a command: vale <command> --help
`);
}

async function runInit(args: string[]) {
  const path = positionals(args)[0] || process.cwd();
  const { initializeWorkspace } = await import("@vale/core");

  console.log(`Initializing Vale workspace at: ${path}`);
  const result = await initializeWorkspace(path);

  console.log(`\nCreated ${result.created.length} items:`);
  for (const item of result.created) {
    console.log(`  + ${item}`);
  }
  if (result.skipped.length > 0) {
    console.log(`\nSkipped ${result.skipped.length} existing items:`);
    for (const item of result.skipped.slice(0, 10)) {
      console.log(`  · ${item}`);
    }
  }
  if (result.failed.length > 0) {
    console.error(`\n⚠️  Failed to create ${result.failed.length} items:`);
    for (const item of result.failed) {
      console.error(`  ✗ ${item}`);
    }
    console.error(`\nWorkspace may be incomplete. Check permissions and retry.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nWorkspace ready. Start the MCP server with: vale serve`);
}

async function runServe(args: string[]) {
  const useHttp = args.includes("--http");
  const workspacePath = getWorkspace(args);

  const portArg = args.indexOf("--port");
  const port = portArg >= 0 ? parseInt(args[portArg + 1], 10) : 4567;
  const hostArg = args.indexOf("--host");
  const host = hostArg >= 0 ? args[hostArg + 1] : "127.0.0.1";

  const { loadConfig } = await import("@vale/shared");
  const { createValeMcpServer, serveStdio, serveHttp } = await import("@vale/mcp");

  const config = await loadConfig(workspacePath);
  const vale = createValeMcpServer(workspacePath, config);

  if (!useHttp) {
    console.error(`Vale MCP server (stdio) — workspace: ${workspacePath}`);
    await serveStdio(vale, { workspacePath, config });
  } else {
    console.error(`Vale MCP server (HTTP) — ${host}:${port} — workspace: ${workspacePath}`);
    const shutdown = await serveHttp(vale, { workspacePath, config }, { port, host });
    process.on("SIGINT", () => shutdown().then(() => process.exit(0)));
    process.on("SIGTERM", () => shutdown().then(() => process.exit(0)));
    // Keep alive
    await new Promise(() => {});
  }
}


async function runDoctor(args: string[]) {
  const workspacePath = getWorkspace(args);
  const autoFix = args.includes("--fix");

  const { countEntries, countEmbeddings, runLint, formatLintReport } = await import("@vale/core");

  console.log(`Vale Doctor — checking ${workspacePath}\n`);

  const files = countEntries(workspacePath);
  const embeddings = countEmbeddings(workspacePath);
  console.log(`  Files indexed: ${files}`);
  console.log(`  Embedding chunks: ${embeddings}`);

  console.log(`\nRunning lint checks...`);
  const report = await runLint(workspacePath);
  console.log(formatLintReport(report));

  if (autoFix) {
    console.log(`\nAuto-fix not yet implemented.`);
  }
}

async function runIngest(args: string[]) {
  const workspacePath = getWorkspace(args);
  const paths = positionals(args);

  const { ingestFile, ingestDirectory } = await import("@vale/core");
  const { stat } = await import("fs/promises");

  for (const p of paths.length > 0 ? paths : ["raw/"]) {
    const fullPath = p.startsWith("/") ? p : `${workspacePath}/${p}`;
    try {
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        console.log(`Ingesting directory: ${p}`);
        const results = await ingestDirectory(workspacePath, fullPath);
        console.log(`  ${results.filter((r) => r.success).length} succeeded, ${results.filter((r) => !r.success).length} failed`);
      } else {
        const result = await ingestFile(workspacePath, fullPath);
        console.log(result.success ? `✓ ${result.wikiPath}` : `✗ ${result.error}`);
      }
    } catch {
      console.error(`Path not found: ${p}`);
    }
  }
}

async function runSearch(args: string[]) {
  const workspacePath = getWorkspace(args);
  const query = positionals(args).join(" ");

  if (!query) {
    console.error("Usage: vale search <query>");
    process.exit(1);
  }

  const { searchHybrid } = await import("@vale/core");
  const results = await searchHybrid(workspacePath, query);

  console.log(`Search results for: "${query}"\n`);
  for (const r of results) {
    console.log(`  [${r.matchType}] ${r.filePath} (${r.score.toFixed(4)})`);
    console.log(`    ${r.content.slice(0, 120)}`);
    console.log();
  }
}

async function runGraph(args: string[]) {
  const workspacePath = getWorkspace(args);

  const { buildLinkIndex, buildGraph } = await import("@vale/core");
  const linkIndex = await buildLinkIndex(workspacePath);
  const graph = buildGraph(linkIndex);

  const format = args.includes("--export") ? args[args.indexOf("--export") + 1] : "summary";

  if (format === "json") {
    console.log(JSON.stringify(graph, null, 2));
  } else {
    console.log(`Knowledge Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    console.log(`\nNodes by layer:`);
    const byLayer: Record<string, number> = {};
    for (const node of graph.nodes) {
      byLayer[node.layer] = (byLayer[node.layer] ?? 0) + 1;
    }
    for (const [layer, count] of Object.entries(byLayer)) {
      console.log(`  ${layer}: ${count}`);
    }
  }
}

async function runLint(args: string[]) {
  const workspacePath = getWorkspace(args);

  const { runLint, formatLintReport } = await import("@vale/core");
  const report = await runLint(workspacePath);
  console.log(formatLintReport(report));
}

async function runSkill(_args: string[]) {
  console.log("Skill management commands:");
  console.log("  vale skill list          List installed skills");
  console.log("  vale skill install <name> Install a skill");
  console.log("  vale skill search <query> Search marketplace");
  console.log("\nSkill marketplace: https://skills.vale.sh (coming soon)");
}

async function runConfig(_args: string[]) {
  console.log("Configuration management:");
  console.log("  vale config show     Show current configuration");
  console.log("  vale config schema   Print JSON Schema");
}

async function runUser(args: string[]) {
  const sub = args[0];
  const rest = args.slice(1);
  const workspacePath = getWorkspace(rest);

  const { LocalAuthProvider } = await import("@vale/auth");
  const { loadConfig } = await import("@vale/shared");
  const config = await loadConfig(workspacePath);
  const jwtSecret =
    process.env.VALE_JWT_SECRET ?? config.auth.jwtSecret ?? "change-me-in-production";
  const auth = new LocalAuthProvider({ jwtSecret, workspacePath });

  switch (sub) {
    case "create": {
      const userId = positionals(rest)[0];
      if (!userId) {
        console.error("Usage: vale user create <username> [--role viewer|editor|admin] [--password <pw>] [--workspace <path>]");
        process.exit(1);
      }
      const role = getFlag(rest, "--role") ?? "admin";
      let password = getFlag(rest, "--password");
      if (!password) {
        password = await promptHidden(`Password for '${userId}': `);
      }
      if (!password) {
        console.error("A password is required.");
        process.exit(1);
      }
      try {
        await auth.createUser({ userId, displayName: userId, password, roles: [role] });
        console.log(`✓ Created user '${userId}' with role '${role}'.`);
        console.log(`  Stored in ${workspacePath}/.vale/users.json`);
      } catch (e) {
        console.error(`✗ ${(e as Error).message}`);
        process.exit(1);
      }
      break;
    }
    case "list": {
      const users = await auth.listUsers();
      if (users.length === 0) {
        console.log("No users yet. Create one with: vale user create <username>");
        break;
      }
      console.log(`Users (${users.length}):`);
      for (const u of users) {
        console.log(`  ${u.userId}  [${u.roles.join(", ")}]${u.tenantId ? `  tenant=${u.tenantId}` : ""}`);
      }
      break;
    }
    default:
      console.log("User management:");
      console.log("  vale user create <username> [--role viewer|editor|admin] [--password <pw>]");
      console.log("  vale user list");
      console.log("\nThe first account you create unlocks PWA/REST login.");
  }
}

/** Prompt for a value without echoing it to the terminal (best-effort). */
async function promptHidden(prompt: string): Promise<string> {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(prompt);
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  return new Promise<string>((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function runWeb(args: string[]) {
  const workspacePath = getWorkspace(args);
  const portArg = args.indexOf("--port");
  const port = portArg >= 0 ? parseInt(args[portArg + 1], 10) : 4567;
  const hostArg = args.indexOf("--host");
  const host = hostArg >= 0 ? args[hostArg + 1] : "127.0.0.1";

  // Resolve web dist relative to this CLI package
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const __dir = dirname(fileURLToPath(import.meta.url));
  const webDistPath = resolve(__dir, "../../web/dist");

  const { startServer } = await import("@vale/server");
  const shutdown = await startServer({ workspacePath, port, host, webDistPath });

  process.on("SIGINT", () => shutdown().then(() => process.exit(0)));
  process.on("SIGTERM", () => shutdown().then(() => process.exit(0)));
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
