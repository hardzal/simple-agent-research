import type { Agent } from "@anvia/core/agent";
import { Studio } from "@anvia/studio";

/**
 * Studio 1.3.20 clones agents when a trace/session store is enabled, discarding
 * our scoped adapter. With sessions:false and no explicit traces store, traces
 * are also disabled (the SDK does not accept traces:false).
 *
 * Debug surface: POST /agents/research/runs with stream:true returns JSONL
 * anvia.client.v3 frames. stream_event.event contains tool_call_start/end,
 * tool_result (inputs/results), and run_end (policy-checked output). Playground
 * consumes this stream. Safe per-run metrics go to stdout, not trace storage.
 * Draft events are not verified final output; SDK placeholder usage may be zero,
 * so use application metrics for usage availability. No persisted trace browser
 * or conversation history is available.
 */
export function createScopedStudio(
  agent: Agent,
  options: { ui?: boolean } = {},
): Studio {
  return new Studio([agent], {
    ui: options.ui ?? false,
    stores: { sessions: false, pipelineLogs: false, pipelineRuns: false },
  });
}
