import crypto from "node:crypto";
import path from "node:path";
import xss from "xss";

const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const MIME_EXT_ALIASES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

export function sanitizeInputString(value: string) {
  const noCtrl = value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, "");
  return xss(noCtrl, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style"],
  });
}

export function sanitizeDeepInput<T>(input: T): T {
  if (typeof input === "string") return sanitizeInputString(input) as T;
  if (Array.isArray(input)) return input.map((item) => sanitizeDeepInput(item)) as T;
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = sanitizeDeepInput(value);
    }
    return out as T;
  }
  return input;
}

export function ensureAllowedUploadMime(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  const ext = MIME_EXTENSION_MAP[normalized];
  if (!ext) {
    return {
      ok: false as const,
      error: "Unsupported file type",
      allowed: Object.keys(MIME_EXTENSION_MAP),
    };
  }
  return { ok: true as const, mimeType: normalized, extension: ext };
}

export function ensureAllowedUploadExtension(filename: string, mimeType: string) {
  const ext = path.extname(String(filename || "").trim().toLowerCase());
  const allowed = MIME_EXT_ALIASES[mimeType] || [];
  if (!ext || !allowed.includes(ext)) {
    return {
      ok: false as const,
      error: "File extension does not match declared MIME type",
      allowedExtensions: allowed,
    };
  }
  return { ok: true as const };
}

function detectMimeByMagic(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export function ensureAllowedUploadMagic(bytes: Uint8Array, mimeType: string) {
  const detected = detectMimeByMagic(bytes);
  if (!detected || detected !== mimeType) {
    return {
      ok: false as const,
      error: "File content signature mismatch",
      detectedMime: detected,
    };
  }
  return { ok: true as const, detectedMime: detected };
}

export function ensureFileSizeLimit(size: number) {
  if (!Number.isFinite(size) || size < 0 || size > MAX_SINGLE_FILE_BYTES) {
    return {
      ok: false as const,
      error: `File too large (max ${Math.floor(MAX_SINGLE_FILE_BYTES / (1024 * 1024))}MB)`,
      maxBytes: MAX_SINGLE_FILE_BYTES,
    };
  }
  return { ok: true as const, maxBytes: MAX_SINGLE_FILE_BYTES };
}

export function buildSafeUploadFilename(mimeType: string) {
  const ext = MIME_EXTENSION_MAP[mimeType];
  if (!ext) throw new Error("Unsupported mime type for rename");
  return `${crypto.randomUUID()}${ext}`;
}

export function sanitizeProjectNameForFolder(input: unknown) {
  const raw = typeof input === "string" ? input : "";
  const trimmed = sanitizeInputString(raw).trim();
  const basename = path.basename(trimmed).replace(/[\\/]/g, "");
  return basename || "未命名計畫";
}

/** 送件 PDF 於 Google Drive／通知信附件之顯示檔名（仍可寫入中文計畫名；已排除路徑與非法字元） */
export function buildSafeDisplayPdfName(projectName: unknown) {
  const raw = sanitizeProjectNameForFolder(projectName);
  const cleaned = raw
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "")
    .slice(0, 80);
  const base = cleaned || "未命名計畫";
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

