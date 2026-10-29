import { request } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  createResearchStudio,
  serveResearchStudio,
} from "../application/studio-server.js";
import { parseConfig } from "../config/index.js";
import { researchResponseSchema } from "../schemas/research.js";
import { createReportStore } from "../services/report-store.js";
import type { RunMetrics } from "../services/run-metrics.js";
import { LiveProbeFailure } from "./live-probe.js";
import { createTavilyProvider } from "../providers/search-provider.js";
import { createSourceRegistry } from "../services/source-registry.js";

// Only the managed loopback Studio is contacted here. No HTTP redirects/retries.
function studioRequest(
  port: number,
  signal: AbortSignal,
  body?: object,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path: body ? "/agents/research/runs" : "/status",
        method: body ? "POST" : "GET",
        signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error("LIVE_HTTP"));
          return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 4 * 1024 * 1024) {
            response.destroy(new Error("LIVE_RESPONSE_LIMIT"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve(Buffer.concat(chunks).toString("utf8")),
        );
      },
    );
    req.on("error", reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

/** Exactly one research POST via the scoped Studio; readiness GETs never invoke providers. */
export async function runLiveResearch(
  args: string[],
  env: Record<string, string | undefined>,
  overrides: Parameters<typeof createResearchStudio>[1] = {},
) {
  if (args.length !== 2 || args[0] !== "--case" || args[1] !== "LIVE-03")
    throw new Error("LIVE_CASE");
  if (env.ALLOW_LIVE_TESTS !== "true") throw new Error("LIVE_OPT_IN");
  const config = parseConfig(env);
  if (
    config.maxAgentTurns > 5 ||
    config.maxWebSearchCalls > 3 ||
    config.maxExecutionMs > 180000
  )
    throw new Error("LIVE_BUDGET");
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let metrics: RunMetrics | undefined;
  let runId = "";
  let finalStatus: string | null = null;
  let verifiedContent: string | undefined;
  let successfulWrites = 0;
  let successfulReads = 0;
  let hostRoundTrip = false;
  let stage = "startup";
  const evidence = () => ({
    caseId: "LIVE-03",
    startedAt,
    durationMs: performance.now() - started,
    endpoint: config.openaiBaseUrl,
    model: config.llmModel,
    api: config.llmApi,
    maxExecutionMs: config.maxExecutionMs,
    maxModelAttempts: config.maxAgentTurns,
    maxSearchCalls: config.maxWebSearchCalls,
    runId,
    finalStatus: finalStatus ?? metrics?.run_status ?? null,
    modelCalls: metrics?.model_calls ?? null,
    searchCalls: metrics?.web_search_calls ?? null,
    toolCalls: metrics?.tool_calls ?? null,
    inputTokens: metrics?.input_tokens ?? null,
    outputTokens: metrics?.output_tokens ?? null,
    reportVerified: metrics?.report_verified ?? false,
    applicationError: metrics?.error_type ?? null,
    validationRejections: metrics?.validation_rejections ?? null,
    sourceCount: metrics?.source_count ?? null,
    successfulWrites,
    successfulReads,
    hostRoundTrip,
    stage,
  });
  const controller = new AbortController();
  const reviewSources = createSourceRegistry(config.maxSnippetChars);
  let closed: Promise<void> | undefined;
  try {
    const store = await createReportStore(
      config.reportsDir,
      config.maxReportBytes,
    );
    const searchProvider =
      overrides.searchProvider ??
      createTavilyProvider(config.tavilyApiKey, config.maxSnippetChars);
    const studio = await createResearchStudio(config, {
      ...overrides,
      searchProvider: {
        async search(...params) {
          const hits = await searchProvider.search(...params);
          for (const hit of hits.slice(0, 5)) {
            try {
              reviewSources.add(hit);
            } catch {
              /* Invalid URLs are also discarded by the application registry. */
            }
          }
          return hits;
        },
      },
      logger: {
        log(value) {
          metrics = value;
          runId = value.runId;
        },
      },
      reportStore: {
        async write(...params) {
          const value = await store.write(...params);
          successfulWrites++;
          return value;
        },
        async read(...params) {
          const value = await store.read(...params);
          successfulReads++;
          verifiedContent = value.content;
          return value;
        },
      },
    });
    let bindError: unknown;
    closed = serveResearchStudio(studio, config, controller.signal);
    void closed.catch((error: unknown) => {
      bindError = error;
    });
    const ready = AbortSignal.timeout(5000);
    stage = "readiness";
    for (;;) {
      if (bindError) throw new Error("LIVE_STARTUP");
      ready.throwIfAborted();
      try {
        await studioRequest(config.studioPort, ready);
        break;
      } catch {
        ready.throwIfAborted();
      }
      await delay(20);
    }
    if (bindError) throw new Error("LIVE_STARTUP");
    stage = "research";
    const response = await studioRequest(
      config.studioPort,
      AbortSignal.timeout(config.maxExecutionMs + 5000),
      {
        type: "messages",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Research tentang apa itu Redis dan fungsinya.",
              },
            ],
          },
        ],
        stream: true,
      },
    );
    const frames: {
      type?: string;
      protocol?: string;
      event?: { type?: string; toolName?: string; output?: string };
    }[] = response
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    stage = "verification";
    if (
      frames[0]?.type !== "stream_start" ||
      frames[0].protocol !== "anvia.client.v3"
    )
      throw new Error("LIVE_PROTOCOL");
    const events = frames
      .filter((frame) => frame.type === "stream_event")
      .map((frame) => frame.event!);
    const terminal = events.filter((event) => event.type === "run_end");
    if (terminal.length !== 1 || !terminal[0]?.output)
      throw new Error("LIVE_TERMINAL");
    const result = researchResponseSchema.parse(JSON.parse(terminal[0].output));
    runId = result.runId;
    finalStatus = result.status;
    if (
      result.status !== "completed" ||
      !metrics ||
      metrics.runId !== runId ||
      metrics.run_status !== "completed" ||
      !metrics.report_verified ||
      metrics.web_search_calls < 1 ||
      metrics.web_search_calls > config.maxWebSearchCalls ||
      metrics.model_calls > config.maxAgentTurns ||
      successfulWrites !== 1 ||
      successfulReads !== 1 ||
      !verifiedContent
    )
      throw new Error("LIVE_VERIFICATION");
    stage = "host_report";
    const reportPath = join(config.reportsDir, runId, "report.md");
    if (
      resolve(result.reportPath) !== resolve(reportPath) ||
      (await readFile(reportPath, "utf8")) !== verifiedContent
    )
      throw new Error("LIVE_HOST_REPORT");
    hostRoundTrip = true;
    stage = "trace";
    const toolNames = events
      .filter((event) => event.type === "tool_call_end")
      .map((event) => event.toolName)
      .filter((name) =>
        ["webSearch", "writeFile", "readFile"].includes(name ?? ""),
      );
    if (
      !["webSearch", "writeFile", "readFile"].every((name) =>
        toolNames.includes(name),
      )
    )
      throw new Error("LIVE_TRACE");
    const tracePath = `${runId}/live-03.trace.json`;
    await writeFile(
      join(config.reportsDir, runId, "live-03.trace.json"),
      JSON.stringify(
        {
          ...evidence(),
          outcome: "passed",
          protocol: "anvia.client.v3",
          toolNames,
          metrics,
          reportPath: `${runId}/report.md`,
          sources: reviewSources
            .list()
            .filter((source) => result.sources.includes(source.url)),
        },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return {
      ...evidence(),
      outcome: "passed",
      reportPath: `${runId}/report.md`,
      tracePath,
      manualQualityReview: "pending",
    };
  } catch {
    throw new LiveProbeFailure({
      ...evidence(),
      outcome: "failed",
      errorType: "LIVE_RESEARCH_FAILED",
    });
  } finally {
    controller.abort();
    if (closed) await closed.catch(() => {});
  }
}
