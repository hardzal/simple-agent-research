import { randomUUID } from "node:crypto";
import { createTool } from "@anvia/core/tool";
import type { StreamingCompletionModel } from "@anvia/core/completion";
import { z } from "zod";
import { parseConfig, type AppConfig } from "../config/index.js";
import { createScopedAgent } from "../application/scoped-agent.js";
import { createLlmModel, getReportedTokenUsage } from "../providers/llm.js";

export class LiveProbeFailure extends Error {
  constructor(
    readonly evidence: Readonly<
      Record<string, string | number | boolean | null>
    >,
  ) {
    super(String(evidence.errorType));
  }
}

/** One invocation is one run. No retry, fallback model, search, or filesystem operation. */
export async function runLiveProbe(
  args: string[],
  env: Record<string, string | undefined>,
  modelFactory: (
    config: AppConfig,
  ) => StreamingCompletionModel = createLlmModel,
) {
  if (args.length !== 2 || args[0] !== "--case" || args[1] !== "LIVE-01")
    throw new Error("LIVE_CASE");
  if (env.ALLOW_LIVE_TESTS !== "true") throw new Error("ALLOW_LIVE_TESTS");
  const config = parseConfig(env);
  const maxExecutionMs = Math.min(config.maxExecutionMs, 60000);
  const model = modelFactory({ ...config, maxExecutionMs });
  let modelCalls = 0;
  let inputTokens: number | null = 0;
  let outputTokens: number | null = 0;
  const record = (raw: unknown) => {
    const usage = getReportedTokenUsage(raw);
    inputTokens =
      inputTokens === null || usage.inputTokens === null
        ? null
        : inputTokens + usage.inputTokens;
    outputTokens =
      outputTokens === null || usage.outputTokens === null
        ? null
        : outputTokens + usage.outputTokens;
  };
  const countedModel: StreamingCompletionModel = {
    provider: model.provider,
    modelId: model.modelId,
    capabilities: model.capabilities,
    async completion(request, options) {
      if (++modelCalls > 2) throw new Error("LIVE_BUDGET");
      const response = await model.completion(request, options);
      record(response.rawResponse);
      return response;
    },
    async *streamCompletion(request, options) {
      if (++modelCalls > 2) throw new Error("LIVE_BUDGET");
      for await (const event of model.streamCompletion(request, options)) {
        if (event.type === "final") record(event.response.rawResponse);
        yield event;
      }
    },
  };
  const nonce = randomUUID();
  let runId = "";
  let toolCalls = 0;
  let finalStatus: string | null = null;
  let nonceMatched: boolean | null = null;
  let nonceIncluded: boolean | null = null;
  const agent = createScopedAgent({
    id: "live-01-compatibility-probe",
    model: countedModel,
    maxTurns: Math.min(config.maxAgentTurns, 2),
    maxExecutionMs,
    instructions:
      "Call compatibilityStamp exactly once. Copy finalResponse verbatim from its result as your entire final response. Do not add spaces, quotes, Markdown, or explanation. Do not guess the nonce.",
    tools: (scope) => [
      createTool({
        name: "compatibilityStamp",
        description: "Return a compatibility nonce. No side effects.",
        inputSchema: z.object({}).strict(),
        execute() {
          scope.assertActive();
          if (++toolCalls > 1) throw new Error("LIVE_BUDGET");
          return JSON.stringify({ nonce, finalResponse: `LIVE-01:${nonce}` });
        },
      }),
    ],
    finalize(scope, event) {
      runId = scope.runId;
      finalStatus = event.status;
      nonceMatched = event.text.trim() === `LIVE-01:${nonce}`;
      nonceIncluded = event.text.includes(nonce);
      if (
        toolCalls !== 1 ||
        modelCalls !== 2 ||
        event.status !== "completed" ||
        !nonceMatched
      )
        throw new Error("LIVE_REPLAY");
    },
    onClose(scope) {
      runId = scope.runId;
    },
  });
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const evidence = () => ({
    caseId: "LIVE-01",
    runId,
    startedAt,
    durationMs: performance.now() - start,
    endpoint: config.openaiBaseUrl,
    model: config.llmModel,
    api: config.llmApi,
    modelCalls,
    toolCalls,
    inputTokens,
    outputTokens,
    finalStatus,
    nonceMatched,
    nonceIncluded,
  });
  try {
    await agent.generate({ prompt: "Run the synthetic compatibility check." });
  } catch (error) {
    const errorType =
      error instanceof Error &&
      ["LIVE_REPLAY", "LIVE_BUDGET"].includes(error.message)
        ? error.message
        : "LIVE_PROBE_FAILED";
    throw new LiveProbeFailure({ ...evidence(), outcome: "failed", errorType });
  }
  return {
    ...evidence(),
    outcome: "passed",
  };
}
