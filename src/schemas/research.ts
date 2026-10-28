import { z } from "zod";

export const agentDecisionSchema = z.strictObject({
  status: z.enum(["completed", "needs_clarification", "insufficient_evidence"]),
  message: z.string().trim().min(1).max(8000),
});
const base = { runId: z.uuid(), message: z.string().min(1) };
export const researchResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...base,
    status: z.literal("completed"),
    reportPath: z.string().min(1),
    sources: z.array(z.url()).min(1),
  }),
  z.strictObject({
    ...base,
    status: z.enum([
      "needs_clarification",
      "insufficient_evidence",
      "budget_exceeded",
      "failed",
    ]),
    reportPath: z.never().optional(),
    sources: z.never().optional(),
  }),
]);
export type ResearchResponse = z.infer<typeof researchResponseSchema>;
export type AgentDecision = z.infer<typeof agentDecisionSchema>;
