"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { initWorkshopAnalytics, workshopDb } from "@/lib/firebaseWorkshop";
import { WORKSHOP_GROUPS, type WorkshopGroupId } from "@/app/workshop/_lib/workshopGroups";

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function WorkshopStudentPage() {
  const [groupId, setGroupId] = useState<WorkshopGroupId>("A");
  const [companyName, setCompanyName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const selectedGroup = useMemo(
    () => WORKSHOP_GROUPS.find((g) => g.id === groupId) ?? WORKSHOP_GROUPS[0],
    [groupId],
  );

  const canSubmit = companyName.trim() && studentName.trim() && ideaText.trim();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setState("submitting");
    setMessage("");
    try {
      await initWorkshopAnalytics();
      await addDoc(collection(workshopDb, "workshop_ideas"), {
        groupId,
        teacherName: selectedGroup.teacher,
        companyName: companyName.trim(),
        studentName: studentName.trim(),
        ideaText: ideaText.trim(),
        x: null,
        y: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setState("success");
      setMessage("送出成功！已同步到組內工作畫布。");
      setCompanyName("");
      setStudentName("");
      setIdeaText("");
      setTimeout(() => setState("idle"), 1400);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "送出失敗，請稍後再試");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">115年基隆市地方型SBIR撰寫工作坊</h1>
        <p className="mt-1 text-sm text-slate-500">學員手機端：填寫公司與構想，送出後即時同步到組內工作畫布。</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="groupId" className="block text-sm font-medium text-slate-700">
              選擇組別
            </label>
            <select
              id="groupId"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value as WorkshopGroupId)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {WORKSHOP_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label} - {g.teacher}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700">
              公司名稱
            </label>
            <input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="例：嘉澄股份有限公司"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="studentName" className="block text-sm font-medium text-slate-700">
              學員姓名
            </label>
            <input
              id="studentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="例：王小明"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="ideaText" className="block text-sm font-medium text-slate-700">
              計畫構想
            </label>
            <textarea
              id="ideaText"
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              rows={6}
              placeholder="請簡述問題、解法、目標客群與預期效益"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || state === "submitting"}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "submitting" ? "送出中..." : "送出構想"}
          </button>
        </form>

        {message ? (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              state === "success"
                ? "animate-pulse border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}
