"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

type Props = {
  nextOpenLabel?: string;
};

export function CommitteeAccessLockedView({ nextOpenLabel }: Props) {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-4 py-12 font-sans text-slate-800">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.06)] md:p-12">
        <section className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
          <Lock className="h-10 w-10 text-amber-600" strokeWidth={2.2} aria-hidden />
        </section>
        <p className="text-xl font-bold leading-relaxed text-slate-900 md:text-2xl">
          審查委員您好，目前為非審查時間，系統權限鎖定中，將於審查時間再行開放。
        </p>
        {nextOpenLabel ? (
          <p className="mt-4 text-sm text-slate-600 md:text-base">下次開放：{nextOpenLabel}</p>
        ) : null}
        <Link
          href="/"
          className="mt-10 inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          確定
        </Link>
      </section>
    </section>
  );
}
