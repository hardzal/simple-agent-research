import type { Agent } from "@anvia/core/agent";
import { Studio } from "@anvia/studio";

/** Persistence enables Studio agent cloning, which would discard the scoped adapter. */
export function createScopedStudio(agent: Agent): Studio {
  return new Studio([agent], {
    ui: false,
    stores: { sessions: false, pipelineLogs: false, pipelineRuns: false },
  });
}
