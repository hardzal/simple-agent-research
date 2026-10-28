import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createReportStore } from "../src/services/report-store.js";

let base: string;
const active = () => new AbortController().signal;
beforeEach(async () => {
  base = await fs.mkdtemp(
    path.join(await fs.realpath(tmpdir()), "report-store-"),
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(base, { recursive: true, force: true });
});

it("round-trips exact UTF-8 bytes/hash and never overwrites a run", async () => {
  const root = path.join(base, "reports");
  const store = await createReportStore(root);
  const id = randomUUID();
  const content = "# Riset\nBukti café 🌏\n";
  const written = await store.write(id, content, active());
  expect(written).toEqual({
    path: path.join(root, id, "report.md"),
    bytesWritten: Buffer.byteLength(content),
    hash: createHash("sha256").update(content).digest("hex"),
  });
  expect(await store.read(id, active())).toEqual({
    path: written.path,
    content,
    bytesRead: written.bytesWritten,
    hash: written.hash,
  });
  await expect(store.write(id, "replacement", active())).rejects.toThrow(
    "REPORT_STORE_FAILED",
  );
  expect(await fs.readFile(written.path, "utf8")).toBe(content);
});

it("rejects noncanonical IDs, traversal and invalid UTF-8 before creating a run", async () => {
  const store = await createReportStore(path.join(base, "reports"));
  for (const id of [
    "../outside",
    "../../report.md",
    randomUUID().toUpperCase(),
    "not-a-uuid",
  ]) {
    await expect(store.write(id, "x", active())).rejects.toThrow(
      "INVALID_REPORT_PATH",
    );
    await expect(store.read(id, active())).rejects.toThrow(
      "INVALID_REPORT_PATH",
    );
  }
  await expect(store.write(randomUUID(), "\ud800", active())).rejects.toThrow(
    "REPORT_STORE_FAILED",
  );
  expect(await fs.readdir(path.join(base, "reports"))).toEqual([]);
});

it("rejects junction/symlink root, ancestor, run and report without touching outside", async () => {
  const outside = path.join(base, "outside");
  await fs.mkdir(outside);
  const sentinel = path.join(outside, "report.md");
  await fs.writeFile(sentinel, "untouched");
  const alias = path.join(base, "alias");
  // Junctions exercise real Windows reparse points without requiring symlink privileges.
  await fs.symlink(
    outside,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  await expect(createReportStore(alias)).rejects.toThrow("INVALID_REPORT_PATH");
  await expect(createReportStore(path.join(alias, "nested"))).rejects.toThrow(
    "INVALID_REPORT_PATH",
  );
  const root = path.join(base, "reports");
  const store = await createReportStore(root);
  const id = randomUUID();
  await fs.symlink(
    outside,
    path.join(root, id),
    process.platform === "win32" ? "junction" : "dir",
  );
  await expect(store.read(id, active())).rejects.toThrow("INVALID_REPORT_PATH");
  await expect(store.write(id, "overwrite", active())).rejects.toThrow(
    "INVALID_REPORT_PATH",
  );
  const fileId = randomUUID();
  await fs.mkdir(path.join(root, fileId));
  const report = path.join(root, fileId, "report.md");
  try {
    await fs.symlink(sentinel, report, "file");
  } catch (error) {
    if (
      process.platform !== "win32" ||
      (error as NodeJS.ErrnoException).code !== "EPERM"
    )
      throw error;
    // Still test a genuine symlink at the report filename; never silently skip.
    await fs.symlink(outside, report, "junction");
  }
  await expect(store.read(fileId, active())).rejects.toThrow(
    "INVALID_REPORT_PATH",
  );
  expect(await fs.readFile(sentinel, "utf8")).toBe("untouched");
  expect(await fs.readdir(outside)).toEqual(["report.md"]);
});

it("bounds writes/reads and exposes tampered bytes/hash for caller verification", async () => {
  const root = path.join(base, "reports");
  const store = await createReportStore(root, 16);
  await expect(
    store.write(randomUUID(), "x".repeat(17), active()),
  ).rejects.toThrow("REPORT_STORE_FAILED");
  const id = randomUUID();
  const original = await store.write(id, "original", active());
  await fs.writeFile(original.path, "tampered");
  const changed = await store.read(id, active());
  expect(changed.content).toBe("tampered");
  expect(changed.hash).not.toBe(original.hash);
  await fs.writeFile(original.path, Buffer.from([0xff]));
  await expect(store.read(id, active())).rejects.toThrow("REPORT_STORE_FAILED");
  await fs.writeFile(original.path, "x".repeat(17));
  await expect(store.read(id, active())).rejects.toThrow("REPORT_STORE_FAILED");
  await fs.unlink(original.path);
  await fs.mkdir(original.path);
  await expect(store.read(id, active())).rejects.toThrow("INVALID_REPORT_PATH");
});

it("rejects pre-abort and cleans its publication when aborted during publish", async () => {
  const root = path.join(base, "reports");
  const store = await createReportStore(root);
  const pre = new AbortController();
  pre.abort("private reason");
  await expect(store.write(randomUUID(), "x", pre.signal)).rejects.toThrow(
    "REPORT_ABORTED",
  );
  expect(await fs.readdir(root)).toEqual([]);
  const controller = new AbortController();
  const link = fs.link.bind(fs);
  vi.spyOn(fs, "link").mockImplementation(async (from, to) => {
    await link(from, to);
    controller.abort("private reason");
  });
  const id = randomUUID();
  await expect(store.write(id, "late", controller.signal)).rejects.toThrow(
    "REPORT_ABORTED",
  );
  expect(await fs.readdir(path.join(root, id))).toEqual([]);
  await expect(store.read(id, pre.signal)).rejects.toThrow("REPORT_ABORTED");

  vi.restoreAllMocks();
  const savedId = randomUUID();
  const saved = await store.write(savedId, "keep", active());
  const duringOpen = new AbortController();
  const open = fs.open.bind(fs);
  vi.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await open(...args);
    duringOpen.abort();
    return handle;
  });
  await expect(store.read(savedId, duringOpen.signal)).rejects.toThrow(
    "REPORT_ABORTED",
  );
  expect(await fs.readFile(saved.path, "utf8")).toBe("keep");
  vi.restoreAllMocks();
  const duringWrite = new AbortController();
  vi.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await open(...args);
    duringWrite.abort();
    return handle;
  });
  const draftId = randomUUID();
  await expect(
    store.write(draftId, "draft", duringWrite.signal),
  ).rejects.toThrow("REPORT_ABORTED");
  expect(await fs.readdir(path.join(root, draftId))).toEqual([]);
});

it("sanitizes permission errors without leaking paths or OS details", async () => {
  const store = await createReportStore(path.join(base, "reports"));
  vi.spyOn(fs, "open").mockRejectedValue(
    Object.assign(new Error(`EACCES ${base} private`), { code: "EACCES" }),
  );
  await expect(store.write(randomUUID(), "x", active())).rejects.toEqual(
    new Error("REPORT_STORE_FAILED"),
  );
});
