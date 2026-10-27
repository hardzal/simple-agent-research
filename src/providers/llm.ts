import OpenAI from "openai";
import { OpenAIClient } from "@anvia/openai";
import type { AppConfig } from "../config/index.js";

type LlmConfig = Pick<
  AppConfig,
  "openaiApiKey" | "openaiBaseUrl" | "llmModel" | "llmApi" | "maxExecutionMs"
>;

// The SDK normalizes missing usage to zero; raw Chat usage preserves availability.
export function getReportedTokenUsage(rawResponse: unknown) {
  const rawUsage =
    rawResponse !== null &&
    typeof rawResponse === "object" &&
    "usage" in rawResponse
      ? rawResponse.usage
      : undefined;
  const token = (field: string): number | null => {
    if (!rawUsage || typeof rawUsage !== "object") return null;
    const value: unknown = Reflect.get(rawUsage, field);
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  };
  return {
    inputTokens: token("prompt_tokens"),
    outputTokens: token("completion_tokens"),
  };
}

export function createLlmModel(
  config: LlmConfig,
  fetchImplementation?: typeof fetch,
) {
  // Inject the SDK client: Anvia's managed-client options do not expose maxRetries.
  const client = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
    maxRetries: 0,
    timeout: config.maxExecutionMs,
    ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
  });
  return new OpenAIClient({ client }).completionModel({
    modelId: config.llmModel,
    api: config.llmApi,
  });
}
