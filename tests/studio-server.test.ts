import { request } from "node:http";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createResearchStudio,
  serveResearchStudio,
} from "../src/application/studio-server.js";
import { runStudio } from "../src/studio.js";
import { createScopedStudio } from "../src/application/scoped-studio.js";
import { config, decision, fixture, text } from "./fixtures/research.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  vi.restoreAllMocks();
});

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

// node:http intentionally bypasses the suite's fetch blocker, only for loopback.
function http(
  port: number,
  path: string,
  body?: unknown,
  accept = "application/json",
) {
  return new Promise<{
    status: number;
    body: string;
    headers: import("node:http").IncomingHttpHeaders;
  }>((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: body === undefined ? "GET" : "POST",
        headers: { Accept: accept, "Content-Type": "application/json" },
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          data += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode!,
            body: data,
            headers: response.headers,
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function listening(port: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const result = await http(port, "/status");
      if (result.status === 200) return result;
    } catch {
      /* Wait for an actual readiness response, not a blind startup delay. */
    }
    await delay(10);
  }
  throw new Error("Studio not ready");
}

async function server(options: Parameters<typeof fixture>[0] = {}) {
  const f = await fixture(options);
  const port = await freePort();
  const controller = new AbortController();
  const studio = createScopedStudio(f.agent, { ui: true });
  const closed = serveResearchStudio(
    studio,
    { ...config, studioPort: port },
    controller.signal,
  );
  // Keep a rejection observed even if readiness fails.
  void closed.catch(() => {});
  cleanups.push(async () => {
    controller.abort();
    await closed;
  });
  await listening(port);
  return { ...f, port, studio, controller, closed };
}
const user = (value: string) => ({
  role: "user",
  content: [{ type: "text", text: value }],
});
const run = (messages = [user("Redis")], stream = false) => ({
  type: "messages",
  messages,
  stream,
});

describe("production Studio server", () => {
  it("uses the runtime factory without making provider calls and serves readiness/UI/assets", async () => {
    const f = await fixture();
    const studio = await createResearchStudio({
      ...config,
      reportsDir: f.root,
    });
    expect(studio.config().agents.map((agent) => agent.id)).toEqual([
      "research",
    ]);
    await studio.shutdown();
    const s = await server();
    const status = JSON.parse((await http(s.port, "/status")).body);
    expect(status.storage).toEqual({});
    expect(status.counts.agents).toBe(1);
    const ui = await http(s.port, "/playground", undefined, "text/html");
    expect(ui.status).toBe(200);
    expect(ui.headers["content-type"]).toContain("text/html");
    const asset = ui.body.match(/(?:src|href)="([^"]+\.js)"/u)?.[1];
    expect(asset).toBeDefined();
    expect((await http(s.port, asset!)).status).toBe(200);
    expect(s.requests).toHaveLength(0);
    expect(s.search).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "keeps policy and real report round-trip over HTTP stream=%s",
    async (stream) => {
      const s = await server();
      const response = await http(s.port, "/agents/research/runs", {
        ...run(undefined, stream),
        maxTurns: 999,
        toolConcurrency: 99,
      });
      expect(response.status).toBe(200);
      expect(response.body).toContain("completed");
      expect(s.search).toHaveBeenCalledTimes(1);
      expect(s.write).toHaveBeenCalledTimes(1);
      expect(s.read).toHaveBeenCalledTimes(1);
      expect(s.log).toHaveBeenCalledTimes(1);
      expect(s.log.mock.calls[0]?.[0]).toMatchObject({
        model_calls: 4,
        tool_calls: 3,
        report_verified: true,
      });
      if (stream) {
        const frames = response.body
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        expect(frames[0]).toMatchObject({
          type: "stream_start",
          protocol: "anvia.client.v3",
        });
        const events = frames
          .filter((frame) => frame.type === "stream_event")
          .map((frame) => frame.event);
        expect(
          events
            .filter((event) => event.type === "tool_call_end")
            .map((event) => event.toolName),
        ).toEqual(["webSearch", "writeFile", "readFile"]);
        expect(
          events
            .filter((event) => event.type === "tool_result")
            .map((event) => event.result.status),
        ).toEqual(["success", "success", "success"]);
        const final = events.filter((event) => event.type === "run_end");
        expect(final).toHaveLength(1);
        expect(JSON.parse(final[0].output)).toMatchObject({
          status: "completed",
          sources: ["https://redis.io/docs/"],
        });
      }
    },
  );

  it("does not use Studio history as memory and enforces the configured budget", async () => {
    const s = await server({ config: { maxAgentTurns: 1 } });
    const response = await http(s.port, "/agents/research/runs", {
      ...run([
        user("PRIVATE_OLD_TOPIC"),
        {
          role: "assistant",
          content: [{ type: "text", text: "PRIVATE_OLD_ANSWER" }],
        },
        user("Redis"),
      ]),
      maxTurns: 999,
    });
    expect(response.status).toBe(200);
    expect(response.body).toContain("budget_exceeded");
    expect(s.requests).toHaveLength(1);
    expect(JSON.stringify(s.requests)).not.toContain("PRIVATE_OLD");
    expect(s.write).not.toHaveBeenCalled();
  });

  it("rejects direct tool execution without model/search/filesystem side effects", async () => {
    const s = await server();
    for (const [name, input] of [
      ["webSearch", { query: "Redis" }],
      ["writeFile", { content: "unsafe" }],
      ["readFile", {}],
    ] as const) {
      const result = await http(s.port, `/agents/research/tools/${name}/runs`, {
        args: input,
      });
      expect(result.body).not.toContain("completed");
      expect(result.status).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        status: "error",
        toolName: name,
      });
    }
    expect(s.requests).toHaveLength(0);
    expect(s.search).not.toHaveBeenCalled();
    expect(s.write).not.toHaveBeenCalled();
    expect(s.read).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "returns safe provider failures stream=%s",
    async (stream) => {
      const s = await server({
        choose() {
          throw new Error("PRIVATE_PROVIDER_SECRET");
        },
      });
      const response = await http(
        s.port,
        "/agents/research/runs",
        run(undefined, stream),
      );
      expect(response.status).toBe(200);
      expect(response.body).toContain("failed");
      expect(response.body).not.toContain("PRIVATE_PROVIDER_SECRET");
      expect(response.body).not.toContain("reportPath");
    },
  );

  it("shuts down the listening socket gracefully on cancellation", async () => {
    const s = await server({
      steps: [text(decision("needs_clarification", "Which Redis?"))],
    });
    s.controller.abort();
    await s.closed;
    await expect(http(s.port, "/status")).rejects.toThrow();
  });

  it("reports only a constant safe message for invalid startup configuration", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await runStudio({
        OPENAI_API_KEY: "PRIVATE_KEY",
        TAVILY_API_KEY: "PRIVATE_KEY",
        OPENAI_BASE_URL: "PRIVATE_BAD_URL",
      }),
    ).toBe(1);
    expect(error.mock.calls).toEqual([["STUDIO_STARTUP_FAILED"]]);
  });
  it("handles async bind errors without leaking raw errors or leaving signal listeners", async () => {
    const f = await fixture();
    const occupied = createServer();
    await new Promise<void>((resolve) =>
      occupied.listen(0, "0.0.0.0", resolve),
    );
    cleanups.push(
      () => new Promise<void>((resolve) => occupied.close(() => resolve())),
    );
    const address = occupied.address();
    if (!address || typeof address === "string") throw new Error("No port");
    const before = process.listenerCount("SIGTERM");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await runStudio({
        OPENAI_API_KEY: "PRIVATE_KEY",
        TAVILY_API_KEY: "PRIVATE_KEY",
        REPORTS_DIR: f.root,
        STUDIO_PORT: String(address.port),
      }),
    ).toBe(1);
    expect(error.mock.calls).toEqual([["STUDIO_STARTUP_FAILED"]]);
    expect(process.listenerCount("SIGTERM")).toBe(before);
  });

  it("connects SIGTERM to graceful shutdown and removes its handlers", async () => {
    const f = await fixture();
    const port = await freePort();
    const before = process.listenerCount("SIGTERM");
    const closed = runStudio({
      OPENAI_API_KEY: "fixture",
      TAVILY_API_KEY: "fixture",
      REPORTS_DIR: f.root,
      STUDIO_PORT: String(port),
      NODE_ENV: "production",
    });
    cleanups.push(async () => {
      if (process.listenerCount("SIGTERM") > before) process.emit("SIGTERM");
      await closed;
    });
    await listening(port);
    process.emit("SIGTERM");
    expect(await closed).toBe(0);
    expect(process.listenerCount("SIGTERM")).toBe(before);
    await expect(http(port, "/status")).rejects.toThrow();
  });
});
