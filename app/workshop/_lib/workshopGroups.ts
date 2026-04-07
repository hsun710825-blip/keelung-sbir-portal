export type WorkshopGroupId = "A" | "B" | "C";

export type WorkshopGroup = {
  id: WorkshopGroupId;
  label: string;
  teacher: string;
};

export const WORKSHOP_GROUPS: WorkshopGroup[] = [
  { id: "A", label: "A組", teacher: "鍾政偉老師" },
  { id: "B", label: "B組", teacher: "黃瓈葳老師" },
  { id: "C", label: "C組", teacher: "何季澄老師" },
];

export const WORKSHOP_GROUP_MAP: Record<WorkshopGroupId, WorkshopGroup> = {
  A: WORKSHOP_GROUPS[0],
  B: WORKSHOP_GROUPS[1],
  C: WORKSHOP_GROUPS[2],
};

export function normalizeWorkshopGroupId(raw: string | undefined | null): WorkshopGroupId | null {
  const v = String(raw || "").trim().toUpperCase();
  if (v === "A" || v === "B" || v === "C") return v;
  return null;
}
