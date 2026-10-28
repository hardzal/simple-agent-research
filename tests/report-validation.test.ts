import { describe, expect, it } from "vitest";
import { validateReport } from "../src/services/report-validation.js";
const sources = [
  {
    sourceId: "S1",
    title: "Redis",
    url: "https://redis.io/docs/",
    snippet: "Redis documentation",
  },
];
const valid =
  "# Redis\n\n## Temuan utama\nRedis has documentation [S1].\n\n## Sumber\n- [S1] https://redis.io/docs/\n";
describe("initial report validation", () => {
  it("accepts an attributable report without enforcing the target word count", () => {
    expect(validateReport(valid, sources, 65536)).toEqual([]);
  });
  it("rejects foreign IDs and URLs across Markdown links, references, autolinks, images, and plain text", () => {
    for (const extra of [
      "[S99]",
      "[bad](https://evil.test/a)",
      "[bad][ref]\n\n[ref]: https://evil.test/a",
      "<https://evil.test/a>",
      "![bad](https://evil.test/a)",
      "https://evil.test/a",
      '<a href="https://evil.test/a">bad</a>',
    ]) {
      expect(
        validateReport(valid + extra, sources, 65536).length,
      ).toBeGreaterThan(0);
    }
    expect(
      validateReport(valid.replace("- [S1]", "- [S2]"), sources, 65536).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    "https://en.wikipedia.org/wiki/Redis_(software)",
    "https://example.test/docs?topic=Redis_(database)",
  ])("preserves balanced parentheses in registered URL %s", (url) => {
    const registered = [{ ...sources[0]!, url }];
    for (const reference of [url, `<${url}>`, `[Redis](${url})`]) {
      const report = valid.replace(sources[0]!.url, reference);
      expect(validateReport(report, registered, 65536)).toEqual([]);
      expect(
        validateReport(
          report + `\nhttps://foreign.test/Redis_(software)`,
          registered,
          65536,
        ),
      ).toContain("FOREIGN_SOURCE_URL");
    }
  });
  it("does not accept a foreign punctuation-bearing URL as its registered prefix", () => {
    const url = "https://example.test/Redis_(software)";
    const report = valid.replace(sources[0]!.url, `[Redis](${url})`);
    const registered = [{ ...sources[0]!, url }];
    expect(
      validateReport(
        report + `\n[foreign](${url}/other_(page))`,
        registered,
        65536,
      ),
    ).toContain("FOREIGN_SOURCE_URL");
  });
  it("rejects empty, oversized UTF-8, or unattributable drafts", () => {
    expect(validateReport("", sources, 65536).length).toBeGreaterThan(0);
    expect(
      validateReport(valid + "é", sources, Buffer.byteLength(valid) + 1),
    ).toContain("REPORT_TOO_LARGE");
    expect(validateReport(valid, [], 65536).length).toBeGreaterThan(0);
  });
});
