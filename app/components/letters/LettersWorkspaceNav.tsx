/** Step-based workflow navigation with contextual guidance for Letters & Printables. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const WORKFLOW_STEPS = [
  { href: "/letters-printables", label: "1. Dashboard" },
  { href: "/letters-printables/templates", label: "2. Templates" },
  { href: "/letters-printables/generate", label: "3. Generate Single" },
  { href: "/letters-printables/batches", label: "4. Generate Batch" },
  { href: "/letters-printables/print-queue", label: "5. Print Queue" },
  { href: "/letters-printables/mail-queue", label: "6. Mail Queue" },
  { href: "/letters-printables/generated", label: "7. Generated History" },
] as const;

const SUPPORT_LINKS = [
  { href: "/letters-printables/signatures", label: "Signatures" },
  { href: "/letters-printables/branding", label: "Branding" },
  { href: "/letters-printables/settings", label: "Settings" },
] as const;

const PAGE_GUIDANCE: Array<{ matcher: RegExp; title: string; steps: string[] }> = [
  {
    matcher: /^\/letters-printables\/?$/,
    title: "Start Here",
    steps: [
      "Check queue counts and pending work.",
      "Open Templates or Generate based on your task.",
      "Move items to Print Queue after review.",
    ],
  },
  {
    matcher: /^\/letters-printables\/templates/,
    title: "Template Workflow",
    steps: [
      "Set up name, category, and scope.",
      "Write printable content with merge fields.",
      "Save, preview merge, then activate.",
    ],
  },
  {
    matcher: /^\/letters-printables\/(generate|batches)/,
    title: "Generation Workflow",
    steps: [
      "Choose template and recipient context.",
      "Run preview and validate merge output.",
      "Generate and hand off to print queue.",
    ],
  },
  {
    matcher: /^\/letters-printables\/(print-queue|mail-queue)/,
    title: "Queue Workflow",
    steps: [
      "Select rows requiring action.",
      "Apply one bulk transition.",
      "Add operational note for audit clarity.",
    ],
  },
  {
    matcher: /^\/letters-printables\/generated/,
    title: "Generated Records",
    steps: [
      "Review generated output by status.",
      "Update print/mail state when completed.",
      "Use Export PDF when needed.",
    ],
  },
];

/** Renders workflow steps + right-hand guidance to reduce navigation confusion. */
export default function LettersWorkspaceNav() {
  const pathname = usePathname();

  const guidance = PAGE_GUIDANCE.find((entry) => entry.matcher.test(pathname)) ?? {
    title: "Workflow Tips",
    steps: [
      "Use the numbered flow to stay in sequence.",
      "Keep print and mail operations in this workspace.",
      "Complete one queue stage before moving to the next.",
    ],
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Letters Workflow</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {WORKFLOW_STEPS.map((link) => {
                const active = link.href === "/letters-printables"
                  ? pathname === link.href
                  : pathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workspace Setup</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUPPORT_LINKS.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
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
          </div>
        </div>

        <aside className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{guidance.title}</p>
          <ol className="mt-2 space-y-1 text-xs text-gray-600 list-decimal pl-4">
            {guidance.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-gray-500">Follow each numbered step to reduce handoff errors.</p>
        </aside>
      </div>
    </div>
  );
}
