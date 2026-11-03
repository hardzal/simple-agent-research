import { describe, expect, it } from "vitest";
import { buildResearchInstructions } from "../src/agent/research.instructions.js";
import { parseConfig } from "../src/config/index.js";

describe("citation instructions", () => {
  it("preserves source IDs across searches and uses validation mappings for revision", () => {
    const instructions = buildResearchInstructions(
      parseConfig({ OPENAI_API_KEY: "fixture", TAVILY_API_KEY: "fixture" }),
    );
    expect(instructions).toContain("Never renumber sourceId");
    expect(instructions).toContain("across all webSearch calls in this run");
    expect(instructions).toContain("[S1], [S4], [S6]");
    expect(instructions).toContain("citationSources");
  });
});
