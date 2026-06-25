/**
 * DNS-rebinding / cross-origin protection for the MCP HTTP transport (I4).
 *
 * The local MCP endpoint exposes powerful tools (file writes, ingest). Without
 * Host/Origin validation, a malicious web page could use DNS rebinding to reach
 * the loopback server from the victim's browser. We therefore:
 *   - require the Host header to be an expected loopback host, and
 *   - reject any cross-site Origin not on an explicit allow-list.
 */

export interface RequestOriginInfo {
  origin: string | undefined;
  host: string | undefined;
}

export interface OriginGuardOptions {
  /** Expected Host header values (e.g. "127.0.0.1:4568", "localhost:4568"). */
  allowedHosts: string[];
  /** Extra Origins explicitly trusted (e.g. a deployed web UI). */
  allowedOrigins?: string[];
}

function originHostMatches(origin: string, allowedHosts: string[]): boolean {
  try {
    const { host } = new URL(origin);
    return allowedHosts.includes(host);
  } catch {
    return false;
  }
}

export function isRequestOriginAllowed(
  req: RequestOriginInfo,
  opts: OriginGuardOptions,
): boolean {
  // 1. Host must be one we expect — blocks DNS rebinding to a foreign hostname.
  if (!req.host || !opts.allowedHosts.includes(req.host)) {
    return false;
  }

  // 2. No Origin header → non-browser client (curl, CLI agent). Host check above
  //    is sufficient; browsers always send Origin on cross-origin requests.
  if (!req.origin) return true;

  // 3. Origin present: allow same-origin (its host matches an allowed Host) or
  //    an explicitly allow-listed Origin; reject everything else.
  if (originHostMatches(req.origin, opts.allowedHosts)) return true;
  if (opts.allowedOrigins?.includes(req.origin)) return true;

  return false;
}

/** Default allowed Host values for a given bind host/port. */
export function defaultAllowedHosts(host: string, port: number): string[] {
  const hosts = new Set<string>([`${host}:${port}`]);
  // Loopback aliases.
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "localhost") {
    hosts.add(`127.0.0.1:${port}`);
    hosts.add(`localhost:${port}`);
  }
  return [...hosts];
}
