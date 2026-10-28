import type { Studio } from "@anvia/studio";
import type { AppConfig } from "../config/index.js";
import { createResearchRuntime } from "./research-runner.js";
import { createScopedStudio } from "./scoped-studio.js";

type RuntimeOverrides = Parameters<typeof createResearchRuntime>[1];

/** Same factory as headless runs; construction performs no provider request. */
export async function createResearchStudio(
  config: AppConfig,
  overrides: RuntimeOverrides = {},
): Promise<Studio> {
  const runtime = await createResearchRuntime(config, overrides);
  return createScopedStudio(runtime.agent, { ui: true });
}

/**
 * Resolves after graceful shutdown, rejects on bind/start/shutdown failure.
 * SDK serve awaits listening and owns cleanup, unlike fire-and-forget start.
 * Readiness: GET /status (Accept: application/json); UI: GET /playground.
 * Host/Origin guards are not authentication: standalone binds loopback.
 */
export function serveResearchStudio(
  studio: Studio,
  config: Pick<AppConfig, "studioPort">,
  signal?: AbortSignal,
  hostname: "127.0.0.1" | "0.0.0.0" = "127.0.0.1",
): Promise<void> {
  return studio.serve({
    hostname,
    port: config.studioPort,
    log: false,
    shutdownTimeoutMs: 5000,
    ...(signal ? { signal } : {}),
  });
}
