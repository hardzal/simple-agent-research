import { describe, expect, it, vi } from "vitest";
import { createTavilyProvider } from "../src/providers/search-provider.js";
import { createSourceRegistry } from "../src/services/source-registry.js";

const fixture = {
  title: "Redis",
  url: "https://redis.io/docs/#overview",
  content: "abcdef",
};

describe("search boundary", () => {
  it("uses bounded snippet search without raw pages, normalizes optional fields, and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.signal).toBe(signal);
      expect(JSON.parse(String(init?.body))).toMatchObject({
        query: "Redis",
        max_results: 5,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      });
      return Response.json({
        results: [
          fixture,
          { url: "https://example.org" },
          ...Array(6).fill(fixture),
        ],
      });
    });
    const result = await createTavilyProvider("fixture-key", 3, fetcher).search(
      "Redis",
      { maxResults: 99, signal },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      title: "Redis",
      url: fixture.url,
      snippet: "abc",
    });
    expect(result[1]).toMatchObject({ title: "", snippet: "" });
    expect(result[0]).not.toHaveProperty("publishedAt");
  });
  it("distinguishes empty results from malformed/error responses without leaking provider text or retrying", async () => {
    const options = { maxResults: 5, signal: new AbortController().signal };
    const empty = createTavilyProvider("fixture-key", 1500, async () =>
      Response.json({ results: [] }),
    );
    await expect(empty.search("Redis", options)).resolves.toEqual([]);
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "fixture-key" }, { status: 401 }),
    );
    await expect(
      createTavilyProvider("fixture-key", 1500, fetcher).search(
        "Redis",
        options,
      ),
    ).rejects.toThrow("SEARCH_PROVIDER_FAILED");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(
      createTavilyProvider("fixture-key", 1500, async () =>
        Response.json({}),
      ).search("Redis", options),
    ).rejects.toThrow("SEARCH_PROVIDER_FAILED");
  });
  it("deduplicates normalized URLs per run without discarding query parameters or inventing dates", () => {
    const registry = createSourceRegistry(3);
    const first = registry.add({
      title: "Redis",
      url: fixture.url,
      snippet: "abcdef",
    });
    expect(
      registry.add({
        title: "duplicate",
        url: "https://redis.io/docs/#other",
        snippet: "x",
      }).sourceId,
    ).toBe(first.sourceId);
    expect(first).toMatchObject({
      sourceId: "S1",
      url: "https://redis.io/docs/",
      snippet: "abc",
    });
    expect(
      registry.add({
        title: "query",
        url: "https://redis.io/docs/?lang=en",
        snippet: "",
      }).sourceId,
    ).toBe("S2");
    expect(createSourceRegistry(3).list()).toEqual([]);
    expect(() =>
      registry.add({ title: "bad", url: "file:///etc/passwd", snippet: "" }),
    ).toThrow("INVALID_SOURCE_URL");
  });
});
