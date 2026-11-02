import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runEvalSuite, type RunEvalSuiteOptions } from "@anvia/core/evals";
import type { StudioEvalSuite } from "@anvia/studio";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOfflineResearchEvalSuite,
  offlineResearchCaseIds,
  type OfflineResearchCaseId,
  type OfflineResearchObservation,
} from "../src/evaluation/offline-research.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...fs,
    mkdtemp: vi.fn(fs.mkdtemp),
    readFile: vi.fn(fs.readFile),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function expectCleaned(expected: number) {
  const roots = await Promise.all(
    vi
      .mocked(mkdtemp)
      .mock.results.map((result) => result.value as Promise<string>),
  );
  expect(roots).toHaveLength(expected);
  expect(new Set(roots).size).toBe(expected);
  for (const root of roots) {
    await expect(access(root)).rejects.toMatchObject({ code: "ENOENT" });
  }
}

describe("reusable offline research evaluation", () => {
  it("exposes typed SDK/Studio-compatible cases and a stable offline identity", () => {
    const suite = createOfflineResearchEvalSuite();
    const sdk: RunEvalSuiteOptions<
      OfflineResearchCaseId,
      OfflineResearchObservation
    > = suite;
    const studio: StudioEvalSuite = suite;
    expect(sdk).toBe(studio);
    expect(suite.id).toBe("research-offline");
    expect(suite.name).toMatch(/offline.*scripted|scripted.*offline/i);
    expect(suite.cases).toEqual(
      offlineResearchCaseIds.map((id) => ({ id, input: id })),
    );
    expect(
      suite.metrics.map(({ name, required }) => ({ name, required })),
    ).toEqual([
      { name: "mandatory-contract", required: true },
      { name: "fixture-quality-review", required: false },
    ]);
    expect(mkdtemp).not.toHaveBeenCalled();
  });

  it("runs 5/5 with real round-trip observations, no fetch and no temp residue", async () => {
    const suite = createOfflineResearchEvalSuite();
    const result = await runEvalSuite({ ...suite, concurrency: 5 });
    expect(result.cases).toEqual({
      total: 5,
      passed: 5,
      failed: 0,
      invalid: 0,
    });
    expect(result.reporterErrors).toEqual([]);
    const runIds = result.results.map((entry) => entry.output?.result.runId);
    expect(new Set(runIds).size).toBe(5);
    for (const entry of result.results) {
      expect(entry.targetStatus).toBe("succeeded");
      expect(entry.metrics.map((metric) => metric.outcome.outcome)).toEqual([
        "pass",
        "pass",
      ]);
      const observation = entry.output!;
      if (observation.result.status === "completed") {
        expect(observation.content).not.toBe("");
        expect(observation.content).toBe(observation.written);
        expect(observation.content).toBe(observation.readBack);
        expect(observation.entries).toEqual([observation.result.runId]);
        expect(observation.writes).toBe(1);
        expect(observation.reads).toBe(1);
        await expect(
          access(observation.result.reportPath!),
        ).rejects.toMatchObject({
          code: "ENOENT",
        });
      }
    }
    expect(fetch).not.toHaveBeenCalled();
    await expectCleaned(5);
  });

  it("cleans an already-written report when observation fails and keeps the target invalid", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(
      new Error("observation read failed"),
    );
    const suite = createOfflineResearchEvalSuite();
    const result = await runEvalSuite({ ...suite, cases: [suite.cases[0]!] });
    expect(result.cases).toEqual({
      total: 1,
      passed: 0,
      failed: 0,
      invalid: 1,
    });
    expect(result.results[0]?.targetStatus).toBe("failed");
    expect(result.results[0]?.outcome).toBe("invalid");
    expect(readFile).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    await expectCleaned(1);
  });

  it("runs independently in plain Node without Vitest, env secrets or live fetch", () => {
    const moduleUrl = new URL(
      "../src/evaluation/offline-research.ts",
      import.meta.url,
    );
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
          import { access } from 'node:fs/promises';
          import { runEvalSuite } from '@anvia/core/evals';
          let fetchCalls = 0;
          globalThis.fetch = () => { fetchCalls++; throw new Error('live fetch forbidden'); };
          const { createOfflineResearchEvalSuite } = await import(${JSON.stringify(moduleUrl.href)});
          const suite = createOfflineResearchEvalSuite();
          const result = await runEvalSuite(suite);
          const paths = result.results.flatMap(entry => entry.output?.result.reportPath ?? []);
          for (const path of paths) {
            try { await access(path); throw new Error('temporary report survived'); }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
          }
          console.log(JSON.stringify({ id: suite.id, cases: result.cases, fetchCalls }));
        `,
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          TAVILY_API_KEY: "",
          MAX_AGENT_TURNS: "not-a-number",
          REPORTS_DIR: "",
        },
      },
    );
    expect(JSON.parse(output)).toEqual({
      id: "research-offline",
      cases: { total: 5, passed: 5, failed: 0, invalid: 0 },
      fetchCalls: 0,
    });
  });
});
