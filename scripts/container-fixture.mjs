import { Usage } from "@anvia/core/completion";
import { createResearchRuntime, parseConfig } from "../dist/index.js";
import { createScopedStudio } from "../dist/application/scoped-studio.js";

// Separate acceptance entrypoint: the production server never selects fake providers.
globalThis.fetch = async () => {
  throw new Error("FIXTURE_NETWORK_FORBIDDEN");
};
const content =
  "# Redis\n\n## Temuan utama\nRedis menyimpan data dalam memori untuk cache [S1].\n\n## Keterbatasan\nFixture berdasarkan snippet, bukan artikel lengkap.\n\n## Sumber\n- [S1] https://redis.io/docs/\n";
const tool = (toolName, input = {}) => [
  { type: "tool-call", toolCallId: `${toolName}-fixture`, toolName, input },
];
const config = parseConfig({
  OPENAI_API_KEY: "fixture",
  TAVILY_API_KEY: "fixture",
  REPORTS_DIR: "/app/reports",
});
const model = {
  provider: "fake",
  modelId: "container-fixture",
  capabilities: {
    streaming: true,
    tools: true,
    toolChoice: true,
    imageInput: false,
    documentInput: false,
    outputSchema: false,
    reasoning: false,
  },
  async completion(request) {
    const step = request.chatHistory.filter(
      (message) => message.role === "tool",
    ).length;
    const choices = [
      tool("webSearch", { query: "Redis" }),
      tool("writeFile", { content }),
      tool("readFile"),
      [
        {
          type: "text",
          text: JSON.stringify({
            status: "completed",
            message: "Laporan fixture terverifikasi.",
          }),
        },
      ],
    ];
    if (!choices[step]) throw new Error("UNEXPECTED_FIXTURE_TURN");
    return { choice: choices[step], usage: Usage.empty(), rawResponse: null };
  },
  async *streamCompletion(request) {
    yield { type: "final", response: await this.completion(request) };
  },
};
const runtime = await createResearchRuntime(config, {
  model,
  searchProvider: {
    async search() {
      return [
        {
          title: "Redis",
          url: "https://redis.io/docs/",
          snippet: "Redis is an in-memory cache.",
        },
      ];
    },
  },
});
const studio = createScopedStudio(runtime.agent, { ui: true });
await studio.serve({
  port: config.studioPort,
  hostname: "0.0.0.0",
  log: false,
});
