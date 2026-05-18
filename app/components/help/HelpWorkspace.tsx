// Main CRM-scoped Help App workspace with search, filters, contextual suggestions, and guide listing.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HelpScopeBadge from "@/app/components/help/HelpScopeBadge";
import { apiFetch } from "@/app/lib/auth-client";
import {
  getContextualHelpSuggestions,
  getHelpFilterMetadata,
  searchHelpArticles,
  type HelpCrmScope,
  type HelpDifficulty,
  type HelpRole,
} from "@/app/help-content";

interface HelpWorkspaceProps {
  /** Active CRM scope used for result prioritization. */
  scope: HelpCrmScope;
  /** Current route path used for contextual help suggestions. */
  scopePath: string;
  /** Optional initial search query from route params. */
  initialQuery?: string;
}

interface HelpAgentAction {
  id: string;
  label: string;
  type: "open_route" | "open_help_article" | "open_help_search";
  href: string;
}

interface HelpAgentPlan {
  summary: string;
  confidence: "high" | "medium" | "low";
  steps: string[];
  actions: HelpAgentAction[];
}

/**
 * HelpWorkspace provides the default Help App experience for list and search workflows.
 */
export default function HelpWorkspace({ scope, scopePath, initialQuery = "" }: HelpWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [difficulty, setDifficulty] = useState<HelpDifficulty | "any">("any");
  const [role, setRole] = useState<HelpRole | "any">("any");
  const [agentQuery, setAgentQuery] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentPlan, setAgentPlan] = useState<HelpAgentPlan | null>(null);
  const [lastAgentQuery, setLastAgentQuery] = useState("");

  const metadata = useMemo(() => getHelpFilterMetadata(scope), [scope]);
  const quickSearches = [
    "add constituent",
    "import csv",
    "record donation",
    "schedule appointment",
    "check in guest",
    "send email campaign",
    "steward paths",
    "grants workspace",
    "recurring gifts",
    "run report",
  ];

  const results = useMemo(() => {
    return searchHelpArticles({
      query,
      scope,
      filters: {
        category,
        tag,
        role,
        difficulty,
        status: "published",
      },
      limit: 60,
    });
  }, [category, difficulty, query, role, scope, tag]);

  const contextual = useMemo(() => getContextualHelpSuggestions({ pathname: scopePath, scope }), [scopePath, scope]);
  const queryHasValue = query.trim().length > 0;
  const approxSearchTimeMs = Math.max(12, Math.min(180, results.length * 6 + query.trim().length * 4));

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const normalizedAgentQuery = agentQuery.trim();

  async function runHelpAgentPlanner() {
    if (agentLoading) return;
    if (!normalizedAgentQuery) return;

    setAgentLoading(true);
    setAgentError(null);
    try {
      const response = await apiFetch<{ data: HelpAgentPlan }>("/api/help-agent/plan", {
        method: "POST",
        body: JSON.stringify({
          query: normalizedAgentQuery,
          scope,
          scopePath,
        }),
      });
      setLastAgentQuery(normalizedAgentQuery);
      setAgentPlan(response.data);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Failed to run Help Agent.");
    } finally {
      setAgentLoading(false);
    }
  }

  function runAgentAction(action: HelpAgentAction) {
    // Actions should always be local routes from server planner.
    if (!action.href.startsWith("/")) {
      setAgentError("Blocked unsafe action target. Please try again.");
      return;
    }
    router.push(action.href);
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Oyama Help Search</h1>
            <p className="mt-1 text-sm text-gray-600">
              Search guides, walkthroughs, and troubleshooting content in your active CRM workspace.
            </p>
          </div>
          <HelpScopeBadge scope={scope} />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="relative">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help articles, setup steps, and troubleshooting guides"
              className="w-full rounded-xl border border-gray-300 bg-white pl-4 pr-20 py-3 text-sm text-gray-800"
            />
            {queryHasValue ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickSearches.map((quickSearch) => (
              <button
                key={quickSearch}
                onClick={() => setQuery(quickSearch)}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {quickSearch}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">Tip: partial phrases and minor typos are supported in search.</p>

        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-emerald-900">Help Agent</h2>
            <p className="mt-1 text-xs text-emerald-800">
              Describe what you need done. Help Agent will plan steps and provide runnable actions.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={agentQuery}
              onChange={(event) => setAgentQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runHelpAgentPlanner();
                }
              }}
              placeholder="Example: import a donor csv and resolve duplicates"
              className="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-gray-800"
            />
            <button
              type="button"
              onClick={() => void runHelpAgentPlanner()}
              disabled={agentLoading || !normalizedAgentQuery}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {agentLoading ? "Planning..." : "Run Help Agent"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "import a donor csv and resolve duplicates",
              "open event check-in tools",
              "where do i add a new client",
              "set up steward paths engagement sequence",
              "configure microsoft 365 email",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setAgentQuery(prompt)}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
              >
                {prompt}
              </button>
            ))}
          </div>

          {agentError ? (
            <p className="text-xs text-red-700">{agentError}</p>
          ) : null}

          {agentPlan ? (
            <div className="rounded-lg border border-emerald-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{agentPlan.summary}</p>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  {agentPlan.confidence}
                </span>
              </div>

              {lastAgentQuery ? (
                <p className="text-[11px] text-gray-500">For: "{lastAgentQuery}"</p>
              ) : null}

              <div className="space-y-1">
                {agentPlan.steps.map((step, index) => (
                  <p key={`agent-step-${index}`} className="text-xs text-gray-700">
                    {index + 1}. {step}
                  </p>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {agentPlan.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => runAgentAction(action)}
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Refine Results</h2>
            <div className="mt-3 space-y-2">
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700">
                <option value="all">All categories</option>
                {metadata.categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
              <select value={tag} onChange={(event) => setTag(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700">
                <option value="all">All tags</option>
                {metadata.tags.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as HelpDifficulty | "any")} className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700">
                <option value="any">Any difficulty</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <select value={role} onChange={(event) => setRole(event.target.value as HelpRole | "any")} className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700">
                <option value="any">Any role</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="volunteer">Volunteer</option>
                <option value="all">All roles</option>
              </select>
            </div>
          </div>

          {contextual.length > 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <h2 className="text-sm font-semibold text-green-900">Need Help On This Page?</h2>
              <p className="mt-1 text-xs text-green-800 break-all">Route context: {scopePath}</p>
              <div className="mt-2 space-y-1.5">
                {contextual.map((article) => (
                  <Link
                    key={article.id}
                    href={`/help/${article.slug}?scope=${scope}`}
                    className="block rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-medium text-green-800 hover:bg-green-100"
                  >
                    {article.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 shadow-sm">
            {queryHasValue
              ? `About ${results.length} result${results.length === 1 ? "" : "s"} (${approxSearchTimeMs} ms) for \"${query.trim()}\"`
              : `Showing ${results.length} indexed guide${results.length === 1 ? "" : "s"} in this workspace.`}
          </div>

          {results.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
              No help articles matched your search. Try fewer filters or broader keywords.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <article key={result.article.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] text-green-700">/help/{result.article.slug}</p>
                  <Link
                    href={`/help/${result.article.slug}?scope=${scope}`}
                    className="mt-0.5 block text-base font-semibold text-blue-700 hover:underline"
                  >
                    {result.article.title}
                  </Link>
                  <p className="mt-1 text-sm text-gray-700">{result.article.summary}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{result.article.category}</span>
                    {result.article.estimatedReadTime ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{result.article.estimatedReadTime}</span>
                    ) : null}
                    {result.article.difficulty ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{result.article.difficulty}</span>
                    ) : null}
                    <HelpScopeBadge scope={result.article.crmScope} />
                  </div>

                  {result.matchedBy.length > 0 ? (
                    <p className="mt-2 text-[11px] text-gray-500">Matched by: {result.matchedBy.join(", ")}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
