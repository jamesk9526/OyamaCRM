/**
 * NaturalisticWidgetFrame gives restored dashboard widgets the current calm card treatment.
 */
"use client";

import type { ReactNode } from "react";

interface NaturalisticWidgetFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}

export default function NaturalisticWidgetFrame({
  eyebrow,
  title,
  description,
  children,
  action,
}: NaturalisticWidgetFrameProps) {
  return (
    <article className="flex min-h-[18rem] min-w-0 flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
          <h3 className="mt-1 text-base font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}
