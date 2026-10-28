import { describe, expect, it, vi } from "vitest";
import { runLiveSearch } from "../src/compatibility/live-search.js";
const env = { ALLOW_LIVE_TESTS: "true", TAVILY_API_KEY: "fixture-secret" };
describe("LIVE-02 guard", () => {
  it("requires explicit case and opt-in before constructing the provider", async () => {
    const factory = vi.fn();
    await expect(runLiveSearch([], env, factory)).rejects.toThrow("LIVE_CASE");
    await expect(
      runLiveSearch(
        ["--case", "LIVE-02"],
        { ...env, ALLOW_LIVE_TESTS: "false" },
        factory,
      ),
    ).rejects.toThrow("LIVE_OPT_IN");
    expect(factory).not.toHaveBeenCalled();
  });
  it("runs one public query without LLM and reports only safe counts", async () => {
    const search = vi.fn(async () => [
      {
        title: "Redis",
        url: "https://redis.io/docs/#intro",
        snippet: "Redis docs",
      },
    ]);
    const result = await runLiveSearch(["--case", "LIVE-02"], env, () => ({
      search,
    }));
    expect(result).toMatchObject({
      caseId: "LIVE-02",
      outcome: "passed",
      modelCalls: 0,
      searchCalls: 1,
      resultCount: 1,
      sourceCount: 1,
    });
    expect(search).toHaveBeenCalledExactlyOnceWith(
      "Redis official documentation",
      expect.objectContaining({ maxResults: 5 }),
    );
    expect(JSON.stringify(result)).not.toContain("fixture-secret");
  });
  it("does not retry a provider failure or expose raw error details", async () => {
    const search = vi.fn(async () => {
      throw new Error("fixture-secret");
    });
    await expect(
      runLiveSearch(["--case", "LIVE-02"], env, () => ({ search })),
    ).rejects.toMatchObject({
      message: "LIVE_SEARCH_FAILED",
      evidence: { outcome: "failed", searchCalls: 1, modelCalls: 0 },
    });
    expect(search).toHaveBeenCalledTimes(1);
  });
});
