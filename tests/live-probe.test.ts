import { describe, expect, it, vi } from "vitest";
import {
  Usage,
  type CompletionRequest,
  type StreamingCompletionModel,
} from "@anvia/core/completion";
import { runLiveProbe } from "../src/compatibility/live-probe.js";

const env = {
  ALLOW_LIVE_TESTS: "true",
  OPENAI_API_KEY: "fixture-key",
  TAVILY_API_KEY: "fixture-key",
};
function scriptedModel(replay = true): StreamingCompletionModel {
  return {
    provider: "fake",
    modelId: "scripted",
    capabilities: {
      streaming: true,
      tools: true,
      toolChoice: true,
      imageInput: false,
      documentInput: false,
      outputSchema: false,
      reasoning: false,
    },
    async completion(request: CompletionRequest) {
      const toolResult = request.chatHistory.findLast(
        (message) => message.role === "tool",
      );
      const result = toolResult?.content[0];
      const text =
        result?.type === "tool-result" &&
        "output" in result &&
        result.output.type === "text"
          ? result.output.value
          : "";
      const choice = toolResult
        ? [
            {
              type: "text" as const,
              text: replay ? `LIVE-01:${JSON.parse(text).nonce}` : "invented",
            },
          ]
        : [
            {
              type: "tool-call" as const,
              toolName: "compatibilityStamp",
              toolCallId: "fixture-call",
              input: {},
            },
          ];
      return { choice, usage: Usage.empty(), rawResponse: {} };
    },
    async *streamCompletion(request, options) {
      yield {
        type: "final",
        response: await this.completion(request, options),
      };
    },
  };
}

describe("guarded LIVE-01 runner, tested entirely offline", () => {
  it.each([
    { args: [] },
    { args: ["--case", "LIVE-02"] },
    { args: ["--case", "LIVE-01", "--retry"] },
  ])(
    "rejects unsupported invocation $args before constructing a provider",
    async ({ args }) => {
      const factory = vi.fn(() => scriptedModel());
      await expect(runLiveProbe(args, env, factory)).rejects.toThrow(
        "LIVE_CASE",
      );
      expect(factory).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "false", "TRUE"])(
    "requires exact opt-in, not %s",
    async (allow) => {
      const factory = vi.fn(() => scriptedModel());
      await expect(
        runLiveProbe(
          ["--case", "LIVE-01"],
          { ...env, ALLOW_LIVE_TESTS: allow },
          factory,
        ),
      ).rejects.toThrow("ALLOW_LIVE_TESTS");
      expect(factory).not.toHaveBeenCalled();
    },
  );
  it("verifies nonce tool replay in one bounded run and reports missing usage as null", async () => {
    const factory = vi.fn(() => scriptedModel());
    const result = await runLiveProbe(["--case", "LIVE-01"], env, factory);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      caseId: "LIVE-01",
      outcome: "passed",
      modelCalls: 2,
      toolCalls: 1,
      inputTokens: null,
      outputTokens: null,
      api: "chat",
    });
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(result)).not.toContain("fixture-key");
  });
  it("rejects an invented final answer instead of declaring compatibility", async () => {
    await expect(
      runLiveProbe(["--case", "LIVE-01"], env, () => scriptedModel(false)),
    ).rejects.toMatchObject({
      message: "LIVE_REPLAY",
      evidence: {
        outcome: "failed",
        errorType: "LIVE_REPLAY",
        modelCalls: 2,
        toolCalls: 1,
        finalStatus: "completed",
        nonceMatched: false,
        nonceIncluded: false,
      },
    });
  });
  it("provides an exact final response to copy instead of asking the model to compose it", async () => {
    const model = scriptedModel();
    const completion = model.completion.bind(model);
    model.completion = async (request, options) => {
      const result = request.chatHistory.findLast(
        (message) => message.role === "tool",
      )?.content[0];
      if (result?.type === "tool-result" && result.output.type === "text") {
        const output = JSON.parse(result.output.value);
        expect(output.finalResponse).toBe(`LIVE-01:${output.nonce}`);
        expect(request.instructions).toContain("Copy finalResponse verbatim");
      }
      return completion(request, options);
    };
    await expect(
      runLiveProbe(["--case", "LIVE-01"], env, () => model),
    ).resolves.toMatchObject({ outcome: "passed" });
  });
  it("reports provider failure safely without retrying or exposing raw errors", async () => {
    const model = scriptedModel();
    const completion = vi.fn(async () => {
      throw new Error("fixture-key private provider response");
    });
    model.completion = completion;
    const error = await runLiveProbe(
      ["--case", "LIVE-01"],
      env,
      () => model,
    ).catch((failure: unknown) => failure);
    expect(error).toMatchObject({
      message: "LIVE_PROBE_FAILED",
      evidence: { outcome: "failed", modelCalls: 1, toolCalls: 0 },
    });
    expect(completion).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error)).not.toContain("fixture-key");
    expect(String(error)).not.toContain("private provider response");
  });
});
