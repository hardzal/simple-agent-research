import { describe, expect, it, vi } from "vitest";
import { setTimeout as delay } from "node:timers/promises";
import { Agent } from "@anvia/core/agent";
import {
  Usage,
  type CompletionRequest,
  type StreamingCompletionModel,
} from "@anvia/core/completion";
import { createTool } from "@anvia/core/tool";
import { z } from "zod";
import { Studio } from "@anvia/studio";
import { createScopedAgent } from "../src/application/scoped-agent.js";
import { createScopedStudio } from "../src/application/scoped-studio.js";

const requests: CompletionRequest[] = [];
const model: StreamingCompletionModel = {
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
  async completion(request, options) {
    options?.abortSignal?.throwIfAborted();
    requests.push(request);
    const replay = request.chatHistory.some(
      (message) => message.role === "tool",
    );
    return {
      choice: replay
        ? [{ type: "text", text: "done" }]
        : [
            {
              type: "tool-call",
              toolCallId: "fixture-call",
              toolName: "stamp",
              input: {},
            },
          ],
      usage: Usage.empty(),
      rawResponse: null,
    };
  },
  async *streamCompletion(request, options) {
    yield { type: "final", response: await this.completion(request, options) };
  },
};

function fixture(
  finalize = (scope: { toolCalls: number }) => {
    expect(scope.toolCalls).toBe(1);
  },
) {
  const seen: string[] = [];
  const closed: string[] = [];
  const agent = createScopedAgent({
    id: "compatibility-probe",
    model,
    maxTurns: 2,
    maxExecutionMs: 1000,
    tools: (scope) => [
      createTool({
        name: "stamp",
        description: "Record synthetic scope",
        inputSchema: z.object({}),
        execute() {
          scope.assertActive();
          scope.toolCalls++;
          seen.push(scope.runId);
          return { runId: scope.runId };
        },
      }),
    ],
    finalize,
    onClose: (scope) => closed.push(scope.runId),
  });
  return { agent, seen, closed };
}

describe("scoped SDK boundary", () => {
  it("runs the same boundary for streaming", async () => {
    const { agent, seen, closed } = fixture();
    const stream = agent.stream({ prompt: "stream" });
    const events = [];
    for await (const event of stream) events.push(event);
    expect((await stream.result).type).toBe("response");
    expect(events.some((e) => e.type === "response")).toBe(true);
    expect(seen).toHaveLength(1);
    expect(closed).toEqual(seen);
  });
  it("rejects direct tool calls without scope", async () => {
    const { agent, seen } = fixture();
    await expect(agent.callTool("stamp", "{}")).rejects.toThrow();
    expect(seen).toEqual([]);
  });
  it("cannot bypass finalization with run lifecycle overrides", async () => {
    const { agent } = fixture(() => {
      throw new Error("Rejected at finalizer");
    });
    await expect(
      agent.generate({ prompt: "reject", lifecycle: { onFinish() {} } }),
    ).rejects.toThrow("Rejected at finalizer");
    await expect(agent.stream({ prompt: "reject" }).result).rejects.toThrow(
      "Rejected at finalizer",
    );
  });
  it("registers the scoped definition in Studio", () => {
    const { agent } = fixture();
    const studio = new Studio([agent], { ui: false });
    expect(studio.config().agents.map((a) => a.id)).toContain(agent.id);
  });
  it("executes through the actual Studio route", async () => {
    const { agent, seen, closed } = fixture();
    const studio = createScopedStudio(agent);
    const response = await studio.app.request(
      "/agents/compatibility-probe/runs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "messages",
          messages: [
            { role: "user", content: [{ type: "text", text: "studio probe" }] },
          ],
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("done");
    expect(seen).toHaveLength(1);
    expect(closed).toEqual(seen);
  });
  it("executes the same boundary through Studio streaming", async () => {
    const { agent, seen, closed } = fixture();
    const studio = createScopedStudio(agent);
    const response = await studio.app.request(
      "/agents/compatibility-probe/runs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "messages",
          stream: true,
          messages: [
            { role: "user", content: [{ type: "text", text: "stream probe" }] },
          ],
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("done");
    expect(seen).toHaveLength(1);
    expect(closed).toEqual(seen);
  });
  it("does not expose session persistence in the scoped Studio", async () => {
    const { agent } = fixture();
    const response = await createScopedStudio(agent).app.request("/sessions");
    expect(response.status).not.toBe(200);
  });
  it("cleans scope on already-aborted generation", async () => {
    const { agent, seen, closed } = fixture();
    await expect(
      agent.generate({ prompt: "cancel", abortSignal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(seen).toEqual([]);
    expect(closed).toHaveLength(1);
  });
  it("cleans scope when a stream is cancelled", async () => {
    const { agent, closed } = fixture();
    const stream = agent.stream({ prompt: "cancel" });
    stream.cancel();
    await expect(stream.result).rejects.toThrow();
    expect(closed).toHaveLength(1);
  });
  it("counts a model attempt even when the provider fails and releases scope", async () => {
    const closed = vi.fn();
    const agent = createScopedAgent({
      id: "failure-probe",
      model: {
        ...model,
        async completion() {
          throw new Error("fixture provider failure");
        },
      },
      maxTurns: 2,
      maxExecutionMs: 1000,
      tools: () => [],
      finalize() {
        throw new Error("must not finalize failure");
      },
      onClose: closed,
    });
    await expect(agent.generate({ prompt: "failure" })).rejects.toThrow(
      "fixture provider failure",
    );
    expect(closed).toHaveBeenCalledTimes(1);
    expect(closed.mock.calls[0]?.[0].modelCalls).toBe(1);
  });
  it("cleans scope if scoped tool construction fails", async () => {
    const closed = vi.fn();
    const agent = createScopedAgent({
      id: "construction-probe",
      model,
      maxTurns: 2,
      maxExecutionMs: 1000,
      tools(scope) {
        if (scope.runId !== "inactive")
          throw new Error("fixture construction failure");
        return [];
      },
      finalize() {},
      onClose: closed,
    });
    await expect(agent.generate({ prompt: "failure" })).rejects.toThrow(
      "fixture construction failure",
    );
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it("enforces the deadline on a cooperative provider and releases scope", async () => {
    const closed = vi.fn();
    const agent = createScopedAgent({
      id: "deadline-probe",
      model: {
        ...model,
        async completion(_request, options) {
          await delay(5000, undefined, { signal: options?.abortSignal });
          throw new Error("must be cancelled");
        },
      },
      maxTurns: 2,
      maxExecutionMs: 10,
      tools: () => [],
      finalize() {
        throw new Error("must not finalize failure");
      },
      onClose: closed,
    });
    await expect(agent.generate({ prompt: "deadline" })).rejects.toThrow();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(closed.mock.calls[0]?.[0].signal.aborted).toBe(true);
  });
  it("isolates overlapping streams and closes both scopes", async () => {
    const { agent, seen, closed } = fixture();
    const first = agent.stream({ prompt: "first" });
    const second = agent.stream({ prompt: "second" });
    await Promise.all([first.result, second.result]);
    expect(new Set(seen).size).toBe(2);
    expect(closed.sort()).toEqual(seen.sort());
  });
  it("rejects retained tool execution after scope cleanup", async () => {
    const checks: (() => void)[] = [];
    const agent = createScopedAgent({
      id: "cleanup-probe",
      model,
      maxTurns: 2,
      maxExecutionMs: 1000,
      tools(scope) {
        if (scope.runId !== "inactive") checks.push(() => scope.assertActive());
        return [
          createTool({
            name: "stamp",
            description: "Synthetic stamp",
            inputSchema: z.object({}),
            execute() {
              scope.assertActive();
              return "ok";
            },
          }),
        ];
      },
      finalize() {},
    });
    await agent.generate({ prompt: "cleanup" });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toThrow("No active run scope");
  });
  it("isolates overlapping generate calls and finalizes before completion", async () => {
    const { agent, seen, closed } = fixture();
    expect(agent).toBeInstanceOf(Agent);
    const results = await Promise.all([
      agent.generate({ prompt: "first" }),
      agent.generate({ prompt: "second" }),
    ]);
    expect(results.map((r) => r.type)).toEqual(["response", "response"]);
    expect(new Set(seen).size).toBe(2);
    expect(closed.sort()).toEqual(seen.sort());
    expect(
      requests.some((r) => r.chatHistory.some((m) => m.role === "tool")),
    ).toBe(true);
  });
});
