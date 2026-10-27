import { describe, expect, it, vi } from "vitest";
import { createLlmModel, getReportedTokenUsage } from "../src/providers/llm.js";

const config = {
  openaiApiKey: "fixture-key",
  openaiBaseUrl: "https://fixture.invalid/v1",
  llmModel: "gpt-6-luna",
  llmApi: "chat" as const,
  maxExecutionMs: 1000,
};
const request = {
  documents: [],
  tools: [],
  chatHistory: [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: "probe" }],
    },
  ],
};

describe("LLM provider factory", () => {
  it("uses configured Chat endpoint/model and maps usage without real I/O", async () => {
    const fakeFetch = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe("https://fixture.invalid/v1/chat/completions");
      expect(JSON.parse(String(init?.body)).model).toBe(config.llmModel);
      return Response.json({
        id: "fixture",
        object: "chat.completion",
        created: 0,
        model: config.llmModel,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "fixture answer" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      });
    });
    const result = await createLlmModel(config, fakeFetch).completion(request);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(result.choice).toContainEqual({
      type: "text",
      text: "fixture answer",
    });
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(4);
  });
  it.each([429, 500, 503])("does not retry HTTP %s", async (status) => {
    const fakeFetch = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { message: "fixture failure" } }, { status }),
    );
    await expect(
      createLlmModel(config, fakeFetch).completion(request),
    ).rejects.toThrow();
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });
  it("forwards cancellation before HTTP I/O", async () => {
    const fakeFetch = vi.fn<typeof fetch>();
    await expect(
      createLlmModel(config, fakeFetch).completion(request, {
        abortSignal: AbortSignal.abort(),
      }),
    ).rejects.toThrow();
    expect(fakeFetch).not.toHaveBeenCalled();
  });
  it("does not invent token usage when the gateway omits it", async () => {
    const fakeFetch: typeof fetch = async () =>
      Response.json({
        id: "fixture",
        object: "chat.completion",
        created: 0,
        model: config.llmModel,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "answer" },
            finish_reason: "stop",
          },
        ],
      });
    const result = await createLlmModel(config, fakeFetch).completion(request);
    expect(getReportedTokenUsage(result.rawResponse)).toEqual({
      inputTokens: null,
      outputTokens: null,
    });
  });
  it("validates raw gateway token usage before logging it", () => {
    expect(
      getReportedTokenUsage({
        usage: { prompt_tokens: 0, completion_tokens: 4 },
      }),
    ).toEqual({ inputTokens: 0, outputTokens: 4 });
    for (const value of [null, -1, "fixture-secret", Infinity, 0.5]) {
      expect(
        getReportedTokenUsage({ usage: { prompt_tokens: value } }),
      ).toEqual({ inputTokens: null, outputTokens: null });
    }
  });
});
