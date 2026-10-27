import { randomUUID } from "node:crypto";
import {
  createTavilyProvider,
  type SearchProvider,
} from "../providers/search-provider.js";
import { createSourceRegistry } from "../services/source-registry.js";
import { LiveProbeFailure } from "./live-probe.js";

export async function runLiveSearch(
  args: string[],
  env: Record<string, string | undefined>,
  factory: (apiKey: string) => SearchProvider = (key) =>
    createTavilyProvider(key, 1500),
) {
  if (args.length !== 2 || args[0] !== "--case" || args[1] !== "LIVE-02")
    throw new Error("LIVE_CASE");
  if (env.ALLOW_LIVE_TESTS !== "true") throw new Error("LIVE_OPT_IN");
  if (!env.TAVILY_API_KEY?.trim()) throw new Error("TAVILY_API_KEY");
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const runId = randomUUID();
  let searchCalls = 0;
  const evidence = () => ({
    caseId: "LIVE-02",
    runId,
    startedAt,
    durationMs: performance.now() - started,
    endpoint: "https://api.tavily.com/search",
    query: "Redis official documentation",
    modelCalls: 0,
    searchCalls,
    inputTokens: null,
    outputTokens: null,
  });
  try {
    const provider = factory(env.TAVILY_API_KEY);
    const signal = AbortSignal.timeout(60000);
    searchCalls++;
    const hits = await provider.search("Redis official documentation", {
      maxResults: 5,
      signal,
    });
    signal.throwIfAborted();
    if (hits.length > 5) throw new Error();
    const registry = createSourceRegistry(1500);
    for (const hit of hits) registry.add(hit);
    return {
      ...evidence(),
      outcome: "passed",
      resultCount: hits.length,
      sourceCount: registry.list().length,
      sourcesWithDate: registry
        .list()
        .filter((source) => source.publishedAt !== undefined).length,
    };
  } catch {
    throw new LiveProbeFailure({
      ...evidence(),
      outcome: "failed",
      errorType: "LIVE_SEARCH_FAILED",
    });
  }
}
