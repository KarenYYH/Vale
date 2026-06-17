import type { HybridSearchResult, HybridSearchOptions, SemanticSearchResult } from "@vale/shared";
import { searchFts } from "../database/fts.js";
import { searchSemantic } from "./semantic.js";

/**
 * Hybrid search: FTS5 + vector ANN fused via Reciprocal Rank Fusion (RRF).
 *
 * Runs both searches in parallel, then merges results using RRF:
 *   score(result) = Σ (1 / (k + rank_i)) for each method that found it
 *
 * Results that appear in both FTS and vector results get a boost.
 */
export async function searchHybrid(
  workspacePath: string,
  query: string,
  options?: HybridSearchOptions,
): Promise<HybridSearchResult[]> {
  const k = options?.rrfConstant ?? 60;
  const limit = options?.limit ?? 20;
  const maxCandidates = options?.maxCandidates ?? 200;

  // Run both searches in parallel
  const [ftsResults, vectorResults] = await Promise.all([
    searchFts(workspacePath, query, maxCandidates),
    searchSemantic(workspacePath, query, undefined, undefined, undefined, maxCandidates),
  ]);

  // Track rankings and metadata per file
  const fileMap = new Map<
    string,
    {
      ftsRank: number;
      vecRank: number;
      ftsResult?: (typeof ftsResults)[0];
      vecResult?: SemanticSearchResult;
    }
  >();

  // Record FTS rankings
  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i];
    fileMap.set(r.filePath, {
      ftsRank: i + 1,
      vecRank: Infinity,
      ftsResult: r,
    });
  }

  // Record vector rankings
  for (let i = 0; i < vectorResults.length; i++) {
    const r = vectorResults[i];
    const existing = fileMap.get(r.filePath);
    if (existing) {
      existing.vecRank = i + 1;
      existing.vecResult = r;
    } else {
      fileMap.set(r.filePath, {
        ftsRank: Infinity,
        vecRank: i + 1,
        vecResult: r,
      });
    }
  }

  // Compute RRF scores
  const fused: HybridSearchResult[] = [];
  const ftsW = options?.ftsWeight ?? 0.5;
  const vecW = options?.vectorWeight ?? 0.5;

  for (const [filePath, data] of fileMap) {
    const ftsScore = data.ftsRank < Infinity ? ftsW * (1 / (k + data.ftsRank)) : 0;
    const vecScore = data.vecRank < Infinity ? vecW * (1 / (k + data.vecRank)) : 0;
    const score = ftsScore + vecScore;

    let matchType: HybridSearchResult["matchType"] = "fts";
    if (data.ftsRank < Infinity && data.vecRank < Infinity) {
      matchType = "both";
    } else if (data.vecRank < Infinity) {
      matchType = "vector";
    }

    fused.push({
      filePath,
      line: data.ftsResult?.line ?? 0,
      content:
        data.ftsResult?.content ??
        data.vecResult?.chunkText ??
        filePath,
      score: Math.round(score * 10000) / 10000,
      matchType,
    });
  }

  // Sort by RRF score (descending)
  fused.sort((a, b) => b.score - a.score);

  return fused.slice(0, limit);
}
