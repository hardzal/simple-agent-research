import { describe, expect, it } from "vitest";
import { EvalOutcome, runEvalSuite } from "@anvia/core/evals";
import {
  createOfflineResearchEvalSuite,
  fixtureQualityReview as quality,
  mandatoryResearchContract as contract,
  observeOfflineResearch as observe,
  offlineResearchCaseIds as ids,
  offlineResearchSource as source,
} from "../src/evaluation/offline-research.js";

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
    const result = await runEvalSuite(createOfflineResearchEvalSuite());
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
