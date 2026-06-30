"use client";

export function YouthIdVerificationExportButton() {
  return (
    <a
      href="/api/admin/youth-id-verification/export"
      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
    >
      匯出 Word
    </a>
  );
}
