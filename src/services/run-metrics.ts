export type RunStatus =
  | "completed"
  | "needs_clarification"
  | "insufficient_evidence"
  | "budget_exceeded"
  | "failed";
export type SafeErrorCategory =
  | "configuration"
  | "validation"
  | "model_provider"
  | "search_provider"
  | "filesystem"
  | "budget"
  | "cancelled"
  | "invalid_output"
  | "unknown";
export type RunMetrics = {
  runId: string;
  run_duration_ms: number;
  model_calls: number;
  input_tokens: number | null;
  output_tokens: number | null;
  web_search_calls: number;
  tool_calls: number;
  source_count: number;
  report_created: boolean;
  report_verified: boolean;
  run_status: RunStatus;
  error_type: SafeErrorCategory | null;
  validation_rejections: number;
  search_successes: number;
};
export function createRunLogger(sink: (json: string) => void) {
  return {
    log(metrics: RunMetrics): void {
      if (
        typeof metrics.runId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          metrics.runId,
        )
      )
        throw new Error("runId");
      if (
        ![
          "completed",
          "needs_clarification",
          "insufficient_evidence",
          "budget_exceeded",
          "failed",
        ].includes(metrics.run_status)
      )
        throw new Error("run_status");
      if (
        typeof metrics.run_duration_ms !== "number" ||
        !Number.isFinite(metrics.run_duration_ms) ||
        metrics.run_duration_ms < 0
      )
        throw new Error("run_duration_ms");
      for (const key of [
        "model_calls",
        "web_search_calls",
        "tool_calls",
        "source_count",
        "validation_rejections",
        "search_successes",
        "input_tokens",
        "output_tokens",
      ] as const) {
        const value = metrics[key];
        if (
          (key === "input_tokens" || key === "output_tokens") &&
          value === null
        )
          continue;
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < 0
        )
          throw new Error(key);
      }
      for (const key of ["report_created", "report_verified"] as const) {
        if (typeof metrics[key] !== "boolean") throw new Error(key);
      }
      const record: RunMetrics = {
        runId: metrics.runId,
        run_duration_ms: metrics.run_duration_ms,
        model_calls: metrics.model_calls,
        input_tokens: metrics.input_tokens,
        output_tokens: metrics.output_tokens,
        web_search_calls: metrics.web_search_calls,
        tool_calls: metrics.tool_calls,
        source_count: metrics.source_count,
        report_created: metrics.report_created,
        report_verified: metrics.report_verified,
        run_status: metrics.run_status,
        error_type:
          metrics.error_type === null ||
          [
            "configuration",
            "validation",
            "model_provider",
            "search_provider",
            "filesystem",
            "budget",
            "cancelled",
            "invalid_output",
            "unknown",
          ].includes(metrics.error_type)
            ? metrics.error_type
            : "unknown",
        validation_rejections: metrics.validation_rejections,
        search_successes: metrics.search_successes,
      };
      sink(JSON.stringify(record));
    },
  };
}
