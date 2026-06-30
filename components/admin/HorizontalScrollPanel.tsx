"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";

export function HorizontalScrollPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      return;
    }
    if (e.shiftKey) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center">
        <button
          type="button"
          onClick={() => scrollBy(-320)}
          className="pointer-events-auto ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-sm hover:bg-slate-50"
          aria-label="向左捲動"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center">
        <button
          type="button"
          onClick={() => scrollBy(320)}
          className="pointer-events-auto mr-1 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-sm hover:bg-slate-50"
          aria-label="向右捲動"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={scrollRef}
        onWheel={onWheel}
        className="max-h-[calc(100vh-11rem)] overflow-x-scroll overflow-y-auto [scrollbar-gutter:stable]"
        title="Windows 使用者：可按住 Shift 並滾動滑鼠滾輪左右移動，或使用左右箭頭"
      >
        {children}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        左右捲動：點選箭頭，或按住 Shift + 滑鼠滾輪（Windows）
      </p>
    </div>
  );
}

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-100/80"
      >
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {open ? <div className="border-t border-slate-200 bg-white">{children}</div> : null}
    </section>
  );
}
