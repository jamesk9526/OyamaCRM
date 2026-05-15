// Reports Manager - Comprehensive workspace for managing reports, scheduling, and distribution
"use client";

import { useState, useMemo } from "react";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

interface SavedReport {
  id: string;
  name: string;
  template: string;
  createdAt: Date;
  lastRun: Date | null;
  owner: string;
  status: "draft" | "active" | "archived";
  schedule?: {
    frequency: "once" | "daily" | "weekly" | "monthly";
    time?: string;
    recipients?: string[];
    emailOnCompletion?: boolean;
  };
}

type TabType = "saved-reports" | "schedules" | "templates" | "history" | "settings";

export default function ReportsManagerPage() {
  const [activeTab, setActiveTab] = useState<TabType>("saved-reports");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "active" | "archived">("all");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([
    {
      id: "sr-001",
      name: "Monthly Donor Summary",
      template: "donor-summary",
      createdAt: new Date("2024-01-15"),
      lastRun: new Date("2024-12-01"),
      owner: "John Doe",
      status: "active",
      schedule: {
        frequency: "monthly",
        time: "09:00",
        recipients: ["director@org.com", "development@org.com"],
        emailOnCompletion: true,
      },
    },
    {
      id: "sr-002",
      name: "Year-End Giving Report",
      template: "year-to-date-giving",
      createdAt: new Date("2024-10-01"),
      lastRun: new Date("2024-12-15"),
      owner: "Jane Smith",
      status: "active",
      schedule: {
        frequency: "monthly",
        time: "08:00",
        emailOnCompletion: false,
      },
    },
  ]);

  const filteredReports = useMemo(() => {
    return savedReports.filter((report) => {
      const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.template.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || report.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [savedReports, searchQuery, filterStatus]);

  function handleCreateReport() {
    // TODO: Open report creation dialog
  }

  function handleEditReport(reportId: string) {
    // TODO: Open report edit dialog
  }

  function handleDeleteReport(reportId: string) {
    setSavedReports(savedReports.filter((r) => r.id !== reportId));
  }

  function handleToggleSchedule(reportId: string) {
    setSavedReports(
      savedReports.map((r) =>
        r.id === reportId ? { ...r, status: r.status === "active" ? "draft" : "active" } : r
      )
    );
  }

  return (
    <EnterprisePageShell
      ribbon={
        <div className="space-y-3">
          <WorkspaceBreadcrumbBar
            items={[{ label: "DonorCRM", href: "/" }, { label: "Reports Manager" }]}
            statusLabel="Reports Hub"
            metadata={`${savedReports.length} saved reports`}
            primaryAction={
              <button
                type="button"
                onClick={handleCreateReport}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-green-600 bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Report
              </button>
            }
          />
          <WorkspaceRibbon>
            <WorkspaceRibbonGroup label="View">
              <WorkspaceRibbonButton
                label="Saved Reports"
                onClick={() => setActiveTab("saved-reports")}
                active={activeTab === "saved-reports"}
              />
              <WorkspaceRibbonButton
                label="Schedules"
                onClick={() => setActiveTab("schedules")}
                active={activeTab === "schedules"}
              />
              <WorkspaceRibbonButton
                label="Templates"
                onClick={() => setActiveTab("templates")}
                active={activeTab === "templates"}
              />
              <WorkspaceRibbonButton
                label="History"
                onClick={() => setActiveTab("history")}
                active={activeTab === "history"}
              />
            </WorkspaceRibbonGroup>
          </WorkspaceRibbon>
        </div>
      }
      contentClassName="space-y-4"
    >
      {activeTab === "saved-reports" && (
        <SavedReportsTab
          reports={filteredReports}
          searchQuery={searchQuery}
          filterStatus={filterStatus}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterStatus}
          onEdit={handleEditReport}
          onDelete={handleDeleteReport}
          onToggleSchedule={handleToggleSchedule}
        />
      )}

      {activeTab === "schedules" && <SchedulesTab reports={savedReports} />}

      {activeTab === "templates" && <TemplatesTab />}

      {activeTab === "history" && <HistoryTab />}
    </EnterprisePageShell>
  );
}

function SavedReportsTab({
  reports,
  searchQuery,
  filterStatus,
  onSearchChange,
  onFilterChange,
  onEdit,
  onDelete,
  onToggleSchedule,
}: {
  reports: SavedReport[];
  searchQuery: string;
  filterStatus: string;
  onSearchChange: (query: string) => void;
  onFilterChange: (status: any) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSchedule: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search and filter bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search saved reports..."
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100"
        />
        <select
          value={filterStatus}
          onChange={(e) => onFilterChange(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Reports table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Report Name
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Template
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Owner
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Status
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Last Run
                </th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                    No saved reports found
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-900 font-medium">{report.name}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{report.template}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{report.owner}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${
                          report.status === "active"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : report.status === "draft"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {report.lastRun ? report.lastRun.toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(report.id)}
                          className="text-slate-500 hover:text-slate-700 transition"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onToggleSchedule(report.id)}
                          className={`${report.status === "active" ? "text-green-600" : "text-slate-400"} hover:opacity-75 transition`}
                          title={report.status === "active" ? "Disable" : "Enable"}
                        >
                          ⏱️
                        </button>
                        <button
                          onClick={() => onDelete(report.id)}
                          className="text-slate-400 hover:text-red-600 transition"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SchedulesTab({ reports }: { reports: SavedReport[] }) {
  const scheduledReports = reports.filter((r) => r.schedule && r.status === "active");

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {scheduledReports.length} report{scheduledReports.length !== 1 ? "s" : ""} scheduled for automatic generation
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {scheduledReports.map((report) => (
          <div key={report.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">{report.name}</h3>
                <p className="mt-1 text-xs text-slate-600">
                  {report.schedule?.frequency === "monthly"
                    ? `Monthly at ${report.schedule.time}`
                    : report.schedule?.frequency === "weekly"
                    ? `Weekly at ${report.schedule.time}`
                    : `Daily at ${report.schedule?.time}`}
                </p>
              </div>
              <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold border border-green-200 bg-green-50 text-green-700">
                Active
              </span>
            </div>
            {report.schedule?.recipients && report.schedule.recipients.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold uppercase text-slate-500">Recipients</p>
                <div className="mt-2 space-y-1">
                  {report.schedule.recipients.map((email) => (
                    <p key={email} className="text-xs text-slate-700">
                      {email}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {scheduledReports.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">No scheduled reports yet</p>
        </div>
      )}
    </div>
  );
}

function TemplatesTab() {
  const templates = [
    { id: "donor-summary", name: "Donor Summary", category: "Giving" },
    { id: "donor-retention", name: "Donor Retention", category: "Retention" },
    { id: "year-to-date-giving", name: "Year-to-Date Giving", category: "Giving" },
    { id: "campaign-performance", name: "Campaign Performance", category: "Campaigns & Funds" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{templates.length} report templates available</p>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{template.name}</h3>
                <p className="mt-1 text-xs text-slate-600">{template.category}</p>
              </div>
            </div>
            <button className="mt-4 w-full text-sm font-semibold text-green-600 hover:text-green-700">
              Create from template →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab() {
  const history = [
    { id: "h-001", report: "Monthly Donor Summary", runAt: new Date("2024-12-01"), status: "success", rows: 245 },
    { id: "h-002", report: "Year-End Giving Report", runAt: new Date("2024-12-15"), status: "success", rows: 1823 },
    { id: "h-003", report: "Monthly Donor Summary", runAt: new Date("2024-11-01"), status: "success", rows: 238 },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{history.length} recent report runs</p>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Report
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Run Date/Time
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Status
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Rows
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-slate-900 font-medium">{entry.report}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs">
                    {entry.runAt.toLocaleDateString()} {entry.runAt.toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold border border-green-200 bg-green-50 text-green-700">
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{entry.rows.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
