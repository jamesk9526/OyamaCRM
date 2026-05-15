/** ReportsModuleToolbar renders compact scope switching for OShareview reports. */

import { useMemo, useState } from "react";

export type ReportsWorkspaceModule = "donor" | "events" | "compassion" | "ogentic" | "admin";

export type ReportsToolId =
  | "donor-overview"
  | "donor-donors"
  | "donor-donor-packet"
  | "donor-giving"
  | "donor-campaigns"
  | "donor-retention"
  | "donor-pipeline"
  | "donor-payment-methods"
  | "donor-segmentation"
  | "events-summary"
  | "events-top-events"
  | "events-attendance"
  | "events-revenue"
  | "events-operations"
  | "events-checkin-risk"
  | "events-type-mix"
  | "compassion-kpis"
  | "compassion-cases"
  | "compassion-appointments"
  | "compassion-intake"
  | "compassion-outcomes"
  | "compassion-workload"
  | "compassion-data-quality"
  | "ogentic-queue"
  | "ogentic-drafts"
  | "ogentic-board-pack"
  | "ogentic-sources"
  | "ogentic-execution"
  | "admin-overview"
  | "admin-donor-ops"
  | "admin-client-ops"
  | "admin-data-quality"
  | "admin-governance";

interface ReportsModuleToolbarProps {
  activeModule: ReportsWorkspaceModule;
  activeTool: ReportsToolId;
  onModuleChange: (moduleId: ReportsWorkspaceModule) => void;
  onToolChange: (toolId: ReportsToolId) => void;
}

interface ModuleTabDefinition {
  id: ReportsWorkspaceModule;
  label: string;
}

interface ModuleToolDefinition {
  id: ReportsToolId;
  label: string;
}

const MODULE_TABS: ModuleTabDefinition[] = [
  { id: "donor", label: "Donor" },
  { id: "events", label: "Events" },
  { id: "compassion", label: "Compassion" },
  { id: "ogentic", label: "OGentic" },
  { id: "admin", label: "Admin" },
];

const MODULE_TOOLS: Record<ReportsWorkspaceModule, ModuleToolDefinition[]> = {
  donor: [
    { id: "donor-overview", label: "Overview" },
    { id: "donor-donors", label: "Donors" },
    { id: "donor-donor-packet", label: "Donor Packet" },
    { id: "donor-giving", label: "Giving" },
    { id: "donor-campaigns", label: "Campaigns" },
    { id: "donor-retention", label: "Retention" },
    { id: "donor-pipeline", label: "Pipeline" },
    { id: "donor-payment-methods", label: "Payment Methods" },
    { id: "donor-segmentation", label: "Segmentation" },
  ],
  events: [
    { id: "events-summary", label: "Summary" },
    { id: "events-top-events", label: "Top Events" },
    { id: "events-attendance", label: "Attendance" },
    { id: "events-revenue", label: "Revenue" },
    { id: "events-operations", label: "Operations" },
    { id: "events-checkin-risk", label: "Check-in Risk" },
    { id: "events-type-mix", label: "Type Mix" },
  ],
  compassion: [
    { id: "compassion-kpis", label: "KPIs" },
    { id: "compassion-cases", label: "Cases" },
    { id: "compassion-appointments", label: "Appointments" },
    { id: "compassion-intake", label: "Intake" },
    { id: "compassion-outcomes", label: "Outcomes" },
    { id: "compassion-workload", label: "Workload" },
    { id: "compassion-data-quality", label: "Data Quality" },
  ],
  ogentic: [
    { id: "ogentic-queue", label: "Queue" },
    { id: "ogentic-drafts", label: "Drafts" },
    { id: "ogentic-board-pack", label: "Board Pack" },
    { id: "ogentic-sources", label: "Source Mix" },
    { id: "ogentic-execution", label: "Execution" },
  ],
  admin: [
    { id: "admin-overview", label: "Overview" },
    { id: "admin-donor-ops", label: "Donor Ops" },
    { id: "admin-client-ops", label: "Client Ops" },
    { id: "admin-data-quality", label: "Data Quality" },
    { id: "admin-governance", label: "Governance" },
  ],
};

/** Returns the default tool id for a given reports workspace module. */
export function getDefaultReportsTool(moduleId: ReportsWorkspaceModule): ReportsToolId {
  return MODULE_TOOLS[moduleId][0].id;
}

/** ReportsModuleToolbar provides compact module and tool selectors that stay out of the way. */
export default function ReportsModuleToolbar({ activeModule, activeTool, onModuleChange, onToolChange }: ReportsModuleToolbarProps) {
  const [open, setOpen] = useState(false);
  const tools = MODULE_TOOLS[activeModule] ?? [];
  const activeModuleLabel = MODULE_TABS.find((tab) => tab.id === activeModule)?.label ?? "Donor";
  const activeToolLabel = tools.find((tool) => tool.id === activeTool)?.label ?? tools[0]?.label ?? "Overview";

  const groupedTools = useMemo(
    () => MODULE_TABS.map((tab) => ({
      module: tab,
      tools: MODULE_TOOLS[tab.id] ?? [],
    })),
    [],
  );

  function selectModule(moduleId: ReportsWorkspaceModule) {
    onModuleChange(moduleId);
    onToolChange(getDefaultReportsTool(moduleId));
  }

  function selectTool(toolId: ReportsToolId) {
    onToolChange(toolId);
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="w-full rounded-xl border border-cyan-300 bg-white px-3 py-2 text-left shadow-sm hover:border-cyan-400"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Reporting Scope</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-900 truncate">{activeModuleLabel} / {activeToolLabel}</p>
            <svg className={`h-4 w-4 text-cyan-700 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label="Close scope switcher"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
            />
            <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-auto rounded-2xl border border-cyan-200 bg-white p-2.5 shadow-xl">
              <div className="space-y-2">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">Workspaces</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODULE_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => selectModule(tab.id)}
                      className={`rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition-colors ${
                        activeModule === tab.id
                          ? "border-cyan-500 bg-cyan-600 text-white"
                          : "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">Tools</p>
                {groupedTools.map(({ module, tools: moduleTools }) => (
                  <div key={module.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{module.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {moduleTools.map((tool) => (
                        <button
                          key={tool.id}
                          onClick={() => {
                            onModuleChange(module.id);
                            selectTool(tool.id);
                          }}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                            activeModule === module.id && activeTool === tool.id
                              ? "border-cyan-500 bg-white text-cyan-900"
                              : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-700"
                          }`}
                        >
                          {tool.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
              activeTool === tool.id
                ? "border-cyan-500 bg-white text-cyan-900"
                : "border-cyan-200 bg-white/70 text-cyan-700 hover:bg-white"
            }`}
          >
            {tool.label}
          </button>
        ))}
      </div>
    </section>
  );
}
