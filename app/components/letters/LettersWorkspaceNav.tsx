/** Compact navigation for Letters & Printables workspace routes. */
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const WORKFLOW_STEPS = [
  { href: "/letters-printables", label: "1. Dashboard" },
  { href: "/letters-printables/templates", label: "2. Templates" },
  { href: "/letters-printables/queues?view=production", label: "3. Production Queue" },
  { href: "/letters-printables/generate", label: "4. Generate" },
  { href: "/letters-printables/queues?view=print", label: "5. Print Queue" },
  { href: "/letters-printables/queues?view=mail", label: "6. Mail Queue" },
] as const;

const SUPPORT_LINKS = [
  { href: "/settings/branding/letter-presets", label: "Letter Presets" },
  { href: "/settings/branding/signatures", label: "Signatures" },
  { href: "/letters-printables/settings", label: "Settings" },
] as const;

/** Renders letters workspace route links without passive quick-start guidance. */
export default function LettersWorkspaceNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeQueueView = searchParams.get("view") ?? "production";

  return (
    <div className="rounded-md border border-emerald-200 bg-white p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Letters Tools</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WORKFLOW_STEPS.map((link) => {
              const queueViewMatch = link.href.match(/\/letters-printables\/queues\?view=([a-z]+)/);
              const active = queueViewMatch
                ? pathname === "/letters-printables/queues" && activeQueueView === queueViewMatch[1]
                : (link.href === "/letters-printables"
                  ? pathname === link.href
                  : pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-sm border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </section>

        <aside>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Setup</p>
          <div className="mt-2 flex flex-wrap gap-2 lg:flex-col">
            {SUPPORT_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-sm border px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
