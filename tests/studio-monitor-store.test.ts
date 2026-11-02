import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runEvalSuite, EvalOutcome } from "@anvia/core/evals";
import { createStudioMonitor } from "../src/services/studio-monitor.js";
import { createOfflineResearchEvalSuite } from "../src/evaluation/offline-research.js";
import type { RunMetricsSnapshot } from "../src/services/run-metrics.js";

const metric = (): RunMetricsSnapshot => ({
  runId: randomUUID(),
  sdk_run_id: randomUUID(),
  run_status: "running",
  run_duration_ms: 0,
  model_calls: 1,
  tool_calls: 0,
  input_tokens: null,
  output_tokens: null,
  web_search_calls: 0,
  source_count: 0,
  report_created: false,
  report_verified: false,
  error_type: null,
  validation_rejections: 0,
  search_successes: 0,
});

describe("bounded Studio monitor", () => {
  it("bounds history, ages it out, strips payloads, and returns defensive copies", () => {
    let now = 0;
    const store = createStudioMonitor({
      maxRuns: 2,
      maxEvalRuns: 1,
      ttlMs: 100,
      now: () => now,
    });
    for (let i = 0; i < 3; i++) {
      store.recordMetrics({
        ...metric(),
        secret: "PRIVATE_SECRET",
      } as RunMetricsSnapshot);
    }
    const snapshot = store.snapshot();
    expect(snapshot.runs).toHaveLength(2);
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE_SECRET");
    snapshot.runs[0]!.model_calls = 999;
    expect(store.snapshot().runs[0]!.model_calls).toBe(1);
    now = 50;
    expect(store.snapshot().runs[0]!.run_duration_ms).toBe(50);
    now = 101;
    expect(store.snapshot().runs).toEqual([]);
  });

  it("does not regress terminal metrics and discards malformed metrics safely", () => {
    const store = createStudioMonitor();
    const value = metric();
    store.recordMetrics({
      ...value,
      run_status: "failed",
      error_type: "model_provider",
    });
    store.recordMetrics(value);
    store.recordMetrics({ ...metric(), sdk_run_id: "PRIVATE_SECRET" });
    expect(store.snapshot().runs).toHaveLength(1);
    expect(store.snapshot().runs[0]!.run_status).toBe("failed");
  });

  it("shows eval progress before completion, keeps native required failures and errors, and bounds retention", async () => {
    const store = createStudioMonitor({ maxEvalRuns: 1 });
    const suite = createOfflineResearchEvalSuite();
    let began!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = runEvalSuite({
      ...suite,
      reporters: [store.evalReporter],
      target: async (...args) => {
        began();
        await gate;
        return suite.target(...args);
      },
    });
    try {
      await started;
      expect(store.snapshot().evalRuns[0]).toMatchObject({
        status: "running",
        totalCases: 5,
        completedCases: 0,
      });
    } finally {
      release();
    }
    await pending;
    expect(store.snapshot().evalRuns[0]).toMatchObject({
      status: "passed",
      completedCases: 5,
    });
    await runEvalSuite({
      ...suite,
      reporters: [store.evalReporter],
      metrics: [
        { ...suite.metrics[0], evaluate: () => EvalOutcome.fail(false) },
        { ...suite.metrics[1], evaluate: () => EvalOutcome.pass(100) },
      ],
    });
    expect(store.snapshot().evalRuns).toHaveLength(1);
    expect(store.snapshot().evalRuns[0]).toMatchObject({
      status: "failed",
      totals: { failed: 5 },
    });
    await runEvalSuite({
      ...suite,
      reporters: [store.evalReporter],
      target() {
        throw new Error("PRIVATE_PROVIDER_SECRET");
      },
    });
    expect(store.snapshot().evalRuns[0]).toMatchObject({
      status: "failed",
      totals: { invalid: 5 },
    });
    expect(JSON.stringify(store.snapshot())).not.toMatch(
      /PRIVATE|rawResponse|reportPath/,
    );
  });
});
