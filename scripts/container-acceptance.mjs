import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { setTimeout } from "node:timers/promises";

const engine = process.argv[2] ?? "podman";
assert.ok(["podman", "docker"].includes(engine), "Expected podman or docker");
const image = "localhost/simple-agent-research:phase5";
await mkdir(resolve("reports"), { recursive: true });
const root = await mkdtemp(resolve("reports", "acceptance-"));
const name = `research-acceptance-${process.pid}`;
const command = (...args) =>
  execFileSync(engine, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let running = false;
async function start(fixture = false) {
  const args = [
    "run",
    "--detach",
    "--name",
    name,
    "--read-only",
    "--user",
    "1000:1000",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--cpus=1",
    "--memory=1g",
    "--pids-limit=128",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=64m,mode=1777",
    "--publish=127.0.0.1::4021",
    "--volume",
    `${root}:/app/reports`,
    "--env=OPENAI_API_KEY=fixture",
    "--env=TAVILY_API_KEY=fixture",
  ];
  if (fixture)
    args.push(
      "--volume",
      `${resolve("scripts/container-fixture.mjs")}:/app/scripts/container-fixture.mjs:ro`,
    );
  args.push(image);
  if (fixture) args.push("node", "scripts/container-fixture.mjs");
  command(...args);
  running = true;
  const binding = command("port", name, "4021/tcp");
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const url = `http://${binding}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await globalThis.fetch(`${url}/agents`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Server is not yet listening. */
    }
    await setTimeout(200);
  }
  assert.ok(ready, "Container readiness failed");
  const ui = await globalThis.fetch(`${url}/playground`, {
    headers: { Accept: "text/html" },
  });
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /<html/i);
  return url;
}
function stop() {
  if (running) {
    command("rm", "--force", name);
    running = false;
  }
}
try {
  await start();
  command("exec", name, "node", "dist/studio-healthcheck.js");
  assert.throws(() =>
    command(
      "exec",
      "--env=STUDIO_PORT=1",
      name,
      "node",
      "dist/studio-healthcheck.js",
    ),
  );
  assert.equal(command("exec", name, "id", "-u"), "1000");
  assert.throws(() =>
    command(
      "exec",
      name,
      "node",
      "-e",
      "require('fs').writeFileSync('/app/forbidden','x')",
    ),
  );
  const selected = JSON.parse(
    command("inspect", name, "--format", "{{json .HostConfig}}"),
  );
  assert.equal(selected.ReadonlyRootfs, true);
  assert.equal(selected.Privileged, false);
  assert.equal(selected.Memory, 1073741824);
  assert.ok(
    selected.NanoCpus === 1000000000 ||
      selected.CpuQuota / selected.CpuPeriod === 1,
  );
  const mounts = JSON.parse(
    command("inspect", name, "--format", "{{json .Mounts}}"),
  );
  assert.ok(mounts.every((mount) => !mount.Destination.includes("sock")));
  stop();
  const url = await start(true);
  const response = await globalThis.fetch(`${url}/agents/research/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "messages",
      messages: [{ role: "user", content: "Research Redis" }],
      stream: false,
    }),
  });
  assert.equal(response.status, 200);
  const envelope = await response.json();
  const output = JSON.parse(
    envelope.output ?? envelope.result?.output ?? envelope.text,
  );
  assert.equal(output.status, "completed");
  assert.deepEqual(output.sources, ["https://redis.io/docs/"]);
  const path = join(root, output.runId, "report.md");
  const hostContent = await readFile(path, "utf8");
  const containerContent = command(
    "exec",
    name,
    "node",
    "-e",
    `process.stdout.write(require('fs').readFileSync('/app/reports/${output.runId}/report.md').toString('base64'))`,
  );
  assert.equal(
    hostContent,
    Buffer.from(containerContent, "base64").toString("utf8"),
  );
  stop();
  await start(true);
  assert.equal(await readFile(path, "utf8"), hostContent);
  assert.equal(
    command(
      "exec",
      name,
      "node",
      "-e",
      `process.stdout.write(require('fs').readFileSync('/app/reports/${output.runId}/report.md').toString('base64'))`,
    ),
    Buffer.from(hostContent).toString("base64"),
  );
  globalThis.console.log(
    JSON.stringify({
      engine,
      outcome: "passed",
      productionUi: true,
      nonRoot: true,
      readOnlyRoot: true,
      cpu: 1,
      memoryMiB: 1024,
      loopbackOnly: true,
      fakeResearch: output.status,
      runId: output.runId,
      hostRoundTrip: true,
      preservedAfterRecreate: true,
    }),
  );
} finally {
  stop();
  await rm(root, { recursive: true, force: true });
}
