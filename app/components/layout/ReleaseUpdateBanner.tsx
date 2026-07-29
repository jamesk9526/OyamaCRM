"use client";

import { useEffect, useState } from "react";

const RELEASE_KEY = "oyama-release-notice-1.31b-dismissed";

export default function ReleaseUpdateBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(window.localStorage.getItem(RELEASE_KEY) !== "true"), []);
  if (!visible) return null;
  return <aside className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-3xl rounded-lg border border-[#0f6cbd] bg-white p-4 shadow-2xl" aria-label="OyamaCRM 1.31b updates">
    <div className="flex gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">OyamaCRM 1.31b is ready</p><span className="rounded-full bg-[#0f6cbd] px-2 py-0.5 text-[10px] font-bold text-white">NEW</span></div><ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2"><li>• Template Convert adds reviewed email ↔ letter companions.</li><li>• Constituent merges can now be undone from the profile.</li><li>• Feedback tickets capture richer page diagnostics.</li><li>• Release checks now cover web and server typing.</li></ul></div><button type="button" onClick={() => { window.localStorage.setItem(RELEASE_KEY, "true"); setVisible(false); }} className="rounded-[3px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Dismiss</button></div>
  </aside>;
}
