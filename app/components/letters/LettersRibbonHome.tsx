/** Ribbon-first home screen for Letters & Printables production workflows. */
"use client";

import { useCallback, useEffect, useState } from "react";
import WorkspaceProjectLibrary from "@/app/components/workspace-ribbon/WorkspaceProjectLibrary";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonFrame from "@/app/components/workspace-ribbon/WorkspaceRibbonFrame";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import { apiFetch } from "@/app/lib/auth-client";
import type { LetterDashboardStats } from "@/app/components/letters/types";

/**
 * Presents a project-manager-first entry point for letters production work.
 */
export default function LettersRibbonHome() {
  const [stats, setStats] = useState<LetterDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<LetterDashboardStats>("/api/letters/dashboard");
      setStats(result);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WorkspaceRibbonFrame
      title="Letters & Printables"
      description="Production manager for template libraries, merge workflows, and print/mail queue operations."
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "Letters & Printables", href: "/letters-printables" },
        { label: "Production Workspace" },
      ]}
      statusLabel="Partially Working"
      metadata={`${stats?.activeTemplates ?? 0} templates · ${stats?.queuedForPrint ?? 0} queued for print · ${stats?.queuedForMail ?? 0} queued for mail`}
      primaryAction={<WorkspaceRibbonButton label="Generate Letter" href="/letters-printables/generate/template" variant="primary" />}
      ribbon={(
        <WorkspaceRibbon>
          <WorkspaceRibbonGroup label="Library">
            <WorkspaceRibbonButton label="Templates" href="/letters-printables/templates" />
            <WorkspaceRibbonButton label="Presets" href="/letters-printables/presets" />
            <WorkspaceRibbonButton label="Generated Letters" href="/letters-printables/generated" />
            <WorkspaceRibbonButton label="Batches" href="/letters-printables/batches" />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Create">
            <WorkspaceRibbonButton label="New Template" href="/letters-printables/templates/new" />
            <WorkspaceRibbonButton label="Generate Letter" href="/letters-printables/generate/template" variant="primary" />
            <WorkspaceRibbonButton label="Batch Generate" href="/letters-printables/batches" />
            <WorkspaceRibbonButton label="Duplicate" href="/letters-printables/templates" />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Merge">
            <WorkspaceRibbonButton label="Recipients" href="/letters-printables/generate/recipients" />
            <WorkspaceRibbonButton label="Merge Fields" href="/letters-printables/generate/preview" />
            <WorkspaceRibbonButton label="Preview" href="/letters-printables/generate/preview" />
            <WorkspaceRibbonButton label="Validate" href="/letters-printables/generate/complete" />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Production">
            <WorkspaceRibbonButton label="Print Queue" href="/letters-printables/print-queue" />
            <WorkspaceRibbonButton label="Mail Queue" href="/letters-printables/mail-queue" />
            <WorkspaceRibbonButton label="Export PDF" href="/letters-printables/generated" />
            <WorkspaceRibbonButton label="Mark Complete" href="/letters-printables/mail-queue" />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Setup">
            <WorkspaceRibbonButton label="Branding" href="/letters-printables/branding" />
            <WorkspaceRibbonButton label="Headers" href="/letters-printables/presets/headers" />
            <WorkspaceRibbonButton label="Footers" href="/letters-printables/presets/footers" />
            <WorkspaceRibbonButton label="Signatures" href="/letters-printables/presets/signatures" />
            <WorkspaceRibbonButton label="Settings" href="/letters-printables/settings" />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>
      )}
    >
      <WorkspaceProjectLibrary
        heading="Letters & Printables Home"
        helper="Start with a library surface, then move through the guided generation workflow."
        items={[
          {
            id: "templates",
            title: "Template Library",
            description: "Manage reusable templates and category-specific letter formats.",
            href: "/letters-printables/templates",
            badge: `${stats?.activeTemplates ?? 0}`,
          },
          {
            id: "generated",
            title: "Generated Letters",
            description: "Review generated outputs before print, mail, or email handoff.",
            href: "/letters-printables/generated",
            badge: `${stats?.generatedThisMonth ?? 0}`,
          },
          {
            id: "print-queue",
            title: "Print Queue",
            description: "Track and complete queued print production batches.",
            href: "/letters-printables/print-queue",
            badge: `${stats?.queuedForPrint ?? 0}`,
          },
          {
            id: "mail-queue",
            title: "Mail Queue",
            description: "Manage mailed, returned, and address issue transitions.",
            href: "/letters-printables/mail-queue",
            badge: `${stats?.queuedForMail ?? 0}`,
          },
          {
            id: "batch-jobs",
            title: "Batch Jobs",
            description: "Run and monitor batch generation operations for larger outreach sets.",
            href: "/letters-printables/batches",
          },
          {
            id: "presets",
            title: "Presets Library",
            description: "Manage headers, footers, signatures, branding, and reusable layouts.",
            href: "/letters-printables/presets",
            badge: "Library",
          },
        ]}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Generation Workflow</h2>
        <p className="mt-1 text-xs text-gray-600">
          Choose project type, pick template/preset, choose recipients, preview merge output, then generate and route to print, mail, or email draft.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <WorkspaceRibbonButton label="Start Wizard" href="/letters-printables/generate/template" variant="primary" />
          <WorkspaceRibbonButton label="Open Existing Generate Center" href="/letters-printables/generate" />
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
            {loading ? "Loading metrics..." : "Server PDF export is enabled for generated letters, with browser print still available as a fallback."}
          </span>
        </div>
      </section>
    </WorkspaceRibbonFrame>
  );
}
