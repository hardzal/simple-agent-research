import { describe, expect, it, vi } from "vitest";
import { Usage, type StreamingCompletionModel } from "@anvia/core/completion";
import { createScopedAgent } from "../src/application/scoped-agent.js";
import { parseConfig } from "../src/config/index.js";
import { createResearchTools } from "../src/tools/research-tools.js";

const config = parseConfig({
  OPENAI_API_KEY: "fixture",
  TAVILY_API_KEY: "fixture",
});
const cases: {
  name: string;
  toolName: string;
  input: Record<string, string>;
  searchCalls: number;
  providerFails?: boolean;
}[] = [
  {
    name: "oversized search rejected by SDK schema",
    toolName: "webSearch",
    input: { query: "x".repeat(501) },
    searchCalls: 0,
  },
  {
    name: "write path rejected by SDK schema",
    toolName: "writeFile",
    input: { content: "fixture", path: "../outside" },
    searchCalls: 0,
  },
  {
    name: "read path rejected by SDK schema",
    toolName: "readFile",
    input: { path: "../outside" },
    searchCalls: 0,
  },
  {
    name: "valid search counted once",
    toolName: "webSearch",
    input: { query: "Redis" },
    searchCalls: 1,
  },
  {
    name: "failed provider search counted once",
    toolName: "webSearch",
    input: { query: "Redis" },
    searchCalls: 1,
    providerFails: true,
  },
];

describe.each(["generate", "stream"] as const)("%s tool attempts", (mode) => {
  it.each(cases)("counts $name before side effects", async (testCase) => {
    const search = vi.fn(async () => {
      if (testCase.providerFails) throw new Error("fixture provider failure");
      return [];
    });
    const write = vi.fn(async () => {
      throw new Error("Unexpected filesystem write");
    });
    const read = vi.fn(async () => {
      throw new Error("Unexpected filesystem read");
    });
    const closed = vi.fn();
    const model: StreamingCompletionModel = {
      provider: "fake",
      modelId: "tool-attempt-regression",
      capabilities: {
        streaming: true,
        tools: true,
        toolChoice: true,
        imageInput: false,
        documentInput: false,
        outputSchema: false,
        reasoning: false,
      },
      async completion(request) {
        const replay = request.chatHistory.some(
          (message) => message.role === "tool",
        );
        return {
          choice: replay
            ? [{ type: "text", text: "done" }]
            : [
                {
                  type: "tool-call",
                  toolCallId: "attempt-fixture",
                  toolName: testCase.toolName,
                  input: testCase.input,
                },
              ],
          usage: Usage.empty(),
          rawResponse: null,
        };
      },
      async *streamCompletion(request, options) {
        yield {
          type: "final",
          response: await this.completion(request, options),
        };
      },
    };
    const agent = createScopedAgent({
      id: "tool-attempt-regression",
      model,
      maxTurns: 2,
      maxExecutionMs: 1000,
      tools(scope) {
        return createResearchTools(scope, {
          config,
          searchProvider: { search },
          reportStore: { write, read },
        }).tools;
      },
      finalize() {},
      onClose: closed,
    });
    const settings = {
      prompt: "fixture",
      // Caller settings must not bypass the boundary's attempt accounting.
      middlewares: [],
    };
    const result =
      mode === "generate"
        ? await agent.generate(settings)
        : await agent.stream(settings).result;
    expect(result.type).toBe("response");
    expect(closed).toHaveBeenCalledTimes(1);
    expect(closed.mock.calls[0]?.[0]).toMatchObject({
      toolCalls: 1,
      modelCalls: 2,
    });
    expect(search).toHaveBeenCalledTimes(testCase.searchCalls);
    expect(write).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
