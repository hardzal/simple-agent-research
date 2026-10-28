try {
  const port = Number(process.env.STUDIO_PORT ?? "4021");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("INVALID_STUDIO_PORT");
  const response = await fetch(`http://127.0.0.1:${port}/agents`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}

export {};
