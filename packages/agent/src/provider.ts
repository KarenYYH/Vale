import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentInfo, UpdateInfo } from "./types.js";

const execFileAsync = promisify(execFile);

const CANDIDATES = ["claude", "codex"] as const;
type CliName = typeof CANDIDATES[number];

// npm registry endpoints for version checks
const VERSION_REGISTRY: Record<CliName, string> = {
  claude: "@anthropic-ai/claude-code",
  codex: "@openai/codex",
};

// Official install commands
const INSTALL_CMD: Record<CliName, string[]> = {
  claude: ["npm", "install", "-g", "@anthropic-ai/claude-code"],
  codex: ["npm", "install", "-g", "@openai/codex"],
};

/**
 * Detect an installed and working CLI agent.
 * Three-gate check: which → --version → headless dry-run.
 */
export async function detect(preferred?: CliName): Promise<AgentInfo | null> {
  const order: CliName[] = preferred
    ? [preferred, ...CANDIDATES.filter((c) => c !== preferred)]
    : [...CANDIDATES];

  for (const cli of order) {
    const info = await probeCli(cli);
    if (info) return info;
  }
  return null;
}

async function probeCli(cli: CliName): Promise<AgentInfo | null> {
  try {
    // Gate 1: which
    const { stdout: which } = await execFileAsync("which", [cli], { timeout: 5000 });
    const binPath = which.trim();
    if (!binPath) return null;

    // Gate 2: --version
    const { stdout: ver } = await execFileAsync(binPath, ["--version"], { timeout: 5000 });
    const version = ver.trim().split("\n")[0];
    if (!version) return null;

    // Gate 3: headless dry-run (print-only, no side effects)
    await execFileAsync(binPath, ["-p", "--help"], { timeout: 8000 }).catch(() => {
      // Some CLIs print help to stderr and exit non-zero — still counts as working
    });

    return { cli, binPath, version };
  } catch {
    return null;
  }
}

/**
 * Install a CLI agent via official npm channel.
 * Requires user confirmation unless opts.yes is set.
 */
export async function install(
  cli: CliName,
  opts: { yes?: boolean } = {},
): Promise<AgentInfo> {
  if (!opts.yes) {
    // In server context, require explicit yes; callers (PWA/CLI) handle confirmation UI
    throw new Error(
      `User confirmation required to install ${cli}. Pass { yes: true } or prompt the user first.`,
    );
  }

  const [cmd, ...args] = INSTALL_CMD[cli];
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit" });
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Install exited with code ${code}`)),
    );
    proc.on("error", reject);
  });

  const info = await probeCli(cli);
  if (!info) throw new Error(`${cli} installed but still not detected — check PATH`);
  return info;
}

/**
 * Check for a newer version via npm registry.
 * Returns cached result if checked within intervalHours.
 */
export async function checkUpdate(
  info: AgentInfo,
  opts: { cacheDir: string; intervalHours: number },
): Promise<UpdateInfo> {
  const cacheFile = join(opts.cacheDir, `update-check-${info.cli}.json`);
  const intervalMs = opts.intervalHours * 3600 * 1000;

  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf-8")) as {
      checkedAt: number;
      result: UpdateInfo;
    };
    if (Date.now() - cached.checkedAt < intervalMs) return cached.result;
  } catch {
    // no cache yet
  }

  try {
    const pkg = VERSION_REGISTRY[info.cli];
    const { stdout } = await execFileAsync(
      "npm",
      ["view", pkg, "version", "--json"],
      { timeout: 10_000 },
    );
    const latest = JSON.parse(stdout.trim()) as string;
    const current = info.version.replace(/^v/, "");
    const result: UpdateInfo = { current, latest, hasUpdate: latest !== current };

    await mkdir(opts.cacheDir, { recursive: true });
    await writeFile(cacheFile, JSON.stringify({ checkedAt: Date.now(), result }), "utf-8");
    return result;
  } catch {
    return { current: info.version, latest: "unknown", hasUpdate: false };
  }
}
