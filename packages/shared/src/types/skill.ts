/**
 * Skill type taxonomy (v2).
 *
 * New in v2: agent, workflow, connector.
 * Carried forward: ingest, query, generate, scaffold, lint, prompt, theme.
 */
export type SkillType =
  | "agent"
  | "workflow"
  | "connector"
  | "ingest"
  | "query"
  | "generate"
  | "scaffold"
  | "lint"
  | "prompt"
  | "theme";

/** How a skill's handler is executed */
export type SkillExecutionMode = "prompt-only" | "sandbox" | "native";

/** Skill author metadata */
export interface SkillAuthor {
  name: string;
  url?: string;
  email?: string;
}

/** Tool schema exposed by a skill */
export interface SkillToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  permissions?: string[];
}

/** Configuration parameter for a skill */
export interface SkillConfigParam {
  type: "string" | "number" | "boolean" | "select";
  default?: string | number | boolean;
  options?: string[];
  description?: string;
  required?: boolean;
}

/** Skill manifest — the skill.json file (v2) */
export interface SkillManifest {
  name: string;
  version: string;
  type: SkillType;
  displayName: string;
  description: string;
  author: SkillAuthor;
  license: string;
  /** "free" for free skills, or price in cents */
  price: "free" | number;
  /** Engine version compatibility (semver range) */
  engines: {
    vale: string;
  };
  /** Required Vale permissions */
  permissions: string[];
  /** Natural language triggers that suggest this skill */
  triggers?: string[];
  /** Cron schedule for agent-type skills */
  schedule?: string;
  /** Tools exposed by this skill */
  tools?: SkillToolDefinition[];
  /** User-configurable parameters */
  config?: Record<string, SkillConfigParam>;
  /** Other skills this skill depends on */
  dependencies?: Record<string, string>;
  /** Execution mode */
  executionMode?: SkillExecutionMode;
  /** Tags for marketplace discovery */
  tags?: string[];
  /** Icon URL or relative path */
  icon?: string;
}

/** Runtime state of an installed skill */
export interface InstalledSkill {
  manifest: SkillManifest;
  /** Absolute path to the installed skill directory */
  installPath: string;
  /** When the skill was installed (epoch ms) */
  installedAt: number;
  /** The loaded prompt content (from prompts/system.md) */
  promptContent: string | null;
  /** Whether the skill is currently enabled */
  enabled: boolean;
}

/** Skill marketplace listing (returned by API) */
export interface SkillListing {
  name: string;
  displayName: string;
  type: SkillType;
  version: string;
  description: string;
  author: SkillAuthor;
  price: "free" | number;
  downloads: number;
  rating: number;
  iconUrl?: string;
  tags: string[];
  updatedAt: string;
}

/** Skill marketplace search results */
export interface SkillSearchResult {
  skills: SkillListing[];
  total: number;
  page: number;
  pageSize: number;
}
