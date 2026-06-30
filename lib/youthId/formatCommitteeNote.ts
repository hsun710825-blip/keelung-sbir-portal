import type { YouthResponsiblePerson } from "@/lib/youthId/types";

function formatQualifies(q: boolean | null): string {
  if (q === true) return "是";
  if (q === false) return "否";
  return "待查證";
}

export function formatYouthPersonVerificationLine(person: YouthResponsiblePerson): string {
  const name = person.responsibleName?.trim() || "負責人";
  const city = person.registeredCity?.trim();
  const age = person.age;
  if (!city && age == null && person.qualifies == null) {
    return `${name}：待查證`;
  }
  const cityText = city || "—";
  const ageText = age != null ? String(age) : "—";
  const qualifySuffix =
    person.qualifies === true ? "（符合青年條件）" : person.qualifies === false ? "（不符合青年條件）" : "";
  return `初審查證${name}為設籍於${cityText}、${ageText}歲${qualifySuffix}`;
}

export function formatYouthVerificationNote(persons: YouthResponsiblePerson[]): string | null {
  if (persons.length === 0) return null;
  return persons.map(formatYouthPersonVerificationLine).join("；");
}

export function formatQualifiesLabel(q: boolean | null): string {
  return formatQualifies(q);
}
