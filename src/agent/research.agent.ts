import type { StreamingCompletionModel } from "@anvia/core/completion";
import {
  createScopedAgent,
  type RunScope,
} from "../application/scoped-agent.js";
import {
  prepareResearchInput,
  finalizeResearch,
} from "../application/research-policy.js";
import type { AppConfig } from "../config/index.js";
import type { SearchProvider } from "../providers/search-provider.js";
import { getReportedTokenUsage } from "../providers/llm.js";
import type { ReportStore } from "../services/report-store.js";
import { createRunLogger, type RunMetrics } from "../services/run-metrics.js";
import type { ResearchResponse } from "../schemas/research.js";
import { createResearchTools } from "../tools/research-tools.js";
import { buildResearchInstructions } from "./research.instructions.js";

export type ResearchDependencies = {
  config: AppConfig;
  model: StreamingCompletionModel;
  searchProvider: SearchProvider;
  reportStore: ReportStore;
  logger?: Pick<ReturnType<typeof createRunLogger>, "log">;
};
type State = {
  started: number;
  handlers: ReturnType<typeof createResearchTools>;
  response?: ResearchResponse;
  inputTokens: number | null;
  outputTokens: number | null;
  responses: number;
};

export function createResearchAgent(dependencies: ResearchDependencies) {
  const { config } = dependencies;
  const states = new WeakMap<RunScope, State>();
  const logger =
    dependencies.logger ??
    createRunLogger((json) => process.stderr.write(`${json}\n`));
  return createScopedAgent({
    id: "research",
    model: dependencies.model,
    instructions: buildResearchInstructions(config),
    maxTurns: config.maxAgentTurns,
    maxExecutionMs: config.maxExecutionMs,
    prepareInput: (settings) =>
      prepareResearchInput(settings, config.maxPromptChars),
    tools(scope) {
      const handlers = createResearchTools(scope, dependencies);
      if (scope.runId !== "inactive")
        states.set(scope, {
          started: performance.now(),
          handlers,
          inputTokens: 0,
          outputTokens: 0,
          responses: 0,
        });
      return handlers.tools;
    },
    transformResponse(scope, response) {
      scope.assertActive();
      const state = states.get(scope);
      if (!state) throw new Error("NO_ACTIVE_RESEARCH_SCOPE");
      const usage = getReportedTokenUsage(response.rawResponse);
      state.inputTokens =
        state.inputTokens === null || usage.inputTokens === null
          ? null
          : state.inputTokens + usage.inputTokens;
      state.outputTokens =
        state.outputTokens === null || usage.outputTokens === null
          ? null
          : state.outputTokens + usage.outputTokens;
      state.responses++;
      if (response.choice.some((part) => part.type === "tool-call"))
        return response;
      const candidate = response.choice
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      state.response = finalizeResearch(
        scope.runId,
        candidate,
        state.handlers.snapshot(),
      );
      return {
        ...response,
        choice: [{ type: "text", text: JSON.stringify(state.response) }],
      };
    },
    finalize(scope, event) {
      const state = states.get(scope);
      if (
        event.status !== "completed" ||
        !state?.response ||
        event.text !== JSON.stringify(state.response)
      )
        throw new Error("UNVERIFIED_RESEARCH_OUTPUT");
    },
    onClose(scope) {
      const state = states.get(scope);
      if (!state) return;
      const snapshot = state.handlers.snapshot();
      const status = state.response?.status ?? "failed";
      const errorType: RunMetrics["error_type"] =
        status === "budget_exceeded"
          ? "budget"
          : status !== "failed"
            ? null
            : snapshot.validationRejections
              ? "validation"
              : snapshot.webSearchCalls && !snapshot.searchSuccesses
                ? "search_provider"
                : snapshot.reportCreated && !snapshot.reportVerified
                  ? "filesystem"
                  : state.response
                    ? "invalid_output"
                    : "unknown";
      try {
        logger.log({
          runId: scope.runId,
          run_duration_ms: performance.now() - state.started,
          model_calls: scope.modelCalls,
          tool_calls: scope.toolCalls,
          input_tokens:
            state.responses === scope.modelCalls ? state.inputTokens : null,
          output_tokens:
            state.responses === scope.modelCalls ? state.outputTokens : null,
          web_search_calls: snapshot.webSearchCalls,
          source_count:
            status === "completed" ? snapshot.reportSources.length : 0,
          report_created: snapshot.reportCreated,
          report_verified: snapshot.reportVerified,
          run_status: status,
          error_type: errorType,
          validation_rejections: snapshot.validationRejections,
          search_successes: snapshot.searchSuccesses,
        });
      } catch {
        // A logging sink cannot turn a verified outcome into a new run or retry.
      } finally {
        states.delete(scope);
      }
    },
  });
}
