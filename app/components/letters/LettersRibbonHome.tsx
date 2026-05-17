/** Adobe Express-style project manager for Letters & Printables. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonFrame from "@/app/components/workspace-ribbon/WorkspaceRibbonFrame";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import { apiFetch } from "@/app/lib/auth-client";
import {
  DEFAULT_BRANDING_SETTINGS,
  fetchBrandingSettings,
  formatBrandingAddress,
  type BrandingSettings,
} from "@/app/lib/branding-settings";
import type { GeneratedLetterSummary, LetterDashboardStats, LetterTemplateSummary } from "@/app/components/letters/types";

type ProjectsView = "templates" | "generated" | "production";
type CardDensity = "large" | "small" | "list";

interface OrganizationSettings {
  orgName: string;
  timezone: string;
  currency: string;
}

interface PrintableProject extends LetterTemplateSummary {
  printSubject?: string | null;
  printBody?: string | null;
  crmScope?: string | null;
}

const PROJECT_TYPES = [
  { id: "THANK_YOU", label: "Thank-You Letter", body: "Dear {{donor.firstName}},\n\nThank you for your generous support. Your gift helps move our mission forward in practical, meaningful ways.\n\nWith gratitude,\n{{organization.name}}" },
  { id: "TAX_RECEIPT", label: "Tax Receipt", body: "Dear {{donor.firstName}},\n\nThank you for your contribution of {{gift.amount}} on {{gift.date}}. Please keep this letter with your tax records.\n\n{{organization.name}}\n{{organization.taxId}}" },
  { id: "NEWSLETTER", label: "Printable Newsletter", body: "{{organization.name}} Update\n\nThis month, your support helped create measurable impact for the people we serve.\n\nHighlights:\n- Program milestone\n- Community story\n- Upcoming opportunity" },
  { id: "GENERAL", label: "Blank Printable", body: "Start writing your printable here.\n\nUse merge fields like {{donor.firstName}} when the piece needs donor-specific content." },
] as const;

/** Converts dates into compact project metadata text. */
function formatProjectDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Strips basic HTML so project thumbnails can display either rich or plain template content. */
function previewText(value?: string | null): string {
  return (value || "No printable content yet.")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mini printable page preview with organization branding applied from settings. */
function PrintablePreview({
  title,
  body,
  branding,
  compact = false,
}: {
  title?: string | null;
  body?: string | null;
  branding: BrandingSettings;
  compact?: boolean;
}) {
  const organizationName = branding.organizationDisplayName || branding.legalOrganizationName || "Organization";
  const address = formatBrandingAddress(branding);

  return (
    <div className={`overflow-hidden rounded-md border border-gray-200 bg-gray-100 ${compact ? "h-28" : "h-48"}`}>
      <div
        className="origin-top-left bg-white text-gray-900 shadow-sm"
        style={{
          width: 612,
          minHeight: 792,
          transform: compact ? "scale(0.24)" : "scale(0.31)",
          transformOrigin: "top left",
        }}
      >
        <div className="border-b px-10 py-7" style={{ borderColor: branding.primaryColor }}>
          <div className="flex items-center gap-4">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={`${organizationName} logo`} className="h-12 w-12 object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-sm text-lg font-bold text-white" style={{ backgroundColor: branding.primaryColor }}>
                {organizationName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold">{organizationName}</p>
              {branding.tagline && <p className="text-xs text-gray-500">{branding.tagline}</p>}
            </div>
          </div>
        </div>
        <div className="px-10 py-8">
          <p className="text-xl font-semibold">{title || "Untitled Printable"}</p>
          <div className="mt-6 whitespace-pre-line text-sm leading-7 text-gray-700">
            {previewText(body).slice(0, 720)}
          </div>
        </div>
        <div className="mt-auto border-t px-10 py-5 text-[10px] leading-4 text-gray-500">
          <p>{organizationName}</p>
          {address && <p>{address}</p>}
          {branding.websiteUrl && <p>{branding.websiteUrl}</p>}
        </div>
      </div>
    </div>
  );
}

/** LettersRibbonHome is the single entry point for printable projects and production queues. */
export default function LettersRibbonHome() {
  const [stats, setStats] = useState<LetterDashboardStats | null>(null);
  const [templates, setTemplates] = useState<PrintableProject[]>([]);
  const [generated, setGenerated] = useState<GeneratedLetterSummary[]>([]);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ProjectsView>("templates");
  const [density, setDensity] = useState<CardDensity>("large");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectType, setNewProjectType] = useState<(typeof PROJECT_TYPES)[number]["id"]>("THANK_YOU");
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, templatesResult, generatedResult, brandingResult, organizationResult] = await Promise.allSettled([
        apiFetch<LetterDashboardStats>("/api/letters/dashboard"),
        apiFetch<PrintableProject[]>("/api/letters/templates"),
        apiFetch<GeneratedLetterSummary[]>("/api/letters/generated?limit=80"),
        fetchBrandingSettings(),
        apiFetch<OrganizationSettings>("/api/settings"),
      ]);

      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setTemplates(templatesResult.status === "fulfilled" ? templatesResult.value : []);
      setGenerated(generatedResult.status === "fulfilled" ? generatedResult.value : []);
      setBranding(brandingResult.status === "fulfilled" ? brandingResult.value : DEFAULT_BRANDING_SETTINGS);
      setOrganization(organizationResult.status === "fulfilled" ? organizationResult.value : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load printable projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (statusFilter !== "ALL" && template.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [template.name, template.description, template.category]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [search, statusFilter, templates]);

  const generatedThisMonth = stats?.generatedThisMonth ?? generated.length;
  const queuedForProduction = (stats?.queuedForPrint ?? 0) + (stats?.queuedForMail ?? 0);

  /** Creates a starter printable project and opens the visual canvas editor. */
  async function createProject() {
    const type = PROJECT_TYPES.find((item) => item.id === newProjectType) ?? PROJECT_TYPES[0];
    const orgName = branding.organizationDisplayName || branding.legalOrganizationName || organization?.orgName || "Organization";
    const name = newProjectName.trim() || `${type.label} ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const printBody = type.body.replaceAll("{{organization.name}}", orgName);

    setCreating(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>("/api/letters/templates", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: `Created from ${type.label}. Branding is sourced from Organization and Branding Settings.`,
          category: type.id,
          status: "DRAFT",
          printSubject: name,
          printBody,
          printLayoutJson: [
            { id: "heading-1", kind: "HEADING", content: name, level: 1 },
            { id: "paragraph-1", kind: "PARAGRAPH", content: printBody },
          ],
          logoMode: "ORGANIZATION_DEFAULT",
          crmScope: "DONOR",
        }),
      });
      window.location.href = `/letters-printables/templates/${created.id}`;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create printable project.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <WorkspaceRibbonFrame
      title="Letters & Printables"
      description="Printable projects manager for letters, PDFs, print queues, and mail-ready assets."
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "Letters & Printables", href: "/letters-printables" },
        { label: "Projects" },
      ]}
      statusLabel="Partially Working"
      metadata={`${templates.length} projects · ${generatedThisMonth} generated this month · ${queuedForProduction} in production`}
      primaryAction={<WorkspaceRibbonButton label="New Printable" onClick={() => setShowNewModal(true)} variant="primary" />}
      ribbon={(
        <WorkspaceRibbon>
          <WorkspaceRibbonGroup label="Projects">
            <WorkspaceRibbonButton label="Project Manager" onClick={() => setView("templates")} variant="primary" />
            <WorkspaceRibbonButton label="New Printable" onClick={() => setShowNewModal(true)} />
            <WorkspaceRibbonButton label="Generated" onClick={() => setView("generated")} />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Publish">
            <WorkspaceRibbonButton label="Production Queue" href="/letters-printables/queues?view=production" />
            <WorkspaceRibbonButton label="Print Queue" href="/letters-printables/queues?view=print" />
            <WorkspaceRibbonButton label="Mail Queue" href="/letters-printables/queues?view=mail" />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Brand">
            <WorkspaceRibbonButton label="Organization" href="/settings/organization" />
            <WorkspaceRibbonButton label="Branding" href="/settings/branding" />
            <WorkspaceRibbonButton label="Letter Presets" href="/settings/branding/letter-presets" />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>
      )}
    >
      <div className="space-y-5">
        {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Printable Projects" value={loading ? "-" : String(templates.length)} />
          <MetricCard label="Generated This Month" value={loading ? "-" : String(generatedThisMonth)} />
          <MetricCard label="Print Queue" value={loading ? "-" : String(stats?.queuedForPrint ?? 0)} />
          <MetricCard label="Mail Queue" value={loading ? "-" : String(stats?.queuedForMail ?? 0)} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {[
                { id: "templates", label: "Projects" },
                { id: "generated", label: "Generated" },
                { id: "production", label: "Production" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id as ProjectsView)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === item.id ? "bg-white text-green-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {view === "templates" && (
                <>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search projects"
                    className="w-52 rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs">
                    {["ALL", "DRAFT", "ACTIVE", "ARCHIVED"].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </>
              )}
              <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
                {[
                  { id: "large", label: "Cards" },
                  { id: "small", label: "Small" },
                  { id: "list", label: "List" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDensity(item.id as CardDensity)}
                    className={`rounded px-2 py-1 text-xs font-semibold ${density === item.id ? "bg-green-50 text-green-700" : "text-gray-600"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void load()} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                Refresh
              </button>
            </div>
          </div>
        </section>

        {view === "templates" && (
          <>
            {filteredTemplates.length === 0 && !loading ? (
              <EmptyProjects onCreate={() => setShowNewModal(true)} />
            ) : density === "list" ? (
              <ProjectList templates={filteredTemplates} branding={branding} />
            ) : (
              <div className={density === "small" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
                {(loading ? [] : filteredTemplates).map((template) => (
                  <PrintableProjectCard key={template.id} template={template} branding={branding} compact={density === "small"} />
                ))}
                {loading && Array.from({ length: 6 }).map((_, index) => <div key={String(index)} className="h-64 animate-pulse rounded-lg bg-gray-100" />)}
              </div>
            )}
          </>
        )}

        {view === "generated" && (
          <GeneratedProjects generated={generated} loading={loading} branding={branding} />
        )}

        {view === "production" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <ProductionCard
              title="Print Queue"
              count={stats?.queuedForPrint ?? 0}
              detail="Review, approve, export PDF, and mark printed."
              href="/letters-printables/queues?view=print"
            />
            <ProductionCard
              title="Mail Queue"
              count={stats?.queuedForMail ?? 0}
              detail="Move printed pieces through mail-ready, mailed, returned, and completed states."
              href="/letters-printables/queues?view=mail"
            />
          </section>
        )}

        {showNewModal && (
          <WorkspaceSetupModal
            title="New Printable"
            subtitle="Choose a project type, then edit it visually on the printable canvas."
            checklist={["1. Pick project type", "2. Create project", "3. Edit on canvas", "4. Preview and publish"]}
            onClose={() => {
              if (!creating) setShowNewModal(false);
            }}
            maxWidthClassName="max-w-4xl"
          >
            <div className="max-h-[82vh] overflow-y-auto p-6 pt-12">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Project name
                  <input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="Spring thank-you letter"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  {PROJECT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewProjectType(type.id)}
                      className={`rounded-lg border p-3 text-left transition-colors ${newProjectType === type.id ? "border-green-600 bg-green-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{type.label}</p>
                      <p className="mt-1 text-xs text-gray-500">{type.id.replaceAll("_", " ")}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  Branding will use {branding.organizationDisplayName || branding.legalOrganizationName || organization?.orgName || "your organization"} from Organization and Branding Settings.
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNewModal(false)} disabled={creating} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void createProject()} disabled={creating} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                    {creating ? "Creating..." : "Create Printable"}
                  </button>
                </div>
              </div>
            </div>
          </WorkspaceSetupModal>
        )}
      </div>
    </WorkspaceRibbonFrame>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
      <h2 className="text-base font-semibold text-gray-900">No printable projects found</h2>
      <p className="mt-1 text-sm text-gray-500">Create a letter or printable project, then edit it in the visual canvas.</p>
      <button type="button" onClick={onCreate} className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
        New Printable
      </button>
    </div>
  );
}

function PrintableProjectCard({ template, branding, compact }: { template: PrintableProject; branding: BrandingSettings; compact?: boolean }) {
  return (
    <article className="min-w-0 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300">
      <Link href={`/letters-printables/templates/${template.id}`} className="block">
        <PrintablePreview title={template.printSubject || template.name} body={template.printBody || template.description} branding={branding} compact={compact} />
      </Link>
      <div className="mt-3 min-w-0 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{template.status}</span>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">{template.category.replaceAll("_", " ")}</span>
        </div>
        <div className="min-w-0">
          <Link href={`/letters-printables/templates/${template.id}`} className="truncate text-sm font-semibold text-gray-900 hover:text-green-700">
            {template.name}
          </Link>
          <p className="truncate text-xs text-gray-500">{template.description || "Printable project"}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-400">Updated {formatProjectDate(template.updatedAt)}</p>
          <div className="flex gap-2">
            <Link href={`/letters-printables/templates/${template.id}`} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Edit</Link>
            <Link href={`/letters-printables/templates/${template.id}?panel=publish`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Publish</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectList({ templates, branding }: { templates: PrintableProject[]; branding: BrandingSettings }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-[840px] w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Project</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Category</th>
            <th className="px-4 py-3 font-semibold">Updated</th>
            <th className="px-4 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {templates.map((template) => (
            <tr key={template.id}>
              <td className="px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded border border-gray-200">
                    <PrintablePreview title={template.printSubject || template.name} body={template.printBody || template.description} branding={branding} compact />
                  </div>
                  <div className="min-w-0">
                    <Link href={`/letters-printables/templates/${template.id}`} className="truncate font-semibold text-gray-900 hover:text-green-700">{template.name}</Link>
                    <p className="truncate text-xs text-gray-500">{template.description || "Printable project"}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">{template.status}</td>
              <td className="px-4 py-3 text-xs text-gray-600">{template.category.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 text-xs text-gray-600">{formatProjectDate(template.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Link href={`/letters-printables/templates/${template.id}`} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Edit</Link>
                  <Link href={`/letters-printables/templates/${template.id}?panel=publish`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Publish</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeneratedProjects({ generated, loading, branding }: { generated: GeneratedLetterSummary[]; loading: boolean; branding: BrandingSettings }) {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-lg bg-gray-100" />;
  }
  if (generated.length === 0) {
    return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No generated printables yet.</div>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {generated.slice(0, 18).map((letter) => (
        <article key={letter.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <PrintablePreview title={letter.mergedPrintSubject || letter.template?.name} body={letter.mergedPrintBody} branding={branding} />
          <div className="mt-3">
            <p className="text-sm font-semibold text-gray-900">{letter.template?.name || "Generated printable"}</p>
            <p className="text-xs text-gray-500">
              {letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}` : "No constituent"} · {letter.status}
            </p>
            <p className="mt-1 text-xs text-gray-400">Generated {formatProjectDate(letter.generatedAt)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductionCard({ title, count, detail, href }: { title: string; count: number; detail: string; href: string }) {
  return (
    <Link href={href} className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-gray-300">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{count}</p>
      <p className="mt-2 text-sm text-gray-600">{detail}</p>
    </Link>
  );
}
