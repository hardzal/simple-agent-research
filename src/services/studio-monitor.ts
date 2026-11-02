import type { EvalReporter, EvalTotals } from "@anvia/core/evals";
import { z } from "zod";
import {
  offlineResearchCaseIds,
  type OfflineResearchCaseId,
} from "../evaluation/offline-research.js";
import type { RunMetricsSnapshot } from "./run-metrics.js";

const count = z.number().int().nonnegative();
const duration = z.number().finite().nonnegative();
// Allowlist only: never keep prompts, URLs, paths, outputs, provider payloads or errors.
const metricSchema = z.object({
  runId: z.uuid(),
  sdk_run_id: z.uuid().nullable(),
  run_duration_ms: duration,
  model_calls: count,
  tool_calls: count,
  input_tokens: count.nullable(),
  output_tokens: count.nullable(),
  web_search_calls: count,
  source_count: count,
  report_created: z.boolean(),
  report_verified: z.boolean(),
  run_status: z.enum([
    "running",
    "completed",
    "needs_clarification",
    "insufficient_evidence",
    "budget_exceeded",
    "failed",
  ]),
  error_type: z
    .enum([
      "configuration",
      "validation",
      "model_provider",
      "search_provider",
      "filesystem",
      "budget",
      "cancelled",
      "invalid_output",
      "unknown",
    ])
    .nullable(),
  validation_rejections: count,
  search_successes: count,
});
type MetricOutcome = {
  name: string;
  outcome: "pass" | "fail" | "invalid";
  score: boolean | number | null;
};
type EvalSnapshot = {
  runId: string;
  suiteId: "research-offline";
  status: "running" | "passed" | "failed";
  startedAt: string;
  duration_ms: number;
  totalCases: number;
  completedCases: number;
  totals: EvalTotals | null;
  cases: { id: OfflineResearchCaseId; metrics: MetricOutcome[] }[];
};

/** Per-Studio ephemeral, bounded developer telemetry. It is not conversation memory. */
export function createStudioMonitor(
  options: {
    maxRuns?: number;
    maxEvalRuns?: number;
    ttlMs?: number;
    now?: () => number;
  } = {},
) {
  const maxRuns = options.maxRuns ?? 100;
  const maxEvalRuns = options.maxEvalRuns ?? 20;
  const ttlMs = options.ttlMs ?? 30 * 60 * 1000;
  const now = options.now ?? Date.now;
  for (const value of [maxRuns, maxEvalRuns, ttlMs]) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error("INVALID_MONITOR_LIMIT");
  }
  const runs = new Map<
    string,
    { value: RunMetricsSnapshot; touched: number }
  >();
  const evalRuns = new Map<string, { value: EvalSnapshot; touched: number }>();
  function trim<T>(
    entries: Map<string, { value: T; touched: number }>,
    limit: number,
  ) {
    const time = now();
    for (const [id, entry] of entries) {
      if (time - entry.touched >= ttlMs) entries.delete(id);
    }
    while (entries.size > limit) entries.delete(entries.keys().next().value!);
  }
  const evalReporter: EvalReporter<OfflineResearchCaseId, unknown> = {
    onRunStart(args) {
      evalRuns.set(args.run.id, {
        touched: now(),
        value: {
          runId: args.run.id,
          suiteId: "research-offline",
          status: "running",
          startedAt: args.run.startedAt,
          duration_ms: 0,
          totalCases: args.caseCount,
          completedCases: 0,
          totals: null,
          cases: offlineResearchCaseIds.map((id) => ({ id, metrics: [] })),
        },
      });
      trim(evalRuns, maxEvalRuns);
    },
    report(args) {
      if (!args.run) return;
      trim(evalRuns, maxEvalRuns);
      const entry = evalRuns.get(args.run.id);
      const target = entry?.value.cases.find(
        (item) => item.id === args.case.id,
      );
      if (
        !entry ||
        !target ||
        !["mandatory-contract", "fixture-quality-review"].includes(
          args.metric.name,
        )
      )
        return;
      const score = args.outcome.score;
      const metric: MetricOutcome = {
        name: args.metric.name,
        outcome: args.outcome.outcome,
        score:
          typeof score === "boolean" ||
          (typeof score === "number" && Number.isFinite(score))
            ? score
            : null,
      };
      const index = target.metrics.findIndex(
        (item) => item.name === metric.name,
      );
      if (index < 0) target.metrics.push(metric);
      else target.metrics[index] = metric;
      entry.value.completedCases = entry.value.cases.filter(
        (item) => item.metrics.length === 2,
      ).length;
      entry.touched = now();
    },
    onRunEnd(args) {
      const entry = evalRuns.get(args.run.id);
      if (!entry) return;
      entry.value.status =
        args.status === "completed" &&
        args.cases?.total === args.caseCount &&
        args.caseCount > 0 &&
        args.cases.passed === args.caseCount &&
        args.cases.failed === 0 &&
        args.cases.invalid === 0
          ? "passed"
          : "failed";
      entry.value.duration_ms = args.durationMs;
      entry.value.totals = args.cases ? { ...args.cases } : null;
      entry.touched = now();
      trim(evalRuns, maxEvalRuns);
    },
  };
  return {
    evalReporter,
    recordMetrics(input: RunMetricsSnapshot) {
      const parsed = metricSchema.safeParse(input);
      if (!parsed.success) return;
      trim(runs, maxRuns);
      const old = runs.get(parsed.data.runId);
      if (old && old.value.run_status !== "running") return;
      runs.delete(parsed.data.runId);
      runs.set(parsed.data.runId, { value: parsed.data, touched: now() });
      trim(runs, maxRuns);
    },
    snapshot() {
      trim(runs, maxRuns);
      trim(evalRuns, maxEvalRuns);
      return structuredClone({
        retention: { maxRuns, maxEvalRuns, ttlMs, pollIntervalMs: 500 },
        runs: [...runs.values()].reverse().map(({ value, touched }) => ({
          ...value,
          run_duration_ms:
            value.run_duration_ms +
            (value.run_status === "running" ? Math.max(0, now() - touched) : 0),
        })),
        evalRuns: [...evalRuns.values()].reverse().map(({ value }) => value),
      });
    },
  };
}
