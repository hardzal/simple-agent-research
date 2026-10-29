import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runLiveResearch } from "../src/compatibility/live-research.js";
import { fixture } from "./fixtures/research.js";

const env = {
  ALLOW_LIVE_TESTS: "true",
  OPENAI_API_KEY: "fixture-secret",
  TAVILY_API_KEY: "fixture-secret",
};
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return String(address.port);
}

describe("LIVE-03 guarded Studio research", () => {
  it("rejects wrong case, missing opt-in and enlarged budget before side effects", async () => {
    await expect(runLiveResearch([], env)).rejects.toThrow("LIVE_CASE");
    await expect(runLiveResearch(["--case", "LIVE-03"], {})).rejects.toThrow(
      "LIVE_OPT_IN",
    );
    await expect(
      runLiveResearch(["--case", "LIVE-03"], {
        ...env,
        MAX_WEB_SEARCH_CALLS: "4",
      }),
    ).rejects.toThrow("LIVE_BUDGET");
  });
  it.each([
    { MAX_AGENT_TURNS: "6" },
    { MAX_WEB_SEARCH_CALLS: "4" },
    { MAX_EXECUTION_MS: "180001" },
    { MAX_EXECUTION_MS: "1800000" },
  ])("rejects an unauthorized budget before I/O: %j", async (budget) => {
    await expect(
      runLiveResearch(["--case", "LIVE-03"], { ...env, ...budget }),
    ).rejects.toThrow("LIVE_BUDGET");
  });
  it.each([60000, 180000])(
    "uses one streaming run within %i ms and verifies host bytes",
    async (maxExecutionMs) => {
      const f = await fixture();
      const result = await runLiveResearch(
        ["--case", "LIVE-03"],
        {
          ...env,
          REPORTS_DIR: f.root,
          STUDIO_PORT: await freePort(),
          MAX_EXECUTION_MS: String(maxExecutionMs),
        },
        { model: f.model, searchProvider: { search: f.search } },
      );
      expect(result).toMatchObject({
        caseId: "LIVE-03",
        outcome: "passed",
        finalStatus: "completed",
        modelCalls: 4,
        searchCalls: 1,
        reportVerified: true,
        inputTokens: null,
        outputTokens: null,
        maxExecutionMs,
        maxModelAttempts: 5,
        maxSearchCalls: 3,
      });
      expect(f.requests).toHaveLength(4);
      expect(f.search).toHaveBeenCalledTimes(1);
      const trace = await readFile(
        join(f.root, result.runId, "live-03.trace.json"),
        "utf8",
      );
      expect(trace).toContain("webSearch");
      expect(trace).toContain("readFile");
      expect(JSON.parse(trace).sources[0]).toMatchObject({
        sourceId: "S1",
        snippet: expect.stringContaining("Redis"),
      });
      expect(trace).not.toContain("fixture-secret");
      expect(trace).not.toContain("chatHistory");
      expect(JSON.stringify(result)).not.toContain("fixture-secret");
    },
  );
  it("never submits a research POST to an existing server on an occupied port", async () => {
    let posts = 0;
    const other = createHttpServer((request, response) => {
      if (request.method === "POST") posts++;
      response.end("{}");
    });
    await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
    try {
      const address = other.address();
      if (!address || typeof address === "string") throw new Error("No port");
      const f = await fixture();
      await expect(
        runLiveResearch(
          ["--case", "LIVE-03"],
          { ...env, REPORTS_DIR: f.root, STUDIO_PORT: String(address.port) },
          { model: f.model, searchProvider: { search: f.search } },
        ),
      ).rejects.toMatchObject({
        evidence: {
          outcome: "failed",
          stage: "readiness",
          modelCalls: null,
          searchCalls: null,
          sourceCount: null,
          validationRejections: null,
        },
      });
      expect(posts).toBe(0);
      expect(f.requests).toHaveLength(0);
    } finally {
      other.closeAllConnections();
      await new Promise<void>((resolve) => other.close(() => resolve()));
    }
  });
  it("does not rerun a failed provider and returns safe failure evidence", async () => {
    const f = await fixture({
      choose() {
        throw new Error("fixture-secret");
      },
    });
    await expect(
      runLiveResearch(
        ["--case", "LIVE-03"],
        { ...env, REPORTS_DIR: f.root, STUDIO_PORT: await freePort() },
        { model: f.model, searchProvider: { search: f.search } },
      ),
    ).rejects.toMatchObject({
      message: "LIVE_RESEARCH_FAILED",
      evidence: {
        caseId: "LIVE-03",
        outcome: "failed",
        modelCalls: 1,
        searchCalls: 0,
        finalStatus: "failed",
        applicationError: "model_provider",
        successfulWrites: 0,
        hostRoundTrip: false,
      },
    });
    expect(f.requests).toHaveLength(1);
  });
});
