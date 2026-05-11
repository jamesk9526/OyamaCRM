/** OGenticToolPanel renders categorized tool controls with risk labels and development-state clarity. */

import Link from "next/link";
import { listOGenticTools } from "@/app/modules/ogentic/services/ogenticToolRegistry";

/** OGenticToolPanel presents the initial internal tool registry grouped by category. */
export default function OGenticToolPanel() {
  const categories: Array<{ label: string; category: Parameters<typeof listOGenticTools>[0] }> = [
    { label: "Donor Tools", category: "donor" },
    { label: "Event Tools", category: "event" },
    { label: "Client Tools", category: "client" },
    { label: "Communication Tools", category: "communication" },
    { label: "Spreadsheet Tools", category: "spreadsheet" },
    { label: "Task Tools", category: "task" },
    { label: "Analysis Tools", category: "analysis" },
    { label: "Import/Export Tools", category: "export" },
  ];

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 min-h-0 flex flex-col">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Tool Context</h2>
        <p className="text-xs text-slate-500 mt-1">Controlled tools with risk-level gating and approval boundaries.</p>
        <p className="mt-2 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] text-cyan-800">
          Reporting tools moved to{" "}
          <Link href="/reports" className="font-semibold underline underline-offset-2 hover:text-cyan-900">
            OyamaREPORTIT CRM
          </Link>
          .
        </p>
      </div>

      <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
        {categories.map((entry) => {
          const tools = listOGenticTools(entry.category);

          return (
            <section key={entry.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <h3 className="text-xs font-semibold text-slate-800">{entry.label}</h3>
              {tools.length === 0 ? (
                <p className="text-[11px] text-amber-700 mt-1">Still being developed. // TODO: backend API needed</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {tools.map((tool) => (
                    <div key={tool.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                      <p className="text-[11px] font-medium text-slate-800">{tool.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{tool.riskLevel.replace("_", " ")} · {tool.requiresApproval ? "Approval required" : "Safe read/draft"}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
