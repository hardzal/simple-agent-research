import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  Usage,
  type CompletionResponse,
  type StreamingCompletionModel,
} from "@anvia/core/completion";
import {
  EvalOutcome,
  type EvalCase,
  type EvalMetric,
  type RunEvalSuiteOptions,
} from "@anvia/core/evals";
import { createResearchRuntime } from "../application/research-runner.js";
import { parseConfig } from "../config/index.js";
import type { SearchHit } from "../providers/search-provider.js";
import type { ResearchResponse } from "../schemas/research.js";
import {
  createReportStore,
  type ReportStore,
} from "../services/report-store.js";
import { validateReport } from "../services/report-validation.js";

export const offlineResearchCaseIds = [
  "EVAL-01",
  "EVAL-02",
  "EVAL-03",
  "EVAL-04",
  "EVAL-05",
] as const;
export type OfflineResearchCaseId = (typeof offlineResearchCaseIds)[number];
export type OfflineResearchObservation = {
  result: ResearchResponse;
  content: string;
  written: string;
  readBack: string;
  entries: string[];
  searches: number;
  writes: number;
  reads: number;
  modelCalls: number;
  rejections: number;
};

export const offlineResearchSource = Object.freeze<SearchHit>({
  title: "Redis documentation",
  url: "https://redis.io/docs/",
  snippet: "Redis is an in-memory data store used as a cache and database.",
});

// Explicit dummy config, never process.env/.env. Every live-capable runtime
// dependency is overridden below; even the unused endpoint is reserved .invalid.
const config = parseConfig({
  NODE_ENV: "test",
  OPENAI_API_KEY: "offline-unused",
  TAVILY_API_KEY: "offline-unused",
  OPENAI_BASE_URL: "https://offline.invalid/v1",
  LLM_MODEL: "scripted-research",
  REPORTS_DIR: ".",
});
const report = (url = offlineResearchSource.url) =>
  `# Redis\n\n## Temuan utama\nRedis adalah penyimpanan data dalam memori untuk cache dan database [S1].\n\n## Keterbatasan\nRiset ini berdasarkan snippet pencarian, bukan artikel lengkap.\n\n## Sumber\n- [S1] ${url}\n`;
const text = (
  status = "completed",
  message = "Laporan terverifikasi.",
): CompletionResponse["choice"] => [
  { type: "text", text: JSON.stringify({ status, message }) },
];
const tool = (
  toolName: string,
  input: Record<string, string> = {},
  turn = 0,
): CompletionResponse["choice"] => [
  { type: "tool-call", toolCallId: `${toolName}-${turn}`, toolName, input },
];
function script(id: OfflineResearchCaseId): CompletionResponse["choice"][] {
  if (id === "EVAL-02")
    return [text("needs_clarification", "Apple perusahaan atau buah?")];
  if (id === "EVAL-03")
    return [
      tool("webSearch", { query: "Redis" }),
      text("insufficient_evidence", "Bukti belum memadai."),
    ];
  return [
    tool("webSearch", { query: "Redis official documentation" }),
    ...(id === "EVAL-04"
      ? [tool("writeFile", { content: report("https://foreign.test/") })]
      : []),
    tool("writeFile", { content: report() }, 1),
    tool("readFile"),
    text(),
  ];
}

/** Snapshots real runtime/store evidence before deleting this target's root.
 * reportPath in the returned response is historical evidence, not a durable file.
 * Setup, runtime and observation errors propagate to the SDK as invalid targets.
 */
export async function observeOfflineResearch(
  id: OfflineResearchCaseId,
  signal?: AbortSignal,
): Promise<OfflineResearchObservation> {
  if (!offlineResearchCaseIds.includes(id))
    throw new Error("UNKNOWN_OFFLINE_RESEARCH_CASE");
  signal?.throwIfAborted();
  const root = await mkdtemp(join(tmpdir(), "research-offline-"));
  try {
    const steps = script(id);
    let modelCalls = 0;
    let searches = 0;
    let writes = 0;
    let reads = 0;
    let rejections = 0;
    let written = "";
    let readBack = "";
    const model: StreamingCompletionModel = {
      provider: "offline",
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
      async completion(_request, options) {
        options?.abortSignal?.throwIfAborted();
        const choice = steps[modelCalls++];
        if (!choice) throw new Error("UNEXPECTED_OFFLINE_MODEL_TURN");
        return { choice, usage: Usage.empty(), rawResponse: null };
      },
      async *streamCompletion(request, options) {
        yield {
          type: "final",
          response: await this.completion(request, options),
        };
      },
    };
    const store = await createReportStore(root, config.maxReportBytes);
    const observedStore: ReportStore = {
      async write(runId, content, abortSignal) {
        const result = await store.write(runId, content, abortSignal);
        writes++;
        written = content;
        return result;
      },
      async read(runId, abortSignal) {
        const result = await store.read(runId, abortSignal);
        reads++;
        readBack = result.content;
        return result;
      },
    };
    const runtime = await createResearchRuntime(
      { ...config, reportsDir: root },
      {
        model,
        searchProvider: {
          async search(_query, options) {
            options.signal.throwIfAborted();
            searches++;
            return id === "EVAL-03" ? [] : [{ ...offlineResearchSource }];
          },
        },
        reportStore: observedStore,
        // No stdout/stderr or external telemetry sink; retain only a safe count.
        logger: {
          log(metrics) {
            rejections = metrics.validation_rejections;
          },
        },
      },
    );
    const result = await runtime.run(
      id === "EVAL-02"
        ? "Research Apple."
        : "Research tentang apa itu Redis dan fungsinya.",
      signal ? { abortSignal: signal } : {},
    );
    signal?.throwIfAborted();
    return {
      result,
      content: result.reportPath
        ? await readFile(result.reportPath, "utf8")
        : "",
      written,
      readBack,
      entries: await readdir(root),
      searches,
      writes,
      reads,
      modelCalls,
      rejections,
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const rejected = () =>
  EvalOutcome.fail(false, {
    comment: "Mandatory status/provenance/file/budget contract rejected.",
  });
const withinBudget = (value: number, max: number) =>
  Number.isSafeInteger(value) && value >= 0 && value <= max;

/** Mechanical required gate; unexpected evaluator errors are NOT converted to pass/fail. */
export const mandatoryResearchContract: EvalMetric<
  OfflineResearchCaseId,
  OfflineResearchObservation,
  boolean
> = {
  name: "mandatory-contract",
  required: true,
  evaluate({ case: testCase, output: o }) {
    if (
      !offlineResearchCaseIds.includes(testCase.input) ||
      !withinBudget(o.modelCalls, config.maxAgentTurns) ||
      !withinBudget(o.searches, config.maxWebSearchCalls)
    )
      return rejected();
    if (testCase.input === "EVAL-02" || testCase.input === "EVAL-03") {
      if (
        o.result.status !==
          (testCase.input === "EVAL-02"
            ? "needs_clarification"
            : "insufficient_evidence") ||
        o.result.reportPath !== undefined ||
        o.result.sources !== undefined ||
        o.searches !== (testCase.input === "EVAL-02" ? 0 : 1) ||
        o.writes !== 0 ||
        o.reads !== 0 ||
        !isDeepStrictEqual(o.entries, []) ||
        o.result.message.trim() === ""
      )
        return rejected();
    } else if (
      o.result.status !== "completed" ||
      !o.result.reportPath ||
      o.searches !== 1 ||
      o.writes !== 1 ||
      o.reads !== 1 ||
      o.content.trim() === "" ||
      o.content !== o.written ||
      o.content !== o.readBack ||
      !isDeepStrictEqual(o.result.sources, [offlineResearchSource.url]) ||
      validateReport(
        o.content,
        [{ ...offlineResearchSource, sourceId: "S1" }],
        config.maxReportBytes,
      ).length !== 0 ||
      !isDeepStrictEqual(o.entries, [o.result.runId]) ||
      (testCase.input === "EVAL-04" && o.rejections !== 1)
    )
      return rejected();
    return EvalOutcome.pass(true);
  },
};

/** Supporting fixture feedback only, never a semantic judge of a live model. */
export const fixtureQualityReview: EvalMetric<
  OfflineResearchCaseId,
  OfflineResearchObservation,
  number
> = {
  name: "fixture-quality-review",
  required: false,
  evaluate({ output: o }) {
    if (o.result.status !== "completed")
      return EvalOutcome.pass(0, {
        comment: "No report expected; no quality judgment.",
      });
    const words = o.content.trim().split(/\s+/).length;
    const matchesFixture =
      o.content.includes("Redis") &&
      o.content.includes("cache") &&
      o.content.includes("Temuan utama") &&
      !o.content.includes("Memcached");
    return matchesFixture
      ? EvalOutcome.pass(words, {
          comment:
            "Scripted Indonesian fixture feedback: supplied Redis snippet and expected language/structure match. Word count is feedback only; live quality needs manual review, not a semantic LLM judge.",
        })
      : EvalOutcome.fail(words, {
          comment:
            "Factual/language fixture mismatch; not a semantic LLM judge.",
        });
  },
};

// The pinned core calls this RunEvalSuiteOptions (not EvalSuiteOptions).
// Describe only returned fields, with mutable arrays accepted by Studio too.
export type OfflineResearchEvalSuite = Pick<
  RunEvalSuiteOptions<OfflineResearchCaseId, OfflineResearchObservation>,
  "name" | "target"
> & {
  id: "research-offline";
  cases: EvalCase<OfflineResearchCaseId>[];
  metrics: [typeof mandatoryResearchContract, typeof fixtureQualityReview];
  concurrency: number;
};

export function createOfflineResearchEvalSuite(): OfflineResearchEvalSuite {
  return {
    id: "research-offline",
    name: "Research offline (scripted fixtures)",
    cases: offlineResearchCaseIds.map((id) => ({ id, input: id })),
    target: (id, _testCase, context) =>
      observeOfflineResearch(id, context?.signal),
    metrics: [mandatoryResearchContract, fixtureQualityReview],
    concurrency: 1,
  };
}
