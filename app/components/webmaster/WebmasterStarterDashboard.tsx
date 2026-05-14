"use client";

// Webmaster command-center dashboard with site management and lifecycle controls.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FeatureDevelopmentDialog from "@/app/components/webmaster/FeatureDevelopmentDialog";
import { apiFetch } from "@/app/lib/auth-client";

interface WebmasterSite {
  id: string;
  name: string;
  slug: string;
  siteType:
    | "MAIN_SITE"
    | "LANDING_SITE"
    | "TEMPORARY_SITE"
    | "EVENT_SITE"
    | "DONATION_SITE"
    | "CAMPAIGN_SITE"
    | "PARTNER_PORTAL"
    | "CLIENT_RESOURCE_SITE"
    | "INTERNAL_SITE"
    | "MICROSITE"
    | "BLOG_SITE";
  sitePurpose: string | null;
  connectedModule: "donor" | "events" | "compassion" | "communications" | "webmaster" | "platform" | null;
  connectedRecordId: string | null;
  domain: string | null;
  subdomain: string | null;
  launchStatus: "NOT_READY" | "REVIEW_READY" | "READY_TO_LAUNCH" | "LIVE";
  seoHealthScore: number | null;
  publishingTarget: string | null;
  launchDate: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  lastPublishedAt: string | null;
  publishedVersionId: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  description: string | null;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WebmasterPage {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  path: string;
  status: "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function statusTone(status: WebmasterSite["status"]) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "ARCHIVED") return "bg-slate-100 text-slate-700 border-slate-300";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

const SITE_FILTERS: Array<{ key: string; label: string; siteType?: WebmasterSite["siteType"]; archivedOnly?: boolean }> = [
  { key: "ALL", label: "All" },
  { key: "MAIN_SITE", label: "Main", siteType: "MAIN_SITE" },
  { key: "LANDING_SITE", label: "Landing", siteType: "LANDING_SITE" },
  { key: "EVENT_SITE", label: "Event", siteType: "EVENT_SITE" },
  { key: "DONATION_SITE", label: "Donation", siteType: "DONATION_SITE" },
  { key: "TEMPORARY_SITE", label: "Temporary", siteType: "TEMPORARY_SITE" },
  { key: "ARCHIVED", label: "Archived", archivedOnly: true },
];

/** Dashboard for creating, managing, publishing, and exporting websites. */
export default function WebmasterStarterDashboard() {
  const router = useRouter();
  const [sites, setSites] = useState<WebmasterSite[]>([]);
  const [pagesBySite, setPagesBySite] = useState<Record<string, WebmasterPage[]>>({});
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingSite, setCreatingSite] = useState(false);
  const [siteForm, setSiteForm] = useState({
    name: "",
    slug: "",
    domain: "",
    description: "",
    siteType: "MAIN_SITE" as WebmasterSite["siteType"],
    connectedModule: "" as "" | NonNullable<WebmasterSite["connectedModule"]>,
    sitePurpose: "",
  });
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchText, setSearchText] = useState("");
  const [siteActionLoadingId, setSiteActionLoadingId] = useState<string | null>(null);
  const [featureNotice, setFeatureNotice] = useState<{ title: string; detail: string } | null>(null);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const selectedSitePages = useMemo(
    () => pagesBySite[selectedSiteId] ?? [],
    [pagesBySite, selectedSiteId],
  );

  const missingMetaCount = selectedSitePages.filter((page) => !page.seoDescription?.trim()).length;
  const unpublishedCount = selectedSitePages.filter((page) => page.status !== "PUBLISHED").length;
  const healthIssues = missingMetaCount + (selectedSitePages.length === 0 ? 2 : 0) + (selectedSite?.domain ? 0 : 1);
  const healthScore = Math.max(0, 100 - healthIssues * 15);

  const filteredSites = useMemo(() => {
    const filter = SITE_FILTERS.find((item) => item.key === activeFilter) ?? SITE_FILTERS[0];
    const query = searchText.trim().toLowerCase();

    return sites.filter((site) => {
      if (filter.archivedOnly && site.status !== "ARCHIVED") return false;
      if (filter.siteType && site.siteType !== filter.siteType) return false;

      if (!query) return true;
      return (
        site.name.toLowerCase().includes(query) ||
        site.slug.toLowerCase().includes(query) ||
        (site.domain ?? "").toLowerCase().includes(query) ||
        (site.connectedModule ?? "").toLowerCase().includes(query)
      );
    });
  }, [activeFilter, searchText, sites]);

  const loadPagesForSite = useCallback(async (siteId: string) => {
    if (!siteId) return;

    const data = await apiFetch<{ items: WebmasterPage[] }>(`/api/webmaster/sites/${siteId}/pages`);
    setPagesBySite((current) => ({
      ...current,
      [siteId]: Array.isArray(data.items) ? data.items : [],
    }));
  }, []);

  const loadSites = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ items: WebmasterSite[] }>("/api/webmaster/sites");
      const nextSites = Array.isArray(data.items) ? data.items : [];
      setSites(nextSites);

      const nextSelected = nextSites.some((site) => site.id === selectedSiteId) ? selectedSiteId : (nextSites[0]?.id ?? "");
      setSelectedSiteId(nextSelected);

      if (nextSelected) {
        await loadPagesForSite(nextSelected);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load websites.");
      setSites([]);
      setSelectedSiteId("");
    } finally {
      setLoading(false);
    }
  }, [loadPagesForSite, selectedSiteId]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    setCreatingSite(true);
    setError(null);

    try {
      await apiFetch("/api/webmaster/sites", {
        method: "POST",
        body: JSON.stringify({
          name: siteForm.name,
          slug: siteForm.slug || toSlug(siteForm.name),
          siteType: siteForm.siteType,
          connectedModule: siteForm.connectedModule || undefined,
          sitePurpose: siteForm.sitePurpose || undefined,
          domain: siteForm.domain || undefined,
          description: siteForm.description || undefined,
        }),
      });

      setSiteForm({ name: "", slug: "", domain: "", description: "", siteType: "MAIN_SITE", connectedModule: "", sitePurpose: "" });
      await loadSites();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create website.");
    } finally {
      setCreatingSite(false);
    }
  }

  async function runSiteLifecycleAction(site: WebmasterSite, action: "archive" | "restore" | "duplicate") {
    setSiteActionLoadingId(site.id);
    setError(null);
    try {
      if (action === "archive") {
        await apiFetch(`/api/webmaster/sites/${site.id}/archive`, { method: "POST" });
      } else if (action === "restore") {
        await apiFetch(`/api/webmaster/sites/${site.id}/restore`, { method: "POST" });
      } else {
        await apiFetch(`/api/webmaster/sites/${site.id}/duplicate`, {
          method: "POST",
          body: JSON.stringify({
            name: `${site.name} Copy`,
            slug: `${site.slug}-copy-${Date.now().toString().slice(-4)}`,
          }),
        });
      }
      await loadSites();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed site action.");
    } finally {
      setSiteActionLoadingId(null);
    }
  }

  async function quickCreatePage(kind: "landing" | "donation" | "event" | "blog") {
    if (!selectedSiteId) {
      setFeatureNotice({
        title: "Select a Website First",
        detail: "Choose or create a website before creating a new page from Quick Actions.",
      });
      return;
    }

    const suffix = Date.now().toString().slice(-6);
    const defaults = {
      landing: { title: `Landing Page ${suffix}`, path: `/landing-${suffix}` },
      donation: { title: `Donation Page ${suffix}`, path: `/donate-${suffix}` },
      event: { title: `Event Page ${suffix}`, path: `/event-${suffix}` },
      blog: { title: `Blog Post ${suffix}`, path: `/blog-${suffix}` },
    }[kind];

    try {
      const data = await apiFetch<{ item: WebmasterPage }>(`/api/webmaster/sites/${selectedSiteId}/pages`, {
        method: "POST",
        body: JSON.stringify({
          title: defaults.title,
          slug: toSlug(defaults.title),
          path: defaults.path,
          status: "DRAFT",
        }),
      });

      await loadPagesForSite(selectedSiteId);
      router.push(`/webmaster/editor?siteId=${selectedSiteId}&pageId=${data.item.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create page.");
    }
  }

  async function openSitePreview(siteId: string) {
    let pages = pagesBySite[siteId];

    if (!pages) {
      try {
        const response = await apiFetch<{ items: WebmasterPage[] }>(`/api/webmaster/sites/${siteId}/pages`);
        pages = Array.isArray(response.items) ? response.items : [];
        setPagesBySite((current) => ({ ...current, [siteId]: pages ?? [] }));
      } catch {
        pages = [];
      }
    }

    const previewPage = (pages ?? []).find((page) => page.path === "/") ?? (pages ?? [])[0] ?? null;
    if (!previewPage) {
      router.push(`/webmaster/editor?siteId=${siteId}`);
      return;
    }

    window.open(`/webmaster/preview/${siteId}/${previewPage.id}?draft=1`, "_blank", "noopener,noreferrer");
  }

  function openIncompleteFeature(title: string, detail: string) {
    setFeatureNotice({ title, detail });
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <FeatureDevelopmentDialog
        open={Boolean(featureNotice)}
        title={featureNotice?.title ?? "Feature in progress"}
        detail={featureNotice?.detail ?? "This feature is still being developed."}
        onClose={() => setFeatureNotice(null)}
      />

      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">OyamaWebMaster</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Create, manage, publish, and export websites from one visual workspace.</h1>
        <p className="mt-2 text-sm text-slate-600">Section-first editing with modular architecture, reusable sections, and durable site/page persistence.</p>

        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => {
              const name = `New Website ${new Date().toLocaleDateString()}`;
              setSiteForm((current) => ({ ...current, name, slug: toSlug(name), siteType: "MAIN_SITE" }));
            }}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            New Website
          </button>

          <Link href="/webmaster/templates" className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-center">
            Start from Template
          </Link>

          <Link href="/webmaster/sites" className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-center">
            Import Website Project
          </Link>

          <button
            type="button"
            onClick={() => {
              if (selectedSiteId) {
                router.push(`/webmaster/editor?siteId=${selectedSiteId}`);
                return;
              }

              openIncompleteFeature(
                "No Recent Website",
                "Create your first website, then you can open it directly in the visual builder from this shortcut.",
              );
            }}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Open Recent Site
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Create a Site</h2>
        <form onSubmit={createSite} className="grid md:grid-cols-2 gap-3 mt-3">
          <input
            required
            value={siteForm.name}
            onChange={(e) => setSiteForm((current) => ({ ...current, name: e.target.value }))}
            placeholder="Website name"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <input
            value={siteForm.slug}
            onChange={(e) => setSiteForm((current) => ({ ...current, slug: toSlug(e.target.value) }))}
            placeholder="site-slug"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <input
            value={siteForm.domain}
            onChange={(e) => setSiteForm((current) => ({ ...current, domain: e.target.value }))}
            placeholder="Domain (optional)"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <input
            value={siteForm.sitePurpose}
            onChange={(e) => setSiteForm((current) => ({ ...current, sitePurpose: e.target.value }))}
            placeholder="Site purpose (optional)"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <select
            value={siteForm.siteType}
            onChange={(e) => setSiteForm((current) => ({ ...current, siteType: e.target.value as WebmasterSite["siteType"] }))}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300"
          >
            <option value="MAIN_SITE">Main Site</option>
            <option value="LANDING_SITE">Landing Site</option>
            <option value="EVENT_SITE">Event Site</option>
            <option value="DONATION_SITE">Donation Site</option>
            <option value="TEMPORARY_SITE">Temporary Site</option>
            <option value="CAMPAIGN_SITE">Campaign Site</option>
            <option value="MICROSITE">Microsite</option>
            <option value="BLOG_SITE">Blog Site</option>
            <option value="INTERNAL_SITE">Internal Site</option>
            <option value="PARTNER_PORTAL">Partner Portal</option>
            <option value="CLIENT_RESOURCE_SITE">Client Resource Site</option>
          </select>
          <select
            value={siteForm.connectedModule}
            onChange={(e) => setSiteForm((current) => ({ ...current, connectedModule: e.target.value as "" | NonNullable<WebmasterSite["connectedModule"]> }))}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300"
          >
            <option value="">No connected module</option>
            <option value="donor">DonorCRM</option>
            <option value="events">Events</option>
            <option value="compassion">Compassion CRM</option>
            <option value="communications">Communications</option>
            <option value="webmaster">Webmaster</option>
            <option value="platform">Platform</option>
          </select>
          <input
            value={siteForm.description}
            onChange={(e) => setSiteForm((current) => ({ ...current, description: e.target.value }))}
            placeholder="Short description"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300"
          />

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={creatingSite}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creatingSite ? "Creating..." : "Create Website"}
            </button>
          </div>
        </form>
      </section>

      <div className="grid xl:grid-cols-[1.7fr_1fr] gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Site Manager</h2>
            <button type="button" onClick={() => void loadSites()} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {SITE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${activeFilter === filter.key ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
              >
                {filter.label}
              </button>
            ))}
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search site manager"
              className="ml-auto min-w-56 px-3 py-1.5 text-xs rounded-lg border border-slate-300"
            />
          </div>

          {filteredSites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              No sites match this filter yet. Create or restore a site to continue.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSites.map((site) => (
                <article key={site.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSiteId(site.id);
                          if (!pagesBySite[site.id]) {
                            void loadPagesForSite(site.id);
                          }
                        }}
                        className="text-left"
                      >
                        <h3 className="text-sm font-semibold text-slate-900">{site.name}</h3>
                      </button>
                      <p className="text-xs text-slate-500 mt-1">{site.domain || "No domain configured"}</p>
                      <p className="text-xs text-slate-500 mt-1">{site.siteType.replaceAll("_", " ")} {site.connectedModule ? `• ${site.connectedModule}` : ""}</p>
                      <p className="text-xs text-slate-500 mt-1">Updated {new Date(site.updatedAt).toLocaleString()}</p>
                    </div>

                    <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${statusTone(site.status)}`}>
                      {site.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={`/webmaster/editor?siteId=${site.id}`} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void openSitePreview(site.id)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Preview
                    </button>
                    <Link
                      href={`/webmaster/publishing?siteId=${site.id}`}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Open Publish Setup
                    </Link>
                    <button
                      type="button"
                      onClick={() => openIncompleteFeature("Export Workflow", "Static ZIP and project JSON export are still being implemented.")}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      onClick={() => void runSiteLifecycleAction(site, "duplicate")}
                      disabled={siteActionLoadingId === site.id}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Duplicate
                    </button>
                    {site.status === "ARCHIVED" ? (
                      <button
                        type="button"
                        onClick={() => void runSiteLifecycleAction(site, "restore")}
                        disabled={siteActionLoadingId === site.id}
                        className="px-3 py-1.5 text-xs rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void runSiteLifecycleAction(site, "archive")}
                        disabled={siteActionLoadingId === site.id}
                        className="px-3 py-1.5 text-xs rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button type="button" onClick={() => void quickCreatePage("landing")} className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Create landing page</button>
              <button type="button" onClick={() => void quickCreatePage("donation")} className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Create donation page</button>
              <button type="button" onClick={() => void quickCreatePage("event")} className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Create event page</button>
              <button type="button" onClick={() => void quickCreatePage("blog")} className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Create blog post</button>
              <Link href="/webmaster/assets" className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Open media library</Link>
              <Link href="/webmaster/theme" className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Open brand kit</Link>
              <Link href="/webmaster/publishing" className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Open publishing settings</Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Site Health</h2>
            {selectedSite ? (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold text-slate-900">Selected Site:</span> {selectedSite.name}</p>
                <p><span className="font-semibold text-slate-900">Pages:</span> {selectedSitePages.length}</p>
                <p><span className="font-semibold text-slate-900">Missing meta descriptions:</span> {missingMetaCount}</p>
                <p><span className="font-semibold text-slate-900">Broken links:</span> Pending full crawler checks</p>
                <p><span className="font-semibold text-slate-900">Missing alt text:</span> Pending image audit checks</p>
                <p><span className="font-semibold text-slate-900">Unpublished changes:</span> {unpublishedCount}</p>
                <p><span className="font-semibold text-slate-900">Form setup status:</span> In progress</p>
                <p><span className="font-semibold text-slate-900">Domain/DNS status:</span> {selectedSite.domain ? "Configured" : "Not configured"}</p>
                <p><span className="font-semibold text-slate-900">Export readiness:</span> {healthScore >= 75 ? "Good" : "Needs review"}</p>
                <p><span className="font-semibold text-slate-900">Health score:</span> {healthScore}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Select a website to inspect health details.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
