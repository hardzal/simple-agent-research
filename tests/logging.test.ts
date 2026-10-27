import { describe, expect, it } from "vitest";
import {
  createRunLogger,
  type RunMetrics,
} from "../src/services/run-metrics.js";

const metrics: RunMetrics = {
  runId: "54e1cd98-587f-4d62-b3ac-66bf7b7a5ec8",
  run_duration_ms: 100,
  model_calls: 2,
  input_tokens: null,
  output_tokens: null,
  web_search_calls: 1,
  tool_calls: 3,
  source_count: 1,
  report_created: true,
  report_verified: true,
  run_status: "completed",
  error_type: null,
  validation_rejections: 0,
  search_successes: 1,
};

describe("safe run logger", () => {
  it.each([
    ["runId", "fixture-secret"],
    ["run_status", "fixture-secret"],
    ["run_duration_ms", -1],
    ["run_duration_ms", Infinity],
    ["model_calls", "fixture-secret"],
    ["tool_calls", { message: "fixture-secret" }],
    ["web_search_calls", -1],
    ["source_count", 0.5],
    ["validation_rejections", NaN],
    ["search_successes", Number.MAX_SAFE_INTEGER + 1],
    ["input_tokens", { toJSON: () => "fixture-secret" }],
    ["output_tokens", -1],
    ["report_created", "fixture-secret"],
    ["report_verified", 1],
  ])(
    "rejects invalid %s without sending unsafe data to the sink",
    (field, value) => {
      const lines: string[] = [];
      expect(() =>
        createRunLogger((line) => lines.push(line)).log({
          ...metrics,
          [field as string]: value,
        } as RunMetrics),
      ).toThrow(new Error(field as string));
      expect(lines).toEqual([]);
    },
  );
  it("preserves known token usage rather than replacing unavailable usage with zero", () => {
    const lines: string[] = [];
    createRunLogger((line) => lines.push(line)).log({
      ...metrics,
      input_tokens: 0,
      output_tokens: 42,
    });
    expect(JSON.parse(lines[0]!)).toMatchObject({
      input_tokens: 0,
      output_tokens: 42,
    });
  });
  it("validates error categories instead of serializing raw provider errors", () => {
    for (const value of [
      "fixture-secret",
      new Error("fixture-secret"),
      { message: "fixture-secret" },
      ["fixture-secret"],
    ]) {
      const lines: string[] = [];
      createRunLogger((line) => lines.push(line)).log({
        ...metrics,
        error_type: value,
      } as RunMetrics);
      expect(JSON.parse(lines[0]!).error_type).toBe("unknown");
      expect(lines[0]).not.toContain("fixture-secret");
    }
  });
  it("retains recognized safe error categories", () => {
    const lines: string[] = [];
    createRunLogger((line) => lines.push(line)).log({
      ...metrics,
      error_type: "search_provider",
    });
    expect(JSON.parse(lines[0]!).error_type).toBe("search_provider");
  });
  it("drops raw errors, messages, headers, credentials and arbitrary extras", () => {
    const lines: string[] = [];
    const unsafe = {
      ...metrics,
      error: new Error("fixture-secret"),
      message: "fixture-secret",
      headers: { authorization: "Bearer fixture-secret" },
      OPENAI_API_KEY: "fixture-secret",
      credentials: "fixture-secret",
      prompt: "fixture-secret",
      nested: { value: "fixture-secret" },
      toJSON: () => ({ message: "fixture-secret" }),
    };
    createRunLogger((line) => lines.push(line)).log(unsafe);
    expect(JSON.parse(lines[0]!)).toEqual(metrics);
    expect(lines[0]).not.toContain("fixture-secret");
  });
  it("serializes typed operational metrics into an injected JSON sink", () => {
    const lines: string[] = [];
    createRunLogger((line) => lines.push(line)).log(metrics);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual(metrics);
  });
});
