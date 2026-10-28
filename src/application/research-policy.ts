import type { AgentRunOptions } from "@anvia/core/agent";
import { z } from "zod";
import {
  agentDecisionSchema,
  type ResearchResponse,
} from "../schemas/research.js";
import type { createResearchTools } from "../tools/research-tools.js";

const userMessageSchema = z.object({
  role: z.literal("user"),
  content: z.union([
    z.string(),
    z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1),
  ]),
});

export function prepareResearchInput(
  settings: AgentRunOptions,
  maxChars: number,
): AgentRunOptions {
  if (!settings || typeof settings !== "object")
    throw new Error("INVALID_RESEARCH_REQUEST");
  let prompt: unknown = settings.prompt;
  if (settings.continuation !== undefined || settings.session !== undefined)
    throw new Error("INVALID_RESEARCH_REQUEST");
  if (settings.messages !== undefined) {
    if (!Array.isArray(settings.messages))
      throw new Error("INVALID_RESEARCH_REQUEST");
    prompt = settings.messages.at(-1);
  }
  if (typeof prompt !== "string") {
    const message = userMessageSchema.safeParse(prompt);
    if (!message.success) throw new Error("INVALID_RESEARCH_REQUEST");
    prompt =
      typeof message.data.content === "string"
        ? message.data.content
        : message.data.content.map((part) => part.text).join("\n");
  }
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > maxChars)
    throw new Error("INVALID_RESEARCH_REQUEST");
  // Only the current user request and cancellation cross the product boundary.
  return {
    prompt,
    ...(settings.abortSignal ? { abortSignal: settings.abortSignal } : {}),
  };
}

type Snapshot = ReturnType<ReturnType<typeof createResearchTools>["snapshot"]>;
export function finalizeResearch(
  runId: string,
  candidate: string,
  state: Snapshot,
): ResearchResponse {
  const fail = (): ResearchResponse => ({
    runId,
    status: "failed",
    message: "Research could not be verified. No verified report is available.",
  });
  if (state.status === "budget_exceeded")
    return {
      runId,
      status: "budget_exceeded",
      message: "Research exceeded its execution budget.",
    };
  if (state.status === "failed") return fail();
  let value: unknown;
  try {
    value = JSON.parse(candidate);
  } catch {
    return fail();
  }
  const parsed = agentDecisionSchema.safeParse(value);
  if (!parsed.success) return fail();
  const { status, message } = parsed.data;
  if (status === "completed") {
    if (
      !state.reportCreated ||
      !state.reportVerified ||
      !state.reportPath ||
      state.searchSuccesses < 1 ||
      !state.reportSources.length
    )
      return fail();
    return {
      runId,
      status,
      message,
      reportPath: state.reportPath,
      sources: state.reportSources,
    };
  }
  if (status === "needs_clarification") {
    if (
      state.toolCalls !== 0 ||
      state.webSearchCalls !== 0 ||
      state.reportCreated
    )
      return fail();
    return { runId, status, message };
  }
  if (
    state.searchSuccesses < 1 ||
    state.reportCreated ||
    state.validationRejections > 0
  )
    return fail();
  return { runId, status, message };
}
