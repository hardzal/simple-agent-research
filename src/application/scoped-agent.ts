import { randomUUID } from "node:crypto";
import {
  Agent,
  type AgentOptions,
  type AgentRunOptions,
  type AgentFinishEvent,
} from "@anvia/core/agent";
import type {
  CompletionResponse,
  StreamingCompletionModel,
} from "@anvia/core/completion";
import type { AnyTool } from "@anvia/core/tool";

export type RunScope = {
  readonly runId: string;
  sdkRunId?: string;
  toolCalls: number;
  /** SDK middleware owns attempt counting; standalone handler scopes use false. */
  readonly toolCallsTrackedByRuntime: boolean;
  modelCalls: number;
  readonly signal: AbortSignal;
  assertActive(): void;
};

type ScopedAgentOptions = {
  id: string;
  model: StreamingCompletionModel;
  instructions?: string;
  maxTurns: number;
  maxExecutionMs: number;
  prepareInput?(settings: AgentRunOptions): AgentRunOptions;
  transformResponse?(
    scope: RunScope,
    response: CompletionResponse,
  ): CompletionResponse;
  tools(scope: RunScope): readonly AnyTool[];
  finalize(scope: RunScope, event: AgentFinishEvent): void | Promise<void>;
  onClose?(scope: RunScope): void;
};

/** Each SDK instance closes over one run; the registered definition holds no live scope. */
export function createScopedAgent(options: ScopedAgentOptions): Agent {
  const inactive: RunScope = {
    runId: "inactive",
    toolCalls: 0,
    toolCallsTrackedByRuntime: true,
    modelCalls: 0,
    signal: AbortSignal.abort(),
    assertActive() {
      throw new Error("No active run scope");
    },
  };
  const base: AgentOptions = {
    id: options.id,
    model: options.model,
    instructions: options.instructions,
    maxTurns: options.maxTurns,
    retries: false,
    tools: options.tools(inactive),
  };
  function bind(settings: AgentRunOptions) {
    settings = options.prepareInput?.(settings) ?? settings;
    const controller = new AbortController();
    const signals = [controller.signal];
    if (settings.abortSignal) signals.push(settings.abortSignal);
    const signal = AbortSignal.any(signals);
    let active = true;
    const scope: RunScope = {
      runId: randomUUID(),
      toolCalls: 0,
      toolCallsTrackedByRuntime: true,
      modelCalls: 0,
      signal,
      assertActive() {
        if (!active) throw new Error("No active run scope");
        signal.throwIfAborted();
      },
    };
    const timer = setTimeout(() => controller.abort(), options.maxExecutionMs);
    timer.unref();
    function close() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      controller.abort();
      options.onClose?.(scope);
    }
    try {
      const agent = new Agent({
        ...base,
        tools: options.tools(scope),
        middlewares: [
          {
            onCompletionRequest() {
              scope.assertActive();
              scope.modelCalls++;
            },
            onToolInput() {
              scope.assertActive();
              scope.toolCalls++;
            },
            onCompletionResponse({ response }) {
              const transformed = options.transformResponse?.(scope, response);
              return transformed ? { response: transformed } : undefined;
            },
          },
        ],
        lifecycle: {
          onStart(event) {
            scope.assertActive();
            scope.sdkRunId = event.runId;
          },
          onStepFinish() {
            scope.assertActive();
          },
          async onFinish(event) {
            try {
              scope.assertActive();
              await options.finalize(scope, event);
              scope.assertActive();
            } finally {
              close();
            }
          },
          onError: close,
        },
      });
      return {
        agent,
        close,
        settings: {
          ...settings,
          maxTurns: options.maxTurns,
          retries: false as const,
          toolConcurrency: 1,
          abortSignal: signal,
        },
      };
    } catch (error) {
      close();
      throw error;
    }
  }
  return new (class extends Agent {
    constructor() {
      super(base);
    }
    override async generate(settings: AgentRunOptions) {
      const run = bind(settings);
      try {
        return await run.agent.generate(run.settings);
      } finally {
        run.close();
      }
    }
    override stream(settings: AgentRunOptions) {
      const run = bind(settings);
      try {
        return run.agent.stream(run.settings);
      } catch (error) {
        run.close();
        throw error;
      }
    }
  })();
}
