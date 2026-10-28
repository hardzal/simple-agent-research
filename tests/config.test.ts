import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { parseConfig } from "../src/config/index.js";

const credentials = {
  OPENAI_API_KEY: "fixture-openai",
  TAVILY_API_KEY: "fixture-tavily",
};

const numericFields = [
  ["MAX_WEB_SEARCH_CALLS", "maxWebSearchCalls"],
  ["MAX_AGENT_TURNS", "maxAgentTurns"],
  ["MAX_EXECUTION_MS", "maxExecutionMs"],
  ["STUDIO_PORT", "studioPort"],
  ["MAX_PROMPT_CHARS", "maxPromptChars"],
  ["MAX_QUERY_CHARS", "maxQueryChars"],
  ["MAX_SNIPPET_CHARS", "maxSnippetChars"],
  ["MAX_REPORT_BYTES", "maxReportBytes"],
] as const;

describe("parseConfig", () => {
  it("can be imported offline without parsing credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.resetModules();
    try {
      expect((await import("../src/config/index.js")).parseConfig).toBeTypeOf(
        "function",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("ships a complete example with empty credentials and documented defaults", async () => {
    const example = await readFile(
      new URL("../.env.example", import.meta.url),
      "utf8",
    );
    const env = Object.fromEntries(
      example
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
    expect(env.OPENAI_API_KEY).toBe("");
    expect(env.TAVILY_API_KEY).toBe("");
    expect(Object.keys(env)).toHaveLength(18);
    expect(parseConfig({ ...env, ...credentials })).toEqual(
      parseConfig(credentials),
    );
  });
  it("allows zero revisions but never more than one", () => {
    expect(
      parseConfig({ ...credentials, MAX_REPORT_REVISIONS: "0" })
        .maxReportRevisions,
    ).toBe(0);
    for (const value of ["2", "-1", "", "0.5", "NaN"])
      expect(() =>
        parseConfig({ ...credentials, MAX_REPORT_REVISIONS: value }),
      ).toThrow(new Error("MAX_REPORT_REVISIONS"));
  });
  it("rejects concurrency other than exactly one", () => {
    for (const value of ["0", "2", "", "1.5", "NaN"])
      expect(() =>
        parseConfig({ ...credentials, TOOL_CONCURRENCY: value }),
      ).toThrow(new Error("TOOL_CONCURRENCY"));
  });
  it("parses only explicit true or false for live opt-in", () => {
    expect(
      parseConfig({ ...credentials, ALLOW_LIVE_TESTS: "true" }).allowLiveTests,
    ).toBe(true);
    expect(
      parseConfig({ ...credentials, ALLOW_LIVE_TESTS: "false" }).allowLiveTests,
    ).toBe(false);
    for (const value of ["", "1", "0", "yes", "TRUE", " true "])
      expect(() =>
        parseConfig({ ...credentials, ALLOW_LIVE_TESTS: value }),
      ).toThrow(new Error("ALLOW_LIVE_TESTS"));
  });
  it.each(numericFields)("parses positive integer %s", (field, property) => {
    expect(parseConfig({ ...credentials, [field]: "12" })[property]).toBe(12);
  });
  it.each(numericFields)("rejects invalid integer %s", (field) => {
    for (const value of [
      "",
      " ",
      "0",
      "-1",
      "1.5",
      "NaN",
      "Infinity",
      "1e2",
      "0x10",
      "2junk",
      "9007199254740992",
    ]) {
      expect(() => parseConfig({ ...credentials, [field]: value })).toThrow(
        new Error(field),
      );
    }
  });
  it("bounds studio port to a valid TCP port", () => {
    expect(() => parseConfig({ ...credentials, STUDIO_PORT: "65536" })).toThrow(
      new Error("STUDIO_PORT"),
    );
    expect(
      parseConfig({ ...credentials, STUDIO_PORT: "65535" }).studioPort,
    ).toBe(65535);
  });
  it.each([
    ["NODE_ENV", "nodeEnv", "test"],
    ["OPENAI_BASE_URL", "openaiBaseUrl", "http://localhost:8080/v1"],
    ["LLM_MODEL", "llmModel", "fixture-model"],
    ["REPORTS_DIR", "reportsDir", "./reports"],
  ])("accepts explicit %s", (field, property, value) => {
    expect(
      parseConfig({ ...credentials, [field!]: value })[
        property as keyof ReturnType<typeof parseConfig>
      ],
    ).toBe(value);
  });
  it.each([
    [
      "OPENAI_BASE_URL",
      [
        "invalid",
        "ftp://example.com",
        "https://user:secret@example.com/v1",
        "https://example.com/v1?key=secret",
        "https://example.com/v1#secret",
      ],
    ],
    ["LLM_API", ["responses", "", "CHAT"]],
    ["NODE_ENV", ["invalid", ""]],
    ["LLM_MODEL", ["", "   "]],
    ["REPORTS_DIR", ["", "   "]],
  ])(
    "rejects unsafe or unsupported %s using only its field name",
    (field, values) => {
      for (const value of values)
        expect(() => parseConfig({ ...credentials, [field]: value })).toThrow(
          new Error(field),
        );
    },
  );
  it.each(["OPENAI_API_KEY", "TAVILY_API_KEY"])(
    "requires nonblank %s without exposing values",
    (field) => {
      for (const value of [undefined, "", "   "]) {
        expect(() => parseConfig({ ...credentials, [field]: value })).toThrow(
          new Error(field),
        );
      }
    },
  );
  it("uses architecture defaults with explicit credentials", () => {
    expect(parseConfig(credentials)).toEqual({
      nodeEnv: "development",
      openaiBaseUrl: "https://gateway.devscale.id/v1",
      openaiApiKey: "fixture-openai",
      tavilyApiKey: "fixture-tavily",
      llmModel: "gpt-6-luna",
      llmApi: "chat",
      reportsDir: "/app/reports",
      maxWebSearchCalls: 3,
      maxAgentTurns: 5,
      maxExecutionMs: 60000,
      maxReportRevisions: 1,
      toolConcurrency: 1,
      studioPort: 4021,
      allowLiveTests: false,
      maxPromptChars: 8000,
      maxQueryChars: 500,
      maxSnippetChars: 1500,
      maxReportBytes: 65536,
    });
  });
});
