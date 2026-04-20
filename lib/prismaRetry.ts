const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRetryableDatabaseError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /Can't reach database server|Server has closed the connection|Connection terminated unexpectedly|ECONNRESET|ETIMEDOUT|ENOTFOUND|timeout|Timed out fetching a new connection|the database system is starting up|Neon.*starting/i.test(
      msg
    )
  ) {
    return true;
  }
  if (e && typeof e === "object" && "code" in e) {
    const code = String((e as { code?: string }).code || "");
    // P1001: Can't reach database server; P1017: Server has closed the connection
    if (["P1001", "P1017"].includes(code)) return true;
  }
  return false;
}

/**
 * Neon / serverless Postgres 冷啟或短暫斷線時，Prisma 查詢可能失敗；於此做有限次重試。
 */
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; delayMs?: number }
): Promise<T> {
  const retries = opts?.retries ?? 3;
  const delayMs = opts?.delayMs ?? 1500;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt >= retries || !isRetryableDatabaseError(e)) throw e;
      await sleep(delayMs);
    }
  }
  throw last;
}
