export function parseConfig(env: Record<string, string | undefined>) {
  for (const field of ["OPENAI_API_KEY", "TAVILY_API_KEY"]) {
    if (!env[field]?.trim()) throw new Error(field);
  }
  const text = (field: string, fallback?: string): string => {
    const value = env[field] ?? fallback;
    if (!value?.trim()) throw new Error(field);
    return value;
  };
  const nodeEnv = text("NODE_ENV", "development");
  if (!["development", "test", "production"].includes(nodeEnv))
    throw new Error("NODE_ENV");
  if (text("LLM_API", "chat") !== "chat") throw new Error("LLM_API");
  const openaiBaseUrl = text(
    "OPENAI_BASE_URL",
    "https://gateway.devscale.id/v1",
  );
  try {
    const url = new URL(openaiBaseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new Error("OPENAI_BASE_URL");
  }
  const integer = (
    field: string,
    fallback: number,
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
  ): number => {
    const raw = env[field];
    const value = raw === undefined ? fallback : Number(raw);
    if (
      (raw !== undefined && !/^\d+$/.test(raw)) ||
      !Number.isSafeInteger(value) ||
      value < min ||
      value > max
    )
      throw new Error(field);
    return value;
  };
  const live = env.ALLOW_LIVE_TESTS ?? "false";
  if (live !== "true" && live !== "false") throw new Error("ALLOW_LIVE_TESTS");
  return {
    nodeEnv,
    openaiBaseUrl,
    openaiApiKey: env.OPENAI_API_KEY!,
    tavilyApiKey: env.TAVILY_API_KEY!,
    llmModel: text("LLM_MODEL", "gpt-6-luna"),
    llmApi: "chat" as const,
    reportsDir: text("REPORTS_DIR", "/app/reports"),
    maxWebSearchCalls: integer("MAX_WEB_SEARCH_CALLS", 3),
    maxAgentTurns: integer("MAX_AGENT_TURNS", 5),
    maxExecutionMs: integer("MAX_EXECUTION_MS", 60000),
    maxReportRevisions: integer("MAX_REPORT_REVISIONS", 1, 0, 1),
    toolConcurrency: integer("TOOL_CONCURRENCY", 1, 1, 1),
    studioPort: integer("STUDIO_PORT", 4021, 1, 65535),
    allowLiveTests: live === "true",
    maxPromptChars: integer("MAX_PROMPT_CHARS", 8000),
    maxQueryChars: integer("MAX_QUERY_CHARS", 500),
    maxSnippetChars: integer("MAX_SNIPPET_CHARS", 1500),
    maxReportBytes: integer("MAX_REPORT_BYTES", 65536),
  };
}
export type AppConfig = ReturnType<typeof parseConfig>;
