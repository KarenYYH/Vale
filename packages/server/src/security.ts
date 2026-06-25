import { randomBytes } from "node:crypto";

/**
 * Minimum acceptable JWT secret length (bytes/chars). 32 chars ≈ 256 bits
 * when used as an HS256 key, which is the floor we enforce in production.
 */
const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET = "change-me-in-production";

export interface JwtSecretSource {
  /** From VALE_JWT_SECRET env var (highest precedence). */
  envSecret?: string;
  /** From config.auth.jwtSecret. */
  configSecret?: string;
  /** True in development mode — relaxes the fail-closed checks. */
  isDev: boolean;
}

/**
 * Resolve the JWT signing secret, failing closed in production (C2).
 *
 * Precedence: env > config. In production a missing, placeholder, or
 * too-short secret throws — we never silently fall back to a well-known
 * constant that would let anyone forge admin tokens. In development we
 * generate an ephemeral random secret (tokens won't survive a restart,
 * which is fine for local dev).
 */
export function resolveJwtSecret(src: JwtSecretSource): string {
  const candidate = src.envSecret ?? src.configSecret;

  if (src.isDev) {
    if (candidate && candidate !== PLACEHOLDER_SECRET) return candidate;
    // Ephemeral dev secret — random per process start.
    return randomBytes(32).toString("hex");
  }

  // Production: fail closed.
  if (!candidate) {
    throw new Error(
      "JWT secret is required in production. Set VALE_JWT_SECRET (>= 32 chars) " +
        "or auth.jwtSecret in vale config.",
    );
  }
  if (candidate === PLACEHOLDER_SECRET) {
    throw new Error(
      `JWT secret is still the default placeholder ("${PLACEHOLDER_SECRET}"). ` +
        "Set a real VALE_JWT_SECRET before running in production.",
    );
  }
  if (candidate.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT secret is too short (${candidate.length} chars); ` +
        `require at least ${MIN_SECRET_LENGTH} chars for HS256 safety.`,
    );
  }
  return candidate;
}

export interface CorsOriginSource {
  /** Comma-separated allow-list from VALE_CORS_ORIGINS env var. */
  envOrigins?: string;
}

/** Default origins allowed when nothing is configured (local dev only). */
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:4567",
  "http://127.0.0.1:4567",
];

/**
 * Resolve the CORS allow-list (C3). Never returns a wildcard "*"; an
 * unconfigured server only trusts localhost dev origins. Operators opt in
 * to additional origins via a comma-separated VALE_CORS_ORIGINS list.
 */
export function resolveCorsOrigin(src: CorsOriginSource): string | string[] {
  if (src.envOrigins && src.envOrigins.trim()) {
    return src.envOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return DEFAULT_DEV_ORIGINS;
}
