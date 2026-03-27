import fs from "node:fs/promises";
import path from "node:path";

type AuditRecord = {
  userId: string;
  action: string;
  targetId: string;
  timestamp: string;
  detail?: Record<string, unknown> | null;
};

const AUDIT_DIR = path.join(process.cwd(), ".data");
const AUDIT_FILE = path.join(AUDIT_DIR, "audit.log");

export async function writeAuditLog(record: AuditRecord) {
  const line = JSON.stringify(record) + "\n";
  try {
    await fs.mkdir(AUDIT_DIR, { recursive: true });
    await fs.appendFile(AUDIT_FILE, line, "utf-8");
  } catch {
    // Best-effort logging; never break business flow.
    console.info("[audit]", line.trim());
  }
}

