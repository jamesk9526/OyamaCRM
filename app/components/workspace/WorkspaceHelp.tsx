import type { ReactNode } from "react";

export function InfoTooltip({
  label,
  children,
  align = "right",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute top-full z-40 mt-2 hidden w-72 rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 text-[11px] font-medium leading-5 text-white shadow-xl group-hover:block group-focus-within:block",
          align === "left" ? "right-0" : "left-0",
        ].join(" ")}
      >
        {children}
      </span>
    </span>
  );
}

export function WorkspaceHint({
  title,
  children,
  tone = "emerald",
}: {
  title: string;
  children: ReactNode;
  tone?: "emerald" | "sky" | "amber" | "slate";
}) {
  const toneClass = tone === "sky"
    ? "border-sky-200 bg-sky-50 text-sky-950"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "slate"
        ? "border-slate-200 bg-slate-50 text-slate-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";

  const eyebrowClass = tone === "sky"
    ? "text-sky-700"
    : tone === "amber"
      ? "text-amber-700"
      : tone === "slate"
        ? "text-slate-600"
        : "text-emerald-700";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${eyebrowClass}`}>{title}</p>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </div>
  );
}
