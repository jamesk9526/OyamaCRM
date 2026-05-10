"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FeatureDevelopmentDialog from "@/app/components/webmaster/FeatureDevelopmentDialog";
import { apiFetch } from "@/app/lib/auth-client";

interface WebmasterSite {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
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

/** Dashboard for creating, managing, publishing, and exporting websites. */
export default function WebmasterStarterDashboard() {
  const router = useRouter();
  const [sites, setSites] = useState<WebmasterSite[]>([]);
  const [pagesBySite, setPagesBySite] = useState<Record<string, WebmasterPage[]>>({});
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingSite, setCreatingSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: "", slug: "", domain: "", description: "" });
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
          domain: siteForm.domain || undefined,
          description: siteForm.description || undefined,
        }),
      });

      setSiteForm({ name: "", slug: "", domain: "", description: "" });
      await loadSites();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create website.");
    } finally {
      setCreatingSite(false);
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
      router.push(`/webmaster/builder?siteId=${selectedSiteId}&pageId=${data.item.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create page.");
    }
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
              setSiteForm((current) => ({ ...current, name, slug: toSlug(name) }));
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
                router.push(`/webmaster/builder?siteId=${selectedSiteId}`);
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
            <h2 className="text-sm font-semibold text-slate-900">Recent Websites</h2>
            <button type="button" onClick={() => void loadSites()} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {sites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              No websites yet. Create a website to start designing pages in the visual builder.
            </div>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => (
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
                      <p className="text-xs text-slate-500 mt-1">Updated {new Date(site.updatedAt).toLocaleString()}</p>
                    </div>

                    <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${statusTone(site.status)}`}>
                      {site.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={`/webmaster/builder?siteId=${site.id}`} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => openIncompleteFeature("Preview Workspace", "Full preview server generation is still under development.")}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => openIncompleteFeature("Publish Workflow", "Publish targets and rollback history are still being implemented.")}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      onClick={() => openIncompleteFeature("Export Workflow", "Static ZIP and project JSON export are still being implemented.")}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Export
                    </button>
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
