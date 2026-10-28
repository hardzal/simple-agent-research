import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";

export interface ReportStore {
  write(
    runId: string,
    content: string,
    signal: AbortSignal,
  ): Promise<{
    path: string;
    bytesWritten: number;
    hash: string;
  }>;
  read(
    runId: string,
    signal: AbortSignal,
  ): Promise<{
    path: string;
    content: string;
    bytesRead: number;
    hash: string;
  }>;
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const invalid = () => new Error("INVALID_REPORT_PATH");
const failed = () => new Error("REPORT_STORE_FAILED");
function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("REPORT_ABORTED");
}
function safeError(error: unknown, signal?: AbortSignal): Error {
  if (signal?.aborted) return new Error("REPORT_ABORTED");
  return error instanceof Error && error.message === "INVALID_REPORT_PATH"
    ? invalid()
    : failed();
}
function sameFile(a: Stats, b: Stats): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}
function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Inspect every component, not just realpath(root): realpath would hide junctions.
// As with Node's path-based fs API, the configured host directory must be trusted
// against concurrent hostile renames (see ARCHITECTURE §7).
async function directories(
  directory: string,
  create: boolean,
  signal?: AbortSignal,
): Promise<void> {
  const anchor = path.parse(directory).root;
  const parts = path
    .relative(anchor, directory)
    .split(path.sep)
    .filter(Boolean);
  let current = anchor;
  for (const part of ["", ...parts]) {
    current = path.join(current, part);
    let info: Stats;
    try {
      info = await fs.lstat(current);
    } catch (error) {
      check(signal);
      if (!create || (error as NodeJS.ErrnoException).code !== "ENOENT")
        throw error;
      try {
        await fs.mkdir(current, { mode: 0o700 });
      } catch (mkdirError) {
        if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST")
          throw mkdirError;
      }
      check(signal);
      info = await fs.lstat(current);
    }
    check(signal);
    if (info.isSymbolicLink() || !info.isDirectory()) throw invalid();
  }
}

export async function createReportStore(
  root: string,
  maxBytes = 65_536,
): Promise<ReportStore> {
  let resolved: string;
  try {
    if (!root || root.includes("\0")) throw invalid();
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw failed();
    resolved = path.resolve(root);
    await directories(resolved, true);
  } catch (error) {
    throw safeError(error);
  }

  function locations(runId: string): { directory: string; report: string } {
    if (!uuid.test(runId)) throw invalid();
    const directory = path.join(resolved, runId);
    if (path.relative(resolved, directory) !== runId) throw invalid();
    return { directory, report: path.join(directory, "report.md") };
  }

  return {
    async write(runId, content, signal) {
      let handle: FileHandle | undefined;
      let owned: Stats | undefined;
      let draft: string | undefined;
      let report: string | undefined;
      let published = false;
      try {
        check(signal);
        const location = locations(runId);
        report = location.report;
        const bytes = Buffer.from(content, "utf8");
        if (bytes.length > maxBytes || bytes.toString("utf8") !== content)
          throw failed();
        await directories(resolved, false, signal);
        check(signal);
        // Diagnose an existing junction before mkdir; an ordinary existing run
        // still fails mkdir, even if it contains no report.
        try {
          const existing = await fs.lstat(location.directory);
          check(signal);
          if (existing.isSymbolicLink() || !existing.isDirectory())
            throw invalid();
        } catch (error) {
          check(signal);
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await fs.mkdir(location.directory, { mode: 0o700 });
        check(signal);
        await directories(location.directory, false, signal);
        check(signal);
        draft = path.join(location.directory, `.draft-${randomUUID()}`);
        handle = await fs.open(
          draft,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            (constants.O_NOFOLLOW ?? 0),
          0o600,
        );
        check(signal);
        // Retain inode identity; the catch path also obtains it if open was
        // cancelled, so cleanup never removes another operation's report.
        owned = await handle.stat();
        check(signal);
        await handle.writeFile(bytes);
        check(signal);
        await handle.close();
        handle = undefined;
        check(signal);
        await directories(location.directory, false, signal);
        check(signal);
        await fs.link(draft, report); // Atomic, fails if report already exists.
        published = true;
        check(signal);
        await fs.unlink(draft);
        draft = undefined;
        check(signal);
        return { path: report, bytesWritten: bytes.length, hash: hash(bytes) };
      } catch (error) {
        if (handle) {
          // stat can have failed earlier; do not unlink without known ownership.
          if (!owned) owned = await handle.stat().catch(() => undefined);
          await handle.close().catch(() => undefined);
        }
        for (const target of [draft, published ? report : undefined]) {
          if (!target || !owned) continue;
          try {
            await directories(path.dirname(target), false);
            const current = await fs.lstat(target);
            if (!current.isSymbolicLink() && sameFile(current, owned))
              await fs.unlink(target);
          } catch {
            // Fail closed if the host changed ownership/path or denied cleanup.
          }
        }
        throw safeError(error, signal);
      }
    },

    async read(runId, signal) {
      let handle: FileHandle | undefined;
      try {
        check(signal);
        const location = locations(runId);
        await directories(location.directory, false, signal);
        check(signal);
        const before = await fs.lstat(location.report);
        check(signal);
        if (before.isSymbolicLink() || !before.isFile()) throw invalid();
        if (before.size > maxBytes) throw failed();
        handle = await fs.open(
          location.report,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        check(signal);
        const opened = await handle.stat();
        check(signal);
        if (!opened.isFile() || !sameFile(before, opened)) throw invalid();
        if (opened.size > maxBytes) throw failed();
        // Never readFile(): a file can grow after stat. One extra byte detects
        // overflow while keeping allocation and total I/O bounded.
        const buffer = Buffer.alloc(maxBytes + 1);
        let total = 0;
        while (total < buffer.length) {
          const result = await handle.read(
            buffer,
            total,
            buffer.length - total,
            total,
          );
          check(signal);
          if (result.bytesRead === 0) break;
          total += result.bytesRead;
        }
        const after = await handle.stat();
        check(signal);
        if (
          total > maxBytes ||
          total !== after.size ||
          opened.size !== after.size ||
          opened.mtimeMs !== after.mtimeMs ||
          opened.ctimeMs !== after.ctimeMs
        )
          throw failed();
        const bytes = buffer.subarray(0, total);
        const content = bytes.toString("utf8");
        if (!Buffer.from(content, "utf8").equals(bytes)) throw failed();
        await handle.close();
        handle = undefined;
        check(signal);
        return {
          path: location.report,
          content,
          bytesRead: total,
          hash: hash(bytes),
        };
      } catch (error) {
        if (handle) await handle.close().catch(() => undefined);
        throw safeError(error, signal);
      }
    },
  };
}
