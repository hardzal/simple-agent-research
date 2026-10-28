import { randomUUID } from "node:crypto";
import {
  Agent,
  type AgentOptions,
  type AgentRunOptions,
  type AgentFinishEvent,
  type AgentOutcome,
  type AgentStream,
} from "@anvia/core/agent";
import {
  Usage,
  type CompletionResponse,
  type StreamingCompletionModel,
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
  readonly abortReason?: "deadline" | "cancelled" | undefined;
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
  beforeCompletion?(scope: RunScope): void;
  recover?(scope: RunScope, error: unknown): string;
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
    const deadlineReason = Symbol("run-deadline");
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
      get abortReason() {
        if (!signal.aborted) return undefined;
        return signal.reason === deadlineReason ? "deadline" : "cancelled";
      },
      assertActive() {
        if (!active) throw new Error("No active run scope");
        signal.throwIfAborted();
      },
    };
    const timer = setTimeout(
      () => controller.abort(deadlineReason),
      options.maxExecutionMs,
    );
    timer.unref();
    function close() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      controller.abort();
      options.onClose?.(scope);
    }
    let recovered: AgentOutcome | undefined;
    function recover(error: unknown) {
      if (recovered || !options.recover) return recovered;
      const output = options.recover(scope, error);
      recovered = {
        type: "response",
        runId: scope.sdkRunId ?? scope.runId,
        output,
        text: output,
        usage: Usage.empty(),
        messages: [],
      };
      return recovered;
    }
    try {
      const agent = new Agent({
        ...base,
        tools: options.tools(scope),
        middlewares: [
          {
            onCompletionRequest() {
              scope.assertActive();
              options.beforeCompletion?.(scope);
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
            } catch (error) {
              recover(error);
              throw error;
            } finally {
              close();
            }
          },
          onError() {
            // SDK lifecycle snapshots strip Error prototypes; recover the original thrown error at the adapter boundary.
            if (!options.recover) close();
          },
        },
      });
      return {
        agent,
        close,
        recover,
        cancel() {
          controller.abort("cancelled");
        },
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
      } catch (error) {
        const recovered = run.recover(error);
        if (recovered) return recovered;
        throw error;
      } finally {
        run.close();
      }
    }
    override stream(settings: AgentRunOptions) {
      const run = bind(settings);
      try {
        const source = run.agent.stream(run.settings);
        if (!options.recover) return source;
        let result: Promise<AgentOutcome> | undefined;
        const stream: AgentStream = {
          async *[Symbol.asyncIterator]() {
            let terminal = false;
            try {
              for await (const event of source) {
                if (event.type === "error") {
                  terminal = true;
                  yield run.recover(event.error)!;
                } else {
                  if (event.type === "response") terminal = true;
                  yield event;
                }
              }
            } catch (error) {
              if (!terminal) yield run.recover(error)!;
            } finally {
              if (!terminal) {
                run.cancel();
                run.recover(new Error("STREAM_CONSUMPTION_CANCELLED"));
              }
              run.close();
            }
          },
          get events() {
            return stream;
          },
          get textStream() {
            return (async function* () {
              for await (const event of stream) {
                if (event.type === "response") yield event.text;
              }
            })();
          },
          get result() {
            return (result ??= source.result
              .catch((error) => run.recover(error)!)
              .finally(run.close));
          },
          get text() {
            return stream.result.then((outcome) => outcome.text);
          },
          steer: (input) => source.steer(input),
          cancel() {
            run.cancel();
            source.cancel();
            void stream.result;
          },
        };
        return stream;
      } catch (error) {
        run.close();
        throw error;
      }
    }
  })();
}
