import {
  createResearchAgent,
  type ResearchDependencies,
} from "../agent/research.agent.js";
import type { AppConfig } from "../config/index.js";
import { createLlmModel } from "../providers/llm.js";
import { createTavilyProvider } from "../providers/search-provider.js";
import { createReportStore } from "../services/report-store.js";
import { researchResponseSchema } from "../schemas/research.js";

/** Constructing the runtime performs no model/search request and loads no .env. */
export async function createResearchRuntime(
  config: AppConfig,
  overrides: Partial<Omit<ResearchDependencies, "config">> = {},
) {
  const agent = createResearchAgent({
    config,
    model: overrides.model ?? createLlmModel(config),
    searchProvider:
      overrides.searchProvider ??
      createTavilyProvider(config.tavilyApiKey, config.maxSnippetChars),
    reportStore:
      overrides.reportStore ??
      (await createReportStore(config.reportsDir, config.maxReportBytes)),
    ...(overrides.logger ? { logger: overrides.logger } : {}),
  });
  return {
    agent,
    async run(prompt: string, options: { abortSignal?: AbortSignal } = {}) {
      const result = await agent.generate({ prompt, ...options });
      if (result.type !== "response")
        throw new Error("UNVERIFIED_RESEARCH_OUTPUT");
      return researchResponseSchema.parse(JSON.parse(result.output));
    },
  };
}
