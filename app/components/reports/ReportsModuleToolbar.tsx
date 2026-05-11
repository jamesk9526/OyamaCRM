/** ReportsModuleToolbar renders compact module and tool selectors for OyamaREPORTIT CRM. */

export type ReportsWorkspaceModule = "donor" | "events" | "compassion" | "ogentic";

export type ReportsToolId =
  | "donor-overview"
  | "donor-donors"
  | "donor-giving"
  | "donor-campaigns"
  | "donor-retention"
  | "events-summary"
  | "events-top-events"
  | "events-attendance"
  | "compassion-kpis"
  | "compassion-cases"
  | "compassion-appointments"
  | "ogentic-queue"
  | "ogentic-drafts"
  | "ogentic-board-pack";

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
];

const MODULE_TOOLS: Record<ReportsWorkspaceModule, ModuleToolDefinition[]> = {
  donor: [
    { id: "donor-overview", label: "Overview" },
    { id: "donor-donors", label: "Donors" },
    { id: "donor-giving", label: "Giving" },
    { id: "donor-campaigns", label: "Campaigns" },
    { id: "donor-retention", label: "Retention" },
  ],
  events: [
    { id: "events-summary", label: "Summary" },
    { id: "events-top-events", label: "Top Events" },
    { id: "events-attendance", label: "Attendance" },
  ],
  compassion: [
    { id: "compassion-kpis", label: "KPIs" },
    { id: "compassion-cases", label: "Cases" },
    { id: "compassion-appointments", label: "Appointments" },
  ],
  ogentic: [
    { id: "ogentic-queue", label: "Queue" },
    { id: "ogentic-drafts", label: "Drafts" },
    { id: "ogentic-board-pack", label: "Board Pack" },
  ],
};

/** Returns the default tool id for a given reports workspace module. */
export function getDefaultReportsTool(moduleId: ReportsWorkspaceModule): ReportsToolId {
  return MODULE_TOOLS[moduleId][0].id;
}

/** ReportsModuleToolbar provides compact module and tool selectors that stay out of the way. */
export default function ReportsModuleToolbar({ activeModule, activeTool, onModuleChange, onToolChange }: ReportsModuleToolbarProps) {
  const tools = MODULE_TOOLS[activeModule] ?? [];

  return (
    <section className="rounded-lg border border-cyan-200 bg-cyan-50/70 px-2.5 py-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700">Reporting Scope</span>
        {MODULE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onModuleChange(tab.id)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
              activeModule === tab.id
                ? "border-cyan-500 bg-cyan-600 text-white"
                : "border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700">Tools</span>
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
