import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { EvalOutcome, runEvalSuite, type EvalMetric } from "@anvia/core/evals";
import type { ResearchResponse } from "../src/schemas/research.js";
import { validateReport } from "../src/services/report-validation.js";
import {
  config,
  decision,
  fixture,
  report,
  source,
  text,
  tool,
} from "./fixtures/research.js";

const ids = ["EVAL-01", "EVAL-02", "EVAL-03", "EVAL-04", "EVAL-05"] as const;
type CaseId = (typeof ids)[number];
type Observation = {
  result: ResearchResponse;
  content: string;
  written: string;
  readBack: string;
  entries: string[];
  searches: number;
  writes: number;
  reads: number;
  modelCalls: number;
  rejections: number;
};

async function observe(id: CaseId): Promise<Observation> {
  const f = await fixture({
    hits: id === "EVAL-03" ? [] : [source],
    ...(id === "EVAL-02"
      ? {
          steps: [
            text(
              decision("needs_clarification", "Apple perusahaan atau buah?"),
            ),
          ],
        }
      : id === "EVAL-03"
        ? {
            steps: [
              tool("webSearch", { query: "Redis" }),
              text(decision("insufficient_evidence", "Bukti belum memadai.")),
            ],
          }
        : id === "EVAL-04"
          ? {
              steps: [
                tool("webSearch", { query: "Redis" }),
                tool("writeFile", { content: report("https://foreign.test/") }),
                tool("writeFile", { content: report() }),
                tool("readFile"),
                text(decision()),
              ],
            }
          : {}),
  });
  const result = await f.run(
    id === "EVAL-02"
      ? "Research Apple."
      : "Research tentang apa itu Redis dan fungsinya.",
  );
  return {
    result,
    content: result.reportPath ? await readFile(result.reportPath, "utf8") : "",
    written: f.write.mock.calls[0]?.[1] ?? "",
    readBack: (await f.read.mock.results[0]?.value)?.content ?? "",
    entries: await readdir(f.root),
    searches: f.search.mock.calls.length,
    writes: f.write.mock.calls.length,
    reads: f.read.mock.calls.length,
    modelCalls: f.requests.length,
    rejections: f.log.mock.calls[0]?.[0].validation_rejections ?? 0,
  };
}

const contract: EvalMetric<CaseId, Observation, boolean> = {
  name: "mandatory-contract",
  required: true,
  evaluate({ case: testCase, output: o }) {
    try {
      expect(o.modelCalls).toBeLessThanOrEqual(config.maxAgentTurns);
      expect(o.searches).toBeLessThanOrEqual(config.maxWebSearchCalls);
      if (testCase.input === "EVAL-02" || testCase.input === "EVAL-03") {
        expect(o.result.status).toBe(
          testCase.input === "EVAL-02"
            ? "needs_clarification"
            : "insufficient_evidence",
        );
        expect(o.result.reportPath).toBeUndefined();
        expect(o.result.sources).toBeUndefined();
        expect(o.searches).toBe(testCase.input === "EVAL-02" ? 0 : 1);
        expect(o.writes).toBe(0);
        expect(o.reads).toBe(0);
        expect(o.entries).toEqual([]);
        expect(o.result.message.trim()).not.toBe("");
      } else {
        expect(o.result.status).toBe("completed");
        expect(o.searches).toBe(1);
        expect(o.writes).toBe(1);
        expect(o.reads).toBe(1);
        expect(o.content.trim()).not.toBe("");
        expect(o.content).toBe(o.written);
        expect(o.content).toBe(o.readBack);
        expect(o.result.sources).toEqual([source.url]);
        expect(
          validateReport(
            o.content,
            [{ ...source, sourceId: "S1" }],
            config.maxReportBytes,
          ),
        ).toEqual([]);
        expect(o.entries).toEqual([o.result.runId]);
        if (testCase.input === "EVAL-04") expect(o.rejections).toBe(1);
      }
      return EvalOutcome.pass(true);
    } catch {
      return EvalOutcome.fail(false, {
        comment: "Mandatory status/provenance/file/budget contract rejected.",
      });
    }
  },
};

const quality: EvalMetric<CaseId, Observation, number> = {
  name: "fixture-quality-review",
  required: false,
  evaluate({ output: o }) {
    if (o.result.status !== "completed")
      return EvalOutcome.pass(0, {
        comment: "No report expected; no quality judgment.",
      });
    const words = o.content.trim().split(/\s+/).length;
    const matchesFixture =
      o.content.includes("Redis") &&
      o.content.includes("cache") &&
      o.content.includes("Temuan utama") &&
      !o.content.includes("Memcached");
    return matchesFixture
      ? EvalOutcome.pass(words, {
          comment:
            "Indonesian factual fixture is relevant, concise and citation-supported by its supplied Redis snippet. Word count is feedback only; live quality needs manual review.",
        })
      : EvalOutcome.fail(words, {
          comment:
            "Factual/language fixture mismatch; not a semantic LLM judge.",
        });
  },
};

type SuiteGateResult = {
  cases: { total: number; passed: number; failed: number; invalid: number };
  results: {
    case: { id: string };
    outcome: string;
    targetStatus: string;
    metrics: { outcome: { outcome: string }; reporterErrors: unknown[] }[];
  }[];
  reporterErrors: unknown[];
};
function assertPassed(result: SuiteGateResult, expectedIds: readonly string[]) {
  expect(expectedIds.length).toBeGreaterThan(0);
  expect(result.cases).toEqual({
    total: expectedIds.length,
    passed: expectedIds.length,
    failed: 0,
    invalid: 0,
  });
  expect(result.results.map((entry) => entry.case.id).sort()).toEqual(
    [...expectedIds].sort(),
  );
  expect(result.reporterErrors).toEqual([]);
  for (const entry of result.results) {
    expect(entry.targetStatus).toBe("succeeded");
    expect(entry.outcome).toBe("pass");
    expect(entry.metrics.length).toBeGreaterThan(0);
    for (const metric of entry.metrics) {
      expect(metric.outcome.outcome).toBe("pass");
      expect(metric.reporterErrors).toEqual([]);
    }
  }
}

describe("Anvia executable offline evaluation", () => {
  it("runs and gates all five mandatory cases with the pinned SDK", async () => {
    const result = await runEvalSuite({
      name: "M1 mandatory",
      cases: ids.map((id) => ({ id, input: id })),
      target: observe,
      metrics: [contract, quality],
      concurrency: 1,
    });
    assertPassed(result, ids);
    console.log(
      JSON.stringify({
        suite: result.name,
        mandatory: result.cases,
        metrics: result.metrics,
        quality: "scripted fixture; live review separate",
      }),
    );
  });

  it.each(["status", "citation"])(
    "negative control rejects corrupted %s despite a passing supporting metric",
    async (fault) => {
      const original = await observe("EVAL-01");
      const corrupted =
        fault === "status"
          ? {
              ...original,
              result: { ...original.result, status: "failed" as const },
            }
          : {
              ...original,
              content: original.content.replace(
                source.url,
                "https://foreign.test/",
              ),
              written: original.written.replace(
                source.url,
                "https://foreign.test/",
              ),
              readBack: original.readBack.replace(
                source.url,
                "https://foreign.test/",
              ),
            };
      const result = await runEvalSuite({
        name: "negative control",
        cases: [{ id: "EVAL-01", input: "EVAL-01" as const }],
        target: () => corrupted,
        metrics: [
          contract,
          { ...quality, evaluate: () => EvalOutcome.pass(100) },
        ],
      });
      expect(result.results[0]?.scores["mandatory-contract"]?.outcome).toBe(
        "fail",
      );
      expect(result.results[0]?.scores["fixture-quality-review"]?.outcome).toBe(
        "pass",
      );
      expect(() => assertPassed(result, ["EVAL-01"])).toThrow();
    },
  );

  it.each(["target", "metric"])(
    "rejects SDK %s errors rather than treating them as pass",
    async (fault) => {
      const observation = await observe("EVAL-01");
      const result = await runEvalSuite({
        name: "error control",
        cases: [{ id: "EVAL-01", input: "EVAL-01" as const }],
        target: () => {
          if (fault === "target") throw new Error("fixture target error");
          return observation;
        },
        metrics: [
          {
            ...contract,
            evaluate: (args) => {
              if (fault === "metric") throw new Error("fixture metric error");
              return contract.evaluate(args);
            },
          },
        ],
      });
      expect(result.cases.invalid).toBe(1);
      expect(() => assertPassed(result, ["EVAL-01"])).toThrow();
    },
  );

  it("rejects missing or incomplete mandatory results", async () => {
    const observation = await observe("EVAL-01");
    const result = await runEvalSuite({
      name: "incomplete",
      cases: [{ id: "EVAL-01", input: "EVAL-01" as const }],
      target: () => observation,
      metrics: [contract],
    });
    expect(() => assertPassed(result, ids)).toThrow();
    expect(() =>
      assertPassed(
        {
          ...result,
          results: [],
          cases: { total: 0, passed: 0, failed: 0, invalid: 0 },
        },
        [],
      ),
    ).toThrow();
  });
});
