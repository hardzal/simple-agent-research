import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseConfig } from "./config/index.js";
import {
  createResearchStudio,
  serveResearchStudio,
} from "./application/studio-server.js";

/** No dotenv loading, live probes, raw exception logging, or process.exit(). */
export async function runStudio(
  env: Record<string, string | undefined> = process.env,
): Promise<number> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    const config = parseConfig(env);
    const studio = await createResearchStudio(config);
    await serveResearchStudio(
      studio,
      config,
      controller.signal,
      env.STUDIO_HOST === "0.0.0.0" ? "0.0.0.0" : "127.0.0.1",
    );
    return 0;
  } catch {
    // Config, filesystem and bind errors can contain credential/path payloads.
    console.error("STUDIO_STARTUP_FAILED");
    return 1;
  } finally {
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = await runStudio();
}
