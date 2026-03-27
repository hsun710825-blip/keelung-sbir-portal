/**
 * Google Drive / Sheets API 暫時性錯誤時，指數退避重試（1s、2s、4s，最多再試 3 次）。
 */

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** 從 googleapis / Gaxios 錯誤取出 HTTP 狀態碼 */
export function getGoogleApiHttpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as { code?: number; response?: { status?: number } };
  if (typeof e.response?.status === "number") return e.response.status;
  if (typeof e.code === "number" && e.code >= 400) return e.code;
  return undefined;
}

/** 是否為可重試的暫時性錯誤 */
export function isRetryableGoogleApiError(error: unknown): boolean {
  const s = getGoogleApiHttpStatus(error);
  if (s !== undefined) {
    return s === 429 || s === 500 || s === 502 || s === 503 || s === 504;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /ECONNRESET|ETIMEDOUT|socket hang up|EAI_AGAIN|ENOTFOUND|network/i.test(msg);
}

/**
 * @param operation 日誌用名稱
 * @param fn 要執行的 async 函式（失敗時依規則重試）
 */
export async function withGoogleApiRetry<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const delaysMs = [1000, 2000, 4000];
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isRetryableGoogleApiError(e) || attempt === delaysMs.length) {
        throw e;
      }
      const wait = delaysMs[attempt]!;
      const st = getGoogleApiHttpStatus(e);
      console.warn(
        `[googleApiRetry] ${operation} attempt ${attempt + 1} failed (status=${st ?? "?"}), retry in ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw lastError;
}
