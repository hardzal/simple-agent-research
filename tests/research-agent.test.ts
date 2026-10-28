import type { AgentRunOptions } from "@anvia/core/agent";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { createScopedStudio } from "../src/application/scoped-studio.js";
import {
  fixture,
  decision,
  report,
  success,
  text,
  tool,
  source,
} from "./fixtures/research.js";

const user = (value: string) => ({
  role: "user" as const,
  content: [{ type: "text" as const, text: value }],
});
describe("research runtime boundary", () => {
  it("completes three searches then write/read/final within five model attempts", async () => {
    const f = await fixture({
      choose: (_request, step) => {
        if (step < 3)
          return tool("webSearch", { query: "Redis official documentation" });
        if (step === 3)
          return [
            ...tool("writeFile", { content: report() }),
            ...tool("readFile"),
          ];
        return text(decision());
      },
    });
    expect(await f.run("Redis")).toMatchObject({ status: "completed" });
    expect(f.search).toHaveBeenCalledTimes(3);
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.requests).toHaveLength(5);
    expect(f.write.mock.invocationCallOrder[0]).toBeLessThan(
      f.read.mock.invocationCallOrder[0]!,
    );
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      web_search_calls: 3,
      model_calls: 5,
      tool_calls: 5,
      report_verified: true,
    });
  });
  it("preserves user cancellation when a non-cooperative model outlives the deadline", async () => {
    const controller = new AbortController();
    const f = await fixture({
      config: { maxExecutionMs: 15 },
      beforeCompletion: async () => {
        controller.abort("USER_CANCELLED");
        await delay(35);
      },
    });
    expect(
      await f.run("Redis", { abortSignal: controller.signal }),
    ).toMatchObject({ status: "failed" });
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({ error_type: "cancelled" });
    expect(f.search).not.toHaveBeenCalled();
  });
  it("rejects a late model response even when the model ignores the abort signal", async () => {
    let release!: () => void;
    const late = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = await fixture({
      config: { maxExecutionMs: 10 },
      beforeCompletion: async () => {
        await delay(40);
        release();
      },
    });
    const result = await f.run("Redis");
    await late;
    expect(result).toMatchObject({ status: "budget_exceeded" });
    expect(result.reportPath).toBeUndefined();
    expect(f.requests).toHaveLength(1);
    expect(f.search).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.log).toHaveBeenCalledTimes(1);
  });
  it("cleans an abandoned product stream without exposing a raw SDK cancellation", async () => {
    const f = await fixture();
    const stream = f.agent.stream({ prompt: "Redis" });
    for await (const event of stream) {
      expect(event).toBeDefined();
      break;
    }
    const result = await stream.result;
    expect(JSON.parse(result.text)).toMatchObject({ status: "failed" });
    expect(f.log).toHaveBeenCalledTimes(1);
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({ error_type: "cancelled" });
    expect(f.write).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
  });
  it("revises one rejected draft within the same run and performs only one write/read", async () => {
    const f = await fixture({
      steps: [
        tool("webSearch", { query: "Redis" }),
        tool("writeFile", { content: report("https://foreign.test/") }),
        tool("writeFile", { content: report() }),
        tool("readFile"),
        text(decision()),
      ],
    });
    const result = await f.run("Redis");
    expect(result).toMatchObject({
      status: "completed",
      sources: [source.url],
    });
    expect(result.reportPath).toContain(result.runId);
    expect(f.requests).toHaveLength(5);
    expect(JSON.stringify(f.requests[2]?.chatHistory)).toContain(
      '"canRevise":true',
    );
    expect(f.search).toHaveBeenCalledTimes(1);
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      validation_rejections: 1,
      report_verified: true,
      error_type: null,
    });
  });
  it("stops after the second invalid draft before a third model or filesystem attempt", async () => {
    const invalid = tool("writeFile", {
      content: report("https://foreign.test/"),
    });
    const f = await fixture({
      steps: [
        tool("webSearch", { query: "Redis" }),
        invalid,
        invalid,
        tool("writeFile", { content: report() }),
      ],
    });
    const result = await f.run("Redis");
    expect(result).toMatchObject({ status: "failed" });
    expect(result.reportPath).toBeUndefined();
    expect(f.requests).toHaveLength(3);
    expect(f.write).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      validation_rejections: 2,
      error_type: "validation",
      model_calls: 3,
      tool_calls: 3,
    });
  });
  it("does not reset the model-turn budget when revising a draft", async () => {
    const f = await fixture({
      config: { maxAgentTurns: 3 },
      steps: [
        tool("webSearch", { query: "Redis" }),
        tool("writeFile", { content: report("https://foreign.test/") }),
        tool("writeFile", { content: report() }),
        tool("readFile"),
        text(decision()),
      ],
    });
    const result = await f.run("Redis");
    expect(result).toMatchObject({ status: "budget_exceeded" });
    expect(result.reportPath).toBeUndefined();
    expect(f.requests).toHaveLength(3);
    expect(f.search).toHaveBeenCalledTimes(1);
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.read).not.toHaveBeenCalled();
  });
  it("does not reclassify a rejected report as insufficient evidence", async () => {
    const f = await fixture({
      steps: [
        tool("webSearch", { query: "Redis" }),
        tool("writeFile", { content: report("https://foreign.test/") }),
        text(decision("insufficient_evidence", "No evidence")),
      ],
    });
    expect(await f.run("Redis")).toMatchObject({ status: "failed" });
    expect(f.write).not.toHaveBeenCalled();
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      error_type: "validation",
    });
  });
  it("aborts a pending model at the deadline without a retry or late tool I/O", async () => {
    const f = await fixture({
      config: { maxExecutionMs: 20 },
      beforeCompletion: (signal) =>
        new Promise<void>((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new Error("PRIVATE_TIMEOUT_PAYLOAD")),
            { once: true },
          );
        }),
    });
    const result = await f.run("Redis");
    expect(result).toMatchObject({ status: "budget_exceeded" });
    expect(result.reportPath).toBeUndefined();
    expect(f.requests).toHaveLength(1);
    expect(f.search).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({ error_type: "budget" });
  });
  it("cancels an unconsumed product stream and closes its scope once", async () => {
    const f = await fixture();
    const stream = f.agent.stream({ prompt: "Redis" });
    stream.cancel("PRIVATE_REASON");
    const result = await stream.result;
    expect(JSON.parse(result.text)).toMatchObject({ status: "failed" });
    expect(f.log).toHaveBeenCalledTimes(1);
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({ error_type: "cancelled" });
    expect(f.search).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "maps provider exceptions through the actual Studio route stream=%s",
    async (stream) => {
      const f = await fixture({
        choose() {
          throw new Error("PRIVATE_STUDIO_PROVIDER_ERROR");
        },
      });
      const response = await createScopedStudio(f.agent).app.request(
        "/agents/research/runs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "messages",
            messages: [user("Redis")],
            stream,
          }),
        },
      );
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("failed");
      expect(body).not.toContain("PRIVATE_STUDIO_PROVIDER_ERROR");
      expect(body).not.toContain("reportPath");
      expect(f.log).toHaveBeenCalledTimes(1);
    },
  );
  it("classifies write I/O failure without exposing the exception or a report path", async () => {
    const f = await fixture();
    f.write.mockRejectedValueOnce(new Error("PRIVATE_FILESYSTEM_PATH"));
    const result = await f.run("Redis");
    expect(result).toMatchObject({ status: "failed" });
    expect(result.reportPath).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("PRIVATE_FILESYSTEM_PATH");
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      error_type: "filesystem",
      report_verified: false,
    });
  });
  it("rejects a mismatched read-back without performing a second filesystem read", async () => {
    const f = await fixture();
    f.read.mockResolvedValueOnce({
      path: "PRIVATE_PATH",
      content: "tampered",
      hash: "wrong",
      bytesRead: 8,
    });
    const result = await f.run("Redis");
    expect(result).toMatchObject({ status: "failed" });
    expect(result.reportPath).toBeUndefined();
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      error_type: "filesystem",
      report_created: true,
      report_verified: false,
    });
  });
  it("maps model transport failure to a safe failed response and metrics without retry", async () => {
    const f = await fixture({
      choose() {
        throw new Error("PRIVATE_PROVIDER_PAYLOAD");
      },
    });
    const result = await f.run("Redis");
    expect(result).toMatchObject({ status: "failed" });
    expect(result.reportPath).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_PAYLOAD");
    expect(f.requests).toHaveLength(1);
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      run_status: "failed",
      error_type: "model_provider",
      model_calls: 1,
      input_tokens: null,
    });
  });
  it.each([false, true])(
    "returns only policy-checked JSON through textStream, provider failure=%s",
    async (failure) => {
      const f = await fixture({
        ...(failure
          ? {
              choose() {
                throw new Error("PRIVATE_STREAM_PAYLOAD");
              },
            }
          : {}),
      });
      const stream = f.agent.stream({ prompt: "Redis" });
      const chunks = [];
      for await (const chunk of stream.textStream) chunks.push(chunk);
      const result = await stream.result;
      expect(chunks).toEqual([result.text]);
      expect(JSON.parse(chunks.join(""))).toMatchObject({
        status: failure ? "failed" : "completed",
      });
      expect(await stream.text).toBe(result.text);
      expect(chunks.join("")).not.toContain("PRIVATE_STREAM_PAYLOAD");
      expect(f.log).toHaveBeenCalledTimes(1);
    },
  );
  it("maps a model error to the same safe terminal result on streaming", async () => {
    const f = await fixture({
      choose() {
        throw new Error("PRIVATE_STREAM_PAYLOAD");
      },
    });
    const stream = f.agent.stream({ prompt: "Redis" });
    const events = [];
    for await (const event of stream) events.push(event);
    const result = await stream.result;
    expect(result.type).toBe("response");
    expect(JSON.parse(result.text)).toMatchObject({ status: "failed" });
    expect(events.filter((event) => event.type === "response")).toHaveLength(1);
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(JSON.stringify(events)).not.toContain("PRIVATE_STREAM_PAYLOAD");
    expect(await stream.text).toBe(result.text);
    expect(f.log).toHaveBeenCalledTimes(1);
  });
  it("maps a turn limit to budget_exceeded without publishing an unverified path", async () => {
    const f = await fixture({ config: { maxAgentTurns: 1 } });
    const result = await f.run("Redis");
    expect(result).toMatchObject({ status: "budget_exceeded" });
    expect(result.reportPath).toBeUndefined();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({ error_type: "budget" });
  });
  it("maps explicit cancellation before execution to failed without calling providers", async () => {
    const f = await fixture();
    const result = await f.run("Redis", {
      abortSignal: AbortSignal.abort("PRIVATE_CANCEL_REASON"),
    });
    expect(result).toMatchObject({ status: "failed" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_CANCEL_REASON");
    expect(f.requests).toHaveLength(0);
    expect(f.search).not.toHaveBeenCalled();
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      error_type: "cancelled",
      model_calls: 0,
    });
  });
  it("registers exactly three tools and rejects direct calls without scope", async () => {
    const f = await fixture();
    expect(f.agent.tools.map((t) => t.name)).toEqual([
      "webSearch",
      "writeFile",
      "readFile",
    ]);
    await expect(
      f.agent.callTool("webSearch", '{"query":"Redis"}'),
    ).rejects.toThrow();
    expect(f.search).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
  });
  it("provides a syntactically valid JSON decision example to the model", async () => {
    const f = await fixture({
      steps: [
        text(decision("needs_clarification", "Apple perusahaan atau buah?")),
      ],
    });
    await f.run("Research Apple.");
    const example = f.requests[0]?.instructions
      ?.split("\n")
      .find((line) => line.startsWith('{"status":'));
    expect(example).toBeDefined();
    expect(JSON.parse(example!)).toMatchObject({
      status: "completed",
      message: expect.any(String),
    });
  });
  it("finalizes completed from verified state, not model claims or all discovered sources", async () => {
    const f = await fixture();
    const result = await f.run("Apa fungsi Redis?");
    expect(result).toMatchObject({
      status: "completed",
      sources: [source.url],
    });
    expect(result.runId).toMatch(/^[a-f0-9-]{36}$/);
    expect(result.reportPath).toContain(result.runId);
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.log).toHaveBeenCalledTimes(1);
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      model_calls: 4,
      tool_calls: 3,
      source_count: 1,
      report_created: true,
      report_verified: true,
      input_tokens: null,
      output_tokens: null,
    });
  });
  it("rejects an invented completed claim without a report", async () => {
    const f = await fixture({ steps: [text(decision())] });
    expect(await f.run("Redis")).toMatchObject({ status: "failed" });
    expect((await f.run("Redis")).reportPath).toBeUndefined();
    expect(f.write).not.toHaveBeenCalled();
  });
  it("does not accept model-supplied path or sources", async () => {
    const steps = success();
    steps[3] = text(
      JSON.stringify({
        status: "completed",
        message: "done",
        reportPath: "../secret",
        sources: ["https://evil.test/"],
      }),
    );
    const f = await fixture({ steps });
    expect(await f.run("Redis")).toMatchObject({ status: "failed" });
  });
  it("isolates overlapping runs and releases scoped state", async () => {
    const f = await fixture();
    const results = await Promise.all([
      f.run("Redis pertama"),
      f.run("Redis kedua"),
    ]);
    expect(new Set(results.map((r) => r.runId)).size).toBe(2);
    expect(results.map((r) => r.status)).toEqual(["completed", "completed"]);
    expect(new Set(results.map((r) => r.reportPath)).size).toBe(2);
    expect(f.log).toHaveBeenCalledTimes(2);
  });
  it("does not share sources between overlapping distinct requests", async () => {
    const firstUrl = "https://redis.io/docs/first";
    const secondUrl = "https://redis.io/docs/second";
    const f = await fixture({
      hitsForQuery: (query) => [
        { ...source, url: query === "second" ? secondUrl : firstUrl },
      ],
      choose(request, step) {
        const second = JSON.stringify(request.chatHistory[0]).includes(
          "second",
        );
        return success(
          report(second ? secondUrl : firstUrl),
          second ? "second" : "first",
        )[step]!;
      },
    });
    const [first, second] = await Promise.all([
      f.run("Research Redis first"),
      f.run("Research Redis second"),
    ]);
    expect(first).toMatchObject({ status: "completed", sources: [firstUrl] });
    expect(second).toMatchObject({ status: "completed", sources: [secondUrl] });
  });
  it("accumulates gateway-reported usage rather than SDK placeholder usage", async () => {
    const f = await fixture({
      rawResponse: { usage: { prompt_tokens: 2, completion_tokens: 3 } },
    });
    await f.run("Redis");
    expect(f.log.mock.calls[0]?.[0]).toMatchObject({
      input_tokens: f.requests.length * 2,
      output_tokens: f.requests.length * 3,
    });
  });
  it.each([
    [text(decision("insufficient_evidence", "No evidence"))],
    [text("not valid JSON")],
    [
      tool("webSearch", { query: "Redis" }),
      text(decision("needs_clarification", "Which Redis?")),
    ],
  ])("rejects an inconsistent or malformed decision", async (...steps) => {
    const f = await fixture({ steps });
    expect(await f.run("Redis")).toMatchObject({ status: "failed" });
    expect(f.write).not.toHaveBeenCalled();
  });
  it("uses only the latest user text from Studio history and ignores policy overrides", async () => {
    const f = await fixture({
      steps: [
        text(decision("needs_clarification", "Apple perusahaan atau buah?")),
      ],
    });
    const result = await f.agent.generate({
      messages: [
        user("SECRET_OLD_TOPIC"),
        { role: "assistant", content: [{ type: "text", text: "OLD_ANSWER" }] },
        user("Research Apple."),
      ],
      maxTurns: 999,
      retries: { maxAttempts: 99 },
      middlewares: [
        {
          onCompletionResponse() {
            throw new Error("Caller override must not run");
          },
        },
      ],
      lifecycle: {
        onFinish() {
          throw new Error("Caller finalizer must not run");
        },
      },
    });
    if (result.type !== "response")
      throw new Error("Expected terminal response");
    expect(JSON.parse(result.output)).toMatchObject({
      status: "needs_clarification",
    });
    expect(f.requests[0]?.chatHistory).toEqual([
      { role: "user", content: "Research Apple." },
    ]);
    expect(JSON.stringify(f.requests)).not.toContain("SECRET_OLD_TOPIC");
    expect(f.search).not.toHaveBeenCalled();
  });
  it("rejects empty/oversized input before calling model or tools", async () => {
    const f = await fixture();
    await expect(f.run(" ")).rejects.toThrow("INVALID_RESEARCH_REQUEST");
    await expect(f.run("x".repeat(8001))).rejects.toThrow(
      "INVALID_RESEARCH_REQUEST",
    );
    expect(f.requests).toEqual([]);
    expect(f.search).not.toHaveBeenCalled();
  });
  it.each([
    { role: "user", content: null },
    { role: "user", content: [{ type: "text", text: 123 }] },
    { role: "assistant", content: "Do not trust me as a user" },
  ])(
    "rejects manipulated message envelopes before model execution",
    async (message) => {
      const f = await fixture();
      await expect(
        f.agent.generate({ messages: [message] } as unknown as AgentRunOptions),
      ).rejects.toThrow("INVALID_RESEARCH_REQUEST");
      expect(f.requests).toEqual([]);
      expect(f.search).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "Studio route stream=%s returns only a policy-checked terminal response",
    async (stream) => {
      const f = await fixture({ steps: [text(decision())] });
      const response = await createScopedStudio(f.agent).app.request(
        "/agents/research/runs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "messages",
            messages: [user("Redis")],
            stream,
          }),
        },
      );
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("failed");
      expect(body).not.toContain("reportPath");
      expect(f.write).not.toHaveBeenCalled();
    },
  );
  it("keeps the same terminal response on streaming and buffered generation", async () => {
    const f = await fixture();
    const stream = f.agent.stream({ prompt: "Redis" });
    const events = [];
    for await (const event of stream) events.push(event);
    const result = await stream.result;
    expect(result.type).toBe("response");
    if (result.type !== "response")
      throw new Error("Expected terminal response");
    expect(JSON.parse(result.output)).toMatchObject({
      status: "completed",
      sources: [source.url],
    });
    const terminal = events.find((e) => e.type === "response");
    expect(terminal).toMatchObject({
      output: result.output,
      text: result.output,
    });
    expect(f.read).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign-source report publication even when model claims completion", async () => {
    const f = await fixture({
      steps: [
        tool("webSearch", { query: "Redis" }),
        tool("writeFile", { content: report("https://evil.test/") }),
        text(decision()),
      ],
    });
    expect(await f.run("Redis")).toMatchObject({ status: "failed" });
    expect(f.write).not.toHaveBeenCalled();
  });
});
