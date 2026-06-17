/**
 * @vale/skills
 *
 * Skill SDK for Vale — skill loading, registry, execution, and marketplace.
 */

export type {
  SkillManifest,
  InstalledSkill,
  SkillType,
  SkillExecutionContext,
  SkillExecutionResult,
} from "./types.js";

export { loadSkillFromPath, loadAllSkills } from "./loader.js";
export {
  initSkills,
  getInstalledSkills,
  findSkill,
  getSkillDirectoryText,
  getSkillPromptText,
  getAllTriggers,
} from "./registry.js";
export { executeSkill } from "./runtime.js";
export { MarketplaceClient } from "./marketplace/client.js";
export type { MarketplaceClientOptions } from "./marketplace/client.js";
