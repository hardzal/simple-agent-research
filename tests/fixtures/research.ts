import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, vi } from "vitest";
import {
  Usage,
  type CompletionRequest,
  type CompletionResponse,
  type StreamingCompletionModel,
} from "@anvia/core/completion";
import { parseConfig } from "../../src/config/index.js";
import { createReportStore } from "../../src/services/report-store.js";
import { createResearchRuntime } from "../../src/application/research-runner.js";
import type { SearchHit } from "../../src/providers/search-provider.js";

export const source: SearchHit = {
  title: "Redis documentation",
  url: "https://redis.io/docs/",
  snippet: "Redis is an in-memory data store used as a cache and database.",
};
export const other: SearchHit = {
  title: "Memcached",
  url: "https://memcached.org/",
  snippet: "Memcached is a distributed memory caching system.",
};
export const config = parseConfig({
  OPENAI_API_KEY: "fixture",
  TAVILY_API_KEY: "fixture",
  REPORTS_DIR: "./reports",
});
export const decision = (
  status = "completed",
  message = "Laporan terverifikasi.",
) => JSON.stringify({ status, message });
export function report(url = source.url, language = "id") {
  return language === "en"
    ? `# Redis\n\n## Key findings\nRedis is an in-memory data store used as a cache [S1].\n\n## Limitations\nThis research uses search snippets, not full articles.\n\n## Sources\n- [S1] ${url}\n`
    : `# Redis\n\n## Temuan utama\nRedis adalah penyimpanan data dalam memori untuk cache dan database [S1].\n\n## Keterbatasan\nRiset ini berdasarkan snippet pencarian, bukan artikel lengkap.\n\n## Sumber\n- [S1] ${url}\n`;
}
export const tool = (
  toolName: string,
  input: Record<string, string> = {},
): CompletionResponse["choice"] => [
  { type: "tool-call", toolCallId: `${toolName}-fixture`, toolName, input },
];
export const text = (value: string): CompletionResponse["choice"] => [
  { type: "text", text: value },
];
export const success = (
  content = report(),
  query = "Redis official documentation",
) => [
  tool("webSearch", { query }),
  tool("writeFile", { content }),
  tool("readFile"),
  text(decision()),
];
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

export async function fixture(
  options: {
    steps?: CompletionResponse["choice"][];
    choose?: (
      request: CompletionRequest,
      step: number,
    ) => CompletionResponse["choice"];
    hits?: SearchHit[];
    hitsForQuery?: (query: string) => SearchHit[];
    rawResponse?: unknown;
    searchFails?: boolean;
    config?: Partial<typeof config>;
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "research-behavior-"));
  roots.push(root);
  const requests: CompletionRequest[] = [];
  const steps = options.steps ?? success();
  const model: StreamingCompletionModel = {
    provider: "fake",
    modelId: "scripted-research",
    capabilities: {
      streaming: true,
      tools: true,
      toolChoice: true,
      imageInput: false,
      documentInput: false,
      outputSchema: false,
      reasoning: false,
    },
    async completion(request, callOptions) {
      callOptions?.abortSignal?.throwIfAborted();
      requests.push(request);
      const step = request.chatHistory.filter((m) => m.role === "tool").length;
      const choice = options.choose?.(request, step) ?? steps[step];
      if (!choice) throw new Error("Unexpected model turn");
      return {
        choice,
        usage: Usage.empty(),
        rawResponse: options.rawResponse ?? null,
      };
    },
    async *streamCompletion(request, callOptions) {
      yield {
        type: "final",
        response: await this.completion(request, callOptions),
      };
    },
  };
  const search = vi.fn(async (query: string) => {
    if (options.searchFails) throw new Error("private provider response");
    return options.hitsForQuery?.(query) ?? options.hits ?? [source, other];
  });
  const store = await createReportStore(root);
  const write = vi.spyOn(store, "write");
  const read = vi.spyOn(store, "read");
  const log = vi.fn();
  const runtime = await createResearchRuntime(
    { ...config, ...options.config, reportsDir: root },
    { model, searchProvider: { search }, reportStore: store, logger: { log } },
  );
  return { ...runtime, root, requests, search, write, read, log };
}
