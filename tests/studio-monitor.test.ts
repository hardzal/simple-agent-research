import { describe, expect, it } from "vitest";
import { createResearchStudio } from "../src/application/studio-server.js";
import { config, fixture, decision, text, tool } from "./fixtures/research.js";

async function monitored(options: Parameters<typeof fixture>[0] = {}) {
  const f = await fixture(options);
  const studio = await createResearchStudio(
    { ...config, ...options.config, reportsDir: f.root },
    {
      model: f.model,
      searchProvider: { search: f.search },
      reportStore: { write: f.write, read: f.read },
      logger: { log: f.log },
    },
  );
  return { ...f, studio };
}
const run = (stream = false) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "messages",
    messages: [{ role: "user", content: "PRIVATE_PROMPT Redis" }],
    stream,
    maxTurns: 999,
  }),
});
async function state(studio: Awaited<ReturnType<typeof monitored>>["studio"]) {
  const response = await studio.app.request("/research-monitor/state");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return response.json();
}

describe("Studio metrics and evaluation monitor", () => {
  it("registers the offline suite and serves an explicit developer monitor without provider calls", async () => {
    const f = await monitored();
    const suites = await f.studio.app.request("/evals");
    expect(await suites.json()).toMatchObject({
      evals: [{ id: "research-offline", caseCount: 5 }],
    });
    const page = await f.studio.app.request("/research-monitor");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Metrics &amp; Evals");
    const script = await f.studio.app.request("/research-monitor/client.js");
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("javascript");
    expect(await state(f.studio)).toMatchObject({ runs: [], evalRuns: [] });
    expect(f.requests).toHaveLength(0);
    expect(f.search).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(await (await f.studio.app.request("/status")).json()).toMatchObject({
      storage: {},
    });
  });

  it.each([false, true])(
    "shows in-flight and terminal metrics without bypassing policy, stream=%s",
    async (stream) => {
      let release!: () => void;
      let began!: () => void;
      const started = new Promise<void>((resolve) => {
        began = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const f = await monitored({
        async beforeCompletion() {
          began();
          await gate;
        },
      });
      const pending = Promise.resolve(
        f.studio.app.request("/agents/research/runs", run(stream)),
      ).then((response) => response.text());
      try {
        await started;
        const live = await state(f.studio);
        expect(live.runs).toHaveLength(1);
        expect(live.runs[0]).toMatchObject({
          run_status: "running",
          model_calls: 1,
          tool_calls: 0,
          input_tokens: null,
          output_tokens: null,
          report_verified: false,
        });
        expect(live.runs[0].sdk_run_id).toBeTypeOf("string");
      } finally {
        release();
      }
      expect(await pending).toContain("completed");
      const done = await state(f.studio);
      expect(done.runs).toHaveLength(1);
      expect(done.runs[0]).toMatchObject({
        run_status: "completed",
        model_calls: 4,
        tool_calls: 3,
        web_search_calls: 1,
        search_successes: 1,
        report_created: true,
        report_verified: true,
        input_tokens: null,
        output_tokens: null,
        source_count: 1,
      });
      expect(JSON.stringify(done)).not.toMatch(
        /PRIVATE_PROMPT|redis\.io|reportPath|chatHistory|rawResponse/,
      );
      expect(f.write).toHaveBeenCalledOnce();
      expect(f.read).toHaveBeenCalledOnce();
      expect(f.log).toHaveBeenCalledOnce();
    },
  );

  it("preserves model budget and invalid-tool attempt accounting with monitoring enabled", async () => {
    const f = await monitored({
      config: { maxAgentTurns: 1 },
      steps: [tool("webSearch", {})],
    });
    await f.studio.app.request("/agents/research/runs", run());
    expect((await state(f.studio)).runs[0]).toMatchObject({
      run_status: "budget_exceeded",
      error_type: "budget",
      model_calls: 1,
      tool_calls: 1,
      web_search_calls: 0,
      report_verified: false,
    });
    expect(f.search).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
  });

  it("does not create metrics or side effects for unscoped direct-tool calls", async () => {
    const f = await monitored();
    const result = await f.studio.app.request(
      "/agents/research/tools/webSearch/runs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: { query: "Redis" } }),
      },
    );
    expect(result.status).toBe(500);
    expect((await state(f.studio)).runs).toEqual([]);
    expect(f.search).not.toHaveBeenCalled();
    expect(f.requests).toHaveLength(0);
  });

  it("ignores a failing telemetry callback without replacing a verified outcome or retrying", async () => {
    const f = await fixture();
    const studio = await createResearchStudio(
      { ...config, reportsDir: f.root },
      {
        model: f.model,
        searchProvider: { search: f.search },
        reportStore: { write: f.write, read: f.read },
        logger: { log: f.log },
        onMetrics() {
          throw new Error("PRIVATE_SINK_ERROR");
        },
      },
    );
    const response = await studio.app.request("/agents/research/runs", run());
    expect(await response.text()).toContain("completed");
    expect((await state(studio)).runs[0]).toMatchObject({
      run_status: "completed",
      report_verified: true,
    });
    expect(f.requests).toHaveLength(4);
    expect(f.write).toHaveBeenCalledOnce();
    expect(f.read).toHaveBeenCalledOnce();
  });

  it("shows safe provider failures and does not retry", async () => {
    const f = await monitored({
      choose() {
        throw new Error("PRIVATE_PROVIDER_SECRET");
      },
    });
    await f.studio.app.request("/agents/research/runs", run());
    const snapshot = await state(f.studio);
    expect(snapshot.runs[0]).toMatchObject({
      run_status: "failed",
      error_type: "model_provider",
      model_calls: 1,
      input_tokens: null,
      output_tokens: null,
    });
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE");
    expect(f.requests).toHaveLength(1);
  });

  it("keeps separate Studio instances and overlapping requests isolated", async () => {
    const a = await monitored({
      steps: [text(decision("needs_clarification", "Which Apple?"))],
    });
    const b = await monitored();
    await Promise.all([
      a.studio.app.request("/agents/research/runs", run()),
      a.studio.app.request("/agents/research/runs", run()),
    ]);
    const observed = await state(a.studio);
    expect(observed.runs).toHaveLength(2);
    expect(
      new Set(observed.runs.map((entry: { runId: string }) => entry.runId))
        .size,
    ).toBe(2);
    expect(
      observed.runs.every(
        (entry: { run_status: string }) =>
          entry.run_status === "needs_clarification",
      ),
    ).toBe(true);
    expect((await state(b.studio)).runs).toEqual([]);
    expect(a.search).not.toHaveBeenCalled();
  });

  it("runs native offline evals and exposes safe case/metric outcomes, not a live-model quality claim", async () => {
    const f = await monitored();
    const result = await f.studio.app.request("/evals/research-offline/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(result.status).toBe(200);
    const native = await result.json();
    expect(native.result.cases).toEqual({
      total: 5,
      passed: 5,
      failed: 0,
      invalid: 0,
    });
    const snapshot = await state(f.studio);
    expect(snapshot.evalRuns).toHaveLength(1);
    expect(snapshot.evalRuns[0]).toMatchObject({
      runId: native.result.run.id,
      suiteId: "research-offline",
      status: "passed",
      completedCases: 5,
      totalCases: 5,
      totals: { total: 5, passed: 5, failed: 0, invalid: 0 },
    });
    expect(snapshot.evalRuns[0].cases).toHaveLength(5);
    expect(snapshot.evalRuns[0].cases[0].metrics).toEqual([
      { name: "mandatory-contract", outcome: "pass", score: true },
      {
        name: "fixture-quality-review",
        outcome: "pass",
        score: expect.any(Number),
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /reportPath|redis\.io|written|rawResponse/,
    );
    expect(f.requests).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    expect((await f.studio.app.request("/sessions")).status).not.toBe(200);
  });
});
