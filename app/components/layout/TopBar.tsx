// TopBar: full-width global navigation header with module switcher, search, and user controls.
// Spans the entire width of the viewport — brand/logo lives in the Sidebar instead.
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import AppsDrawer, { AppsGridIcon } from "@/app/components/layout/AppsDrawer";
import { apiFetch } from "@/app/lib/auth-client";

interface SearchResult {
  id: string;
  type: "constituent" | "donation" | "campaign" | "client" | "case";
  label: string;
  sublabel?: string;
  href: string;
}

function GlobalSearch({ moduleKey }: { moduleKey: "donor" | "compassion" | "events" }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focus shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const allResults: SearchResult[] = [];

      if (moduleKey === "compassion") {
        const clients = await apiFetch<Array<{
          id: string;
          firstName: string;
          lastName: string;
          preferredName?: string;
          email?: string;
          clientStatus?: string;
        }>>(`/api/compassion/clients?search=${encodeURIComponent(q)}&limit=8`);
        for (const c of clients) {
          allResults.push({
            id: c.id,
            type: "client",
            label: `${c.firstName} ${c.lastName}`,
            sublabel: c.email ?? c.preferredName ?? c.clientStatus ?? "Client",
            href: "/compassion/clients",
          });
        }
      } else if (moduleKey === "donor") {
        const [constituents, campaigns] = await Promise.all([
          apiFetch<Array<{ id: string; firstName: string; lastName: string; email?: string; type?: string }>>(`/api/constituents?search=${encodeURIComponent(q)}&limit=5`),
          apiFetch<Array<{ id: string; name: string }>>(`/api/campaigns?search=${encodeURIComponent(q)}&limit=3`),
        ]);

        for (const c of constituents) {
          allResults.push({
            id: c.id,
            type: "constituent",
            label: `${c.firstName} ${c.lastName}`,
            sublabel: c.email ?? c.type,
            href: `/constituents/${c.id}`,
          });
        }

        for (const c of campaigns) {
          allResults.push({
            id: c.id,
            type: "campaign",
            label: c.name,
            sublabel: "Campaign",
            href: `/campaigns`,
          });
        }
      }

      setResults(allResults);
      setOpen(allResults.length > 0);
      setSelected(0);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [moduleKey]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected].href);
  }

  const typeLabel: Record<string, string> = {
    constituent: "Constituent",
    campaign: "Campaign",
    donation: "Donation",
    client: "Client",
    case: "Case",
  };

  function TypeIcon({ type }: { type: string }) {
    if (type === "client") return (
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
    if (type === "case") return (
      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
      </svg>
    );
    if (type === "constituent") return (
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
    if (type === "campaign") return (
      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      </svg>
    );
    return (
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  const focusRing = moduleKey === "compassion"
    ? "focus:ring-blue-400/60"
    : moduleKey === "events"
      ? "focus:ring-amber-400/60"
      : "focus:ring-green-400/60";
  const activeResultBg = moduleKey === "compassion"
    ? "bg-blue-50"
    : moduleKey === "events"
      ? "bg-amber-50"
      : "bg-green-50";
  const spinnerColor = moduleKey === "compassion"
    ? "border-blue-400"
    : moduleKey === "events"
      ? "border-amber-400"
      : "border-green-400";
  const placeholder = moduleKey === "compassion"
    ? "Search clients… (⌘K)"
    : moduleKey === "events"
      ? "Search events… (⌘K)"
      : "Search constituents, campaigns… (⌘K)";

  return (
    <div className="relative w-full max-w-lg">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={`w-full pl-9 pr-14 py-2 text-sm bg-white/10 text-white placeholder:text-gray-400 border border-white/15 rounded-lg focus:outline-none focus:ring-1 ${focusRing} focus:bg-white/15 transition-all`}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-500 bg-white/10 px-1.5 py-0.5 rounded border border-white/15 hidden sm:block">
          ⌘K
        </kbd>
        {loading && (
          <div className={`absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3 border-2 ${spinnerColor} border-t-transparent rounded-full animate-spin`} />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 overflow-hidden">
          <ul className="py-1">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  onMouseDown={() => navigate(r.href)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? activeResultBg : "hover:bg-gray-50"}`}
                >
                  <TypeIcon type={r.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                    <p className="text-xs text-gray-400 truncate">{r.sublabel}</p>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">{typeLabel[r.type]}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 bg-gray-50">
            <span className="text-xs text-gray-400">↑↓ navigate</span>
            <span className="text-xs text-gray-400">↵ open</span>
            <span className="text-xs text-gray-400">Esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Full-width top navigation bar — spans the entire viewport width. */
export default function TopBar() {
  const pathname = usePathname();
  const moduleKey = pathname.startsWith("/compassion")
    ? "compassion"
    : pathname.startsWith("/events")
      ? "events"
      : "donor";
  const [appsOpen, setAppsOpen] = useState(false);

  return (
    <>
      <AppsDrawer open={appsOpen} onClose={() => setAppsOpen(false)} />
      <header className="h-14 shrink-0 w-full flex items-center gap-4 px-4 bg-[#1a2332] border-b border-[#0f1924] z-20">

        {/* ── Module switcher (left anchor) ── */}
        <ModuleSwitcher moduleKey={moduleKey} />

        {/* ── Divider ── */}
        <div className="w-px h-5 bg-white/10 shrink-0" />

        {/* ── Search (grows to fill available space) ── */}
        <div className="flex-1">
          <GlobalSearch moduleKey={moduleKey} />
        </div>

        {/* ── Right-side icon controls ── */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Apps Drawer trigger */}
          <button
            title="Apps"
            onClick={() => setAppsOpen((v) => !v)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
              ${appsOpen ? "text-white bg-white/20" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
          >
            <AppsGridIcon className="w-4 h-4" />
          </button>

          {/* AI Assistant (future) */}
          <button
            title="AI Assistant (coming soon)"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors relative group"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            AI Assistant
          </span>
        </button>

        {/* Help */}
        <button
          title="Help & Documentation"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </button>

        {/* Notifications */}
        <button
          title="Notifications"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors relative"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-[#1a2332] ${moduleKey === "compassion" ? "bg-blue-400" : moduleKey === "events" ? "bg-amber-400" : "bg-green-500"}`} />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* Quick Add */}
        <button
          title="Quick Add"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors shrink-0 ${moduleKey === "compassion" ? "bg-blue-600 hover:bg-blue-500" : moduleKey === "events" ? "bg-amber-600 hover:bg-amber-500" : "bg-green-600 hover:bg-green-500"}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New</span>
        </button>

        {/* User avatar */}
        <UserMenu moduleKey={moduleKey} />
      </div>
    </header>
    </>
  );
}

/**
 * ModuleSwitcher: lets users switch between DonorCRM, Compassion CRM, and Events CRM.
 */
function ModuleSwitcher({ moduleKey }: { moduleKey: "donor" | "compassion" | "events" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const modules = [
    { key: "donor", label: "DonorCRM", href: "/", color: "bg-green-500", active: moduleKey === "donor" },
    { key: "compassion", label: "Compassion CRM", href: "/compassion/dashboard", color: "bg-blue-500", active: moduleKey === "compassion" },
    { key: "events", label: "Events CRM", href: "/events", color: "bg-amber-500", active: moduleKey === "events" },
  ];
  const current = modules.find((m) => m.active) ?? modules[0];

  function switchTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/15"
      >
        <span className={`w-2 h-2 rounded-full ${current.color}`} />
        <span>{current.label}</span>
        <svg className="w-3 h-3 text-gray-300 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-52 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Switch Module</p>
            {modules.map((m) => (
              <button
                key={m.key}
                onClick={() => switchTo(m.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${m.active ? "bg-gray-50 text-gray-900 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                <span>{m.label}</span>
                {m.active && (
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** UserMenu: avatar with sign-out dropdown. */
function UserMenu({ moduleKey }: { moduleKey: "donor" | "compassion" | "events" }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const avatarCls = moduleKey === "compassion"
    ? "bg-blue-700 border-blue-500"
    : moduleKey === "events"
      ? "bg-amber-700 border-amber-500"
      : "bg-green-700 border-green-500";

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={user ? `${user.firstName} ${user.lastName}` : "Account"}
        className={`w-8 h-8 rounded-full border-2 text-white flex items-center justify-center text-xs font-bold hover:opacity-90 transition-colors ${avatarCls}`}
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">{user?.role}</span>
            </div>
            <div className="py-1">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
