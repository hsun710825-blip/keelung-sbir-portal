import { prisma } from "@/lib/prisma";

export type SettlementCommitteeSlot = {
  userId: string;
  displayName: string;
};

export type SettlementCommitteeConfig = {
  slots: [SettlementCommitteeSlot, SettlementCommitteeSlot, SettlementCommitteeSlot];
};

const SETTING_KEY = "settlement_committee_slots";

const DEFAULT_DISPLAY_NAMES = ["游國治", "陳柏琳", "嚴佳代"] as const;

let settingsTableEnsured = false;

export async function ensurePortalSettingsTable(): Promise<void> {
  if (settingsTableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PortalSetting" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PortalSetting_pkey" PRIMARY KEY ("key")
    );
  `);
  settingsTableEnsured = true;
}

function emptySlot(index: number): SettlementCommitteeSlot {
  return { userId: "", displayName: DEFAULT_DISPLAY_NAMES[index] ?? `委員${index + 1}` };
}

function normalizeSlots(raw: unknown): SettlementCommitteeConfig {
  const slots: SettlementCommitteeSlot[] = [emptySlot(0), emptySlot(1), emptySlot(2)];
  if (raw && typeof raw === "object" && Array.isArray((raw as { slots?: unknown }).slots)) {
    const arr = (raw as { slots: Array<{ userId?: unknown; displayName?: unknown }> }).slots;
    for (let i = 0; i < 3; i++) {
      const item = arr[i];
      if (!item) continue;
      slots[i] = {
        userId: String(item.userId || "").trim(),
        displayName: String(item.displayName || "").trim() || slots[i].displayName,
      };
    }
  }
  return { slots: slots as SettlementCommitteeConfig["slots"] };
}

export async function loadSettlementCommitteeConfig(): Promise<SettlementCommitteeConfig> {
  await ensurePortalSettingsTable();
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT "value" FROM "PortalSetting" WHERE "key" = ${SETTING_KEY} LIMIT 1
    `;
    const raw = rows[0]?.value;
    if (raw) {
      return normalizeSlots(JSON.parse(raw));
    }
  } catch {
    // fall through to default bootstrap
  }
  return await bootstrapSettlementCommitteeConfig();
}

async function bootstrapSettlementCommitteeConfig(): Promise<SettlementCommitteeConfig> {
  const { Role } = await import("@prisma/client");
  const reviewers = await prisma.user.findMany({
    where: { role: { in: [Role.REVIEWER, Role.COMMITTEE] } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 3,
    select: { id: true, name: true, email: true },
  });

  const slots: SettlementCommitteeSlot[] = [emptySlot(0), emptySlot(1), emptySlot(2)];
  reviewers.forEach((u, i) => {
    slots[i] = {
      userId: u.id,
      displayName: u.name?.trim() || DEFAULT_DISPLAY_NAMES[i] || u.email,
    };
  });

  const config: SettlementCommitteeConfig = {
    slots: slots as SettlementCommitteeConfig["slots"],
  };
  await saveSettlementCommitteeConfig(config);
  return config;
}

export async function saveSettlementCommitteeConfig(config: SettlementCommitteeConfig): Promise<void> {
  await ensurePortalSettingsTable();
  const payload = JSON.stringify(config);
  await prisma.$executeRaw`
    INSERT INTO "PortalSetting" ("key", "value", "updatedAt")
    VALUES (${SETTING_KEY}, ${payload}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET "value" = ${payload}, "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function listReviewerOptionsForSettlement() {
  const { Role } = await import("@prisma/client");
  return prisma.user.findMany({
    where: { role: { in: [Role.REVIEWER, Role.COMMITTEE] } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });
}
