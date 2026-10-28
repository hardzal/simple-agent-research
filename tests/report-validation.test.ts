import { describe, expect, it } from "vitest";
import {
  reportCitationIds,
  validateReport,
} from "../src/services/report-validation.js";
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
describe("Markdown provenance risks", () => {
  it("rejects a title and sources without any findings content", () => {
    expect(
      validateReport(
        "# Redis [S1]\n\n## Sumber\n- [S1] https://redis.io/docs/\n",
        sources,
        65536,
      ),
    ).toContain("REPORT_STRUCTURE");
  });
  const second = {
    ...sources[0]!,
    sourceId: "S2",
    url: "https://example.test/second",
  };
  const report = (entries: string, body = "Redis [S1].") =>
    `# Redis\n${body}\n## Sources\n${entries}`;

  it("accepts parsed citation links and URL forms with parentheses and ampersands", () => {
    const url = "https://example.test/Redis_(database)?a=1&b=2";
    const registered = [{ ...sources[0]!, url }];
    for (const entry of [
      `- [S1] ${url}`,
      `- [S1] <${url}>`,
      `- [S1] [Redis](${url})`,
      `- [S1] [Redis][docs]\n\n[docs]: ${url}`,
      `- [S1](${url})`,
      `- [S1][docs]\n\n[docs]: ${url}`,
      `[S1]: ${url}`,
    ]) {
      expect(validateReport(report(entry), registered, 65536), entry).toEqual(
        [],
      );
    }
    expect(reportCitationIds(report(`- [S1] ${url}`, `[S1](${url})`))).toEqual([
      "S1",
    ]);
  });

  it("binds each ID to its own URL, not another ID on the same line", () => {
    const entries = `- [S1] ${second.url} [S2] ${sources[0]!.url}`;
    expect(
      validateReport(report(entries), [...sources, second], 65536),
    ).toContain("CITATION_SOURCE_MISMATCH");
  });

  it("rejects contradictory source entries even alongside a correct pair", () => {
    for (const extra of [
      ` ${second.url}`,
      `\n- [S1] ${second.url}`,
      `\n- [S2] ${sources[0]!.url}`,
    ]) {
      expect(
        validateReport(
          report(`- [S1] ${sources[0]!.url}${extra}`),
          [...sources, second],
          65536,
        ),
      ).toContain("CITATION_SOURCE_MISMATCH");
    }
  });

  it("rejects a linked body citation pointing to another registered source", () => {
    for (const body of [
      `Redis [S1](${second.url}).`,
      `Redis [S1][wrong].\n\n[wrong]: ${second.url}`,
    ]) {
      expect(
        validateReport(
          report(`- [S1] ${sources[0]!.url}`, body),
          [...sources, second],
          65536,
        ),
      ).toContain("CITATION_SOURCE_MISMATCH");
    }
  });

  it("does not count code, images, definitions, or escaped markers as body citations", () => {
    for (const body of [
      "`[S1]`",
      "```text\n[S1]\n```",
      "    [S1]",
      "\\[S1]",
      `![S1](${sources[0]!.url})`,
      `[S1]: ${sources[0]!.url}`,
    ]) {
      const content = report(`- [S1] ${sources[0]!.url}`, body);
      expect(reportCitationIds(content), body).toEqual([]);
      expect(validateReport(content, sources, 65536), body).toContain(
        "MISSING_CITATION",
      );
    }
  });

  it("requires real title and Sources headings and real source mappings", () => {
    for (const content of [
      `\`\`\`\n${valid}\n\`\`\``,
      `# Redis\nRedis [S1].\n\`\`\`\n## Sources\n- [S1] ${sources[0]!.url}\n\`\`\``,
      report(`\`- [S1] ${sources[0]!.url}\``),
      report(`\n## Other\n- [S1] ${sources[0]!.url}`),
    ]) {
      expect(validateReport(content, sources, 65536).length).toBeGreaterThan(0);
    }
    for (const label of ["Sources", "Sumber", "References", "Referensi"]) {
      expect(
        validateReport(valid.replace("Sumber", label), sources, 65536),
      ).toEqual([]);
    }
  });

  it("rejects foreign URLs hidden in unused definitions, code, and image labels", () => {
    for (const extra of [
      "[unused]: https://foreign.test/a?x=1&y=2",
      "`https://foreign.test/code`",
      "```\nhttps://foreign.test/fenced\n```",
      "    https://foreign.test/indented",
      `![https://foreign.test/alt](${sources[0]!.url})`,
      "[unused]: https://foreign.test/one\n[unused]: https://foreign.test/two",
    ]) {
      expect(
        validateReport(`${valid}\n${extra}`, sources, 65536),
        extra,
      ).toContain("FOREIGN_SOURCE_URL");
    }
  });

  it("rejects unknown linked and defined IDs and reports only static error codes", () => {
    for (const extra of [
      `[S99](${sources[0]!.url})`,
      `[S99]: ${sources[0]!.url}`,
    ]) {
      const issues = validateReport(`${valid}\n${extra}`, sources, 65536);
      expect(issues).toContain("UNKNOWN_SOURCE_ID");
      expect(issues.every((issue) => /^[A-Z_]+$/.test(issue))).toBe(true);
    }
  });
});

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
