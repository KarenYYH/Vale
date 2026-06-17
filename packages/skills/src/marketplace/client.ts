import type { SkillListing, SkillSearchResult, SkillType } from "@vale/shared";

/** Marketplace API client configuration */
export interface MarketplaceClientOptions {
  baseUrl: string;
  apiKey?: string;
}

/**
 * Client for the Vale Skill Marketplace API.
 */
export class MarketplaceClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(options?: Partial<MarketplaceClientOptions>) {
    this.baseUrl = options?.baseUrl ?? "https://skills.vale.sh/api/v1";
    this.apiKey = options?.apiKey;
  }

  /** Search the marketplace for skills */
  async search(query: string, options?: {
    type?: SkillType;
    freeOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<SkillSearchResult> {
    const params = new URLSearchParams();
    params.set("q", query);
    if (options?.type) params.set("type", options.type);
    if (options?.freeOnly) params.set("free", "true");
    if (options?.page) params.set("page", String(options.page));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize ?? 20));

    const res = await this.fetch(`${this.baseUrl}/skills/search?${params}`);
    return res.json() as Promise<SkillSearchResult>;
  }

  /** Get a single skill listing */
  async getSkill(name: string): Promise<SkillListing> {
    const res = await this.fetch(`${this.baseUrl}/skills/${encodeURIComponent(name)}`);
    return res.json() as Promise<SkillListing>;
  }

  /** List popular skills */
  async popularSkills(limit = 10): Promise<SkillListing[]> {
    const res = await this.fetch(`${this.baseUrl}/skills/popular?limit=${limit}`);
    return res.json() as Promise<SkillListing[]>;
  }

  /** Get download URL for a skill package */
  async getDownloadUrl(name: string, version?: string): Promise<string> {
    const params = version ? `?version=${encodeURIComponent(version)}` : "";
    const res = await this.fetch(`${this.baseUrl}/skills/${encodeURIComponent(name)}/download${params}`);
    const body = await res.json() as { downloadUrl: string };
    return body.downloadUrl;
  }

  private async fetch(url: string): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": `vale-skills-sdk/0.1.0`,
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Marketplace API error: ${res.status} ${res.statusText}`);
    }
    return res;
  }
}
