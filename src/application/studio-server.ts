import type { Studio } from "@anvia/studio";
import type { AppConfig } from "../config/index.js";
import { createResearchRuntime } from "./research-runner.js";
import { createScopedStudio } from "./scoped-studio.js";
import { createOfflineResearchEvalSuite } from "../evaluation/offline-research.js";
import { createStudioMonitor } from "../services/studio-monitor.js";
import {
  studioMonitorPage,
  studioMonitorClient,
} from "./studio-monitor-page.js";

type RuntimeOverrides = Parameters<typeof createResearchRuntime>[1];

/** Same factory as headless runs; construction performs no provider request. */
export async function createResearchStudio(
  config: AppConfig,
  overrides: RuntimeOverrides = {},
): Promise<Studio> {
  const monitor = createStudioMonitor();
  const runtime = await createResearchRuntime(config, {
    ...overrides,
    onMetrics(snapshot) {
      monitor.recordMetrics(snapshot);
      overrides.onMetrics?.({ ...snapshot });
    },
  });
  return createScopedStudio(runtime.agent, {
    ui: true,
    evals: [
      {
        ...createOfflineResearchEvalSuite(),
        reporters: [monitor.evalReporter],
      },
    ],
    configureApp(app) {
      app.get("/research-monitor", (c) => {
        c.header("Cache-Control", "no-store");
        c.header(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'",
        );
        return c.html(studioMonitorPage);
      });
      app.get("/research-monitor/client.js", (c) => {
        c.header("Cache-Control", "no-store");
        return c.body(studioMonitorClient, 200, {
          "Content-Type": "text/javascript; charset=utf-8",
        });
      });
      app.get("/research-monitor/state", (c) => {
        c.header("Cache-Control", "no-store");
        return c.json(monitor.snapshot());
      });
    },
  });
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
