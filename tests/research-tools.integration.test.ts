import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "../src/config/index.js";
import { createResearchTools } from "../src/tools/research-tools.js";
import { createReportStore } from "../src/services/report-store.js";
import type { RunScope } from "../src/application/scoped-agent.js";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const config = parseConfig({
  OPENAI_API_KEY: "fixture",
  TAVILY_API_KEY: "fixture",
});
const report =
  "# Redis\n\n## Temuan utama\nRedis documentation [S1].\n\n## Sumber\n- [S1] https://redis.io/docs/\n";
function scope(signal = new AbortController().signal): RunScope {
  return {
    runId: randomUUID(),
    signal,
    toolCalls: 0,
    modelCalls: 0,
    assertActive() {
      signal.throwIfAborted();
    },
  };
}
async function fixture(options: Partial<typeof config> = {}) {
  const root = await mkdtemp(join(tmpdir(), "research-tools-"));
  roots.push(root);
  const search = vi.fn(async () => [
    {
      title: "Redis",
      url: "https://redis.io/docs/#intro",
      snippet: "documentation",
    },
  ]);
  const store = await createReportStore(root);
  const active = scope();
  const tools = createResearchTools(active, {
    config: { ...config, ...options },
    searchProvider: { search },
    reportStore: store,
  });
  return { root, active, search, store, tools };
}
describe("scoped research tools", () => {
  it("searches, rejects a foreign draft before I/O, then writes and verifies exactly once", async () => {
    const { tools, active } = await fixture();
    await expect(tools.readFile({})).rejects.toThrow("READ_BEFORE_WRITE");
    expect(
      (await tools.webSearch({ query: "Redis" })).results[0]?.sourceId,
    ).toBe("S1");
    expect(
      await tools.writeFile({ content: report + "https://evil.test" }),
    ).toMatchObject({ success: false, canRevise: true });
    expect(tools.snapshot().reportCreated).toBe(false);
    const written = await tools.writeFile({ content: report });
    expect(written).toMatchObject({
      success: true,
      bytesWritten: Buffer.byteLength(report),
    });
    await expect(tools.writeFile({ content: report })).rejects.toThrow(
      "WRITE_QUOTA_EXCEEDED",
    );
    expect(await tools.readFile({})).toMatchObject({
      success: true,
      content: report,
    });
    expect(tools.snapshot()).toMatchObject({
      reportCreated: true,
      reportVerified: true,
      webSearchCalls: 1,
    });
    expect(active.toolCalls).toBe(6);
    await expect(tools.readFile({})).rejects.toThrow("REPORT_ALREADY_VERIFIED");
    await expect(tools.webSearch({ query: "again" })).rejects.toThrow(
      "REPORT_ALREADY_VERIFIED",
    );
  });
  it("reserves failed searches before I/O, caps results, and blocks extra provider calls", async () => {
    const { tools, search } = await fixture({ maxWebSearchCalls: 1 });
    search.mockRejectedValueOnce(new Error("private provider response"));
    await expect(tools.webSearch({ query: "Redis" })).rejects.toThrow(
      "SEARCH_PROVIDER_FAILED",
    );
    await expect(tools.webSearch({ query: "again" })).rejects.toThrow(
      "SEARCH_QUOTA_EXCEEDED",
    );
    expect(search).toHaveBeenCalledTimes(1);
    expect(tools.snapshot()).toMatchObject({
      webSearchCalls: 1,
      status: "budget_exceeded",
    });
  });
  it("does not accept late provider results or allow overlapping operations", async () => {
    const { tools, search } = await fixture({ maxExecutionMs: 15 });
    search.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return [];
    });
    const pending = tools.webSearch({ query: "Redis" });
    await expect(tools.webSearch({ query: "overlap" })).rejects.toThrow(
      "TOOL_BUSY",
    );
    await expect(pending).rejects.toThrow("RUN_ABORTED");
    expect(tools.snapshot().sources).toEqual([]);
    await expect(tools.writeFile({ content: report })).rejects.toThrow(
      "RUN_TERMINAL",
    );
  });
  it("rejects manipulated inputs and inactive scope before side effects; isolates run state", async () => {
    const { tools, search, store } = await fixture();
    await expect(tools.webSearch({ query: "x".repeat(501) })).rejects.toThrow(
      "INVALID_TOOL_INPUT",
    );
    await expect(
      tools.writeFile({ content: report, path: "../outside" }),
    ).rejects.toThrow("INVALID_TOOL_INPUT");
    const inactive = scope();
    inactive.assertActive = () => {
      throw new Error("inactive");
    };
    const disabled = createResearchTools(inactive, {
      config,
      searchProvider: { search },
      reportStore: store,
    });
    await expect(disabled.webSearch({ query: "Redis" })).rejects.toThrow(
      "NO_ACTIVE_SCOPE",
    );
    expect(search).not.toHaveBeenCalled();
    await tools.webSearch({ query: "Redis" });
    const second = createResearchTools(scope(), {
      config,
      searchProvider: { search },
      reportStore: store,
    });
    expect(second.snapshot().sources).toEqual([]);
    expect(await second.writeFile({ content: report })).toMatchObject({
      success: false,
    });
  });
  it("latches verification failure when stored content is changed", async () => {
    const { tools } = await fixture();
    await tools.webSearch({ query: "Redis" });
    const written = await tools.writeFile({ content: report });
    if (!written.success) throw new Error("fixture report rejected");
    await writeFile(written.path, report + "tampered");
    await expect(tools.readFile({})).rejects.toThrow(
      "REPORT_VERIFICATION_FAILED",
    );
    expect(tools.snapshot()).toMatchObject({
      reportVerified: false,
      status: "failed",
    });
    await expect(tools.webSearch({ query: "retry" })).rejects.toThrow(
      "RUN_TERMINAL",
    );
  });
});
