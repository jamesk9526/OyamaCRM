// Left category rail for the Oyama Reports app.

"use client";

import type { ReportCategory, ReportCategoryId, ReportDefinition, SavedReportView } from "@/app/components/reports-app/report-types";

interface ReportCategoryRailProps {
  categories: ReportCategory[];
  reports: ReportDefinition[];
  savedViews: SavedReportView[];
  activeCategory: ReportCategoryId;
  activeReportId: string;
  onSelectCategory: (categoryId: ReportCategoryId) => void;
  onSelectReport: (reportId: string) => void;
  onOpenBuilder: () => void;
}

function RailIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`h-3.5 w-3.5 ${active ? "text-white" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 12h16M4 19h16" />
    </svg>
  );
}

export default function ReportCategoryRail({
  categories,
  reports,
  savedViews,
  activeCategory,
  activeReportId,
  onSelectCategory,
  onSelectReport,
  onOpenBuilder,
}: ReportCategoryRailProps) {
  const favorites = reports.filter((report) => ["monthly-giving-report", "top-donors", "donations-by-designation"].includes(report.id));
  const recent = reports.filter((report) => report.lastRun !== "Not run").slice(0, 4);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-[#d1d1d1] bg-white lg:w-[17rem]" data-testid="reports-category-rail">
      <div className="border-l-4 border-[#0f6cbd] border-b border-[#4b4b4b] bg-[#292929] px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">Oyama Reports</p>
        <p className="mt-1 text-xs leading-5 text-white">Live reporting, saved views, exports, and print.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          className={`mb-4 flex h-9 w-full items-center gap-2 rounded-[2px] px-2.5 text-left text-xs font-semibold transition ${
            activeCategory === "all" ? "bg-[#0f6cbd] text-white" : "text-slate-700 hover:bg-[#f3f2f1]"
          }`}
        >
          <RailIcon active={activeCategory === "all"} />
          All Reports
        </button>

        <div className="space-y-5">
          <section>
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Favorites</p>
            <div className="mt-2 space-y-1">
              {favorites.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => onSelectReport(report.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-[2px] px-2 py-2 text-left text-xs transition ${
                    activeReportId === report.id ? "border-l-2 border-[#0f6cbd] bg-[#eff6fc] text-[#0f548c]" : "text-slate-600 hover:bg-[#f3f2f1] hover:text-slate-900"
                  }`}
                >
                  <span className="min-w-0 truncate">{report.title}</span>
                  <span className="text-amber-400" aria-hidden="true">*</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Categories</p>
            <div className="mt-2 space-y-1">
              {categories.filter((category) => category.id !== "all").map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-[2px] px-2 py-2 text-left text-xs font-medium transition ${
                    activeCategory === category.id ? "border-l-2 border-[#0f6cbd] bg-[#eff6fc] text-[#0f548c]" : "text-slate-600 hover:bg-[#f3f2f1] hover:text-slate-900"
                  }`}
                >
                  <span className="min-w-0 truncate">{category.label}</span>
                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Recent Reports</p>
            <div className="mt-2 space-y-1">
              {recent.map((report) => (
                <button
                  key={`recent-${report.id}`}
                  type="button"
                  onClick={() => onSelectReport(report.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-[2px] px-2 py-2 text-left text-xs text-slate-600 hover:bg-[#f3f2f1] hover:text-slate-900"
                >
                  <span className="min-w-0 truncate">{report.title}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{report.lastRun.split(",")[0]}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Saved Views</p>
            <div className="mt-2 space-y-1">
              {savedViews.length === 0 ? (
                <p className="rounded-[2px] border border-dashed border-[#d1d1d1] px-2 py-3 text-xs text-slate-400">No saved views yet.</p>
              ) : (
                savedViews.slice(0, 4).map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => onSelectReport(view.reportId)}
                    className="w-full rounded-[2px] px-2 py-2 text-left text-xs text-slate-600 hover:bg-[#f3f2f1] hover:text-slate-900"
                  >
                    <span className="block truncate font-medium">{view.name}</span>
                    <span className="text-[10px] text-slate-400">{new Date(view.createdAt).toLocaleDateString()}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={onOpenBuilder}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[2px] border border-[#0f6cbd] bg-white px-3 text-xs font-semibold text-[#0f548c] hover:bg-[#eff6fc]"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          Create Custom Report
        </button>
      </div>
    </aside>
  );
}
