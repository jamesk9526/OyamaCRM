import Link from "next/link";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";

const launchers = [
  {
    title: "Email campaign",
    description: "Use a reusable email template, select an audience, review delivery safeguards, and send or schedule from one campaign record.",
    primaryLabel: "Start email campaign",
    primaryHref: "/oyama-email/campaigns/new",
    secondaryLabel: "Email templates",
    secondaryHref: "/oyama-email/templates",
    accent: "bg-[#0f6cbd]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 6.75h17A1.75 1.75 0 0 1 22.25 8.5v7A1.75 1.75 0 0 1 20.5 17.25h-17A1.75 1.75 0 0 1 1.75 15.5v-7A1.75 1.75 0 0 1 3.5 6.75Zm.25 1.25 8.25 6 8.25-6" />,
  },
  {
    title: "Letters & print",
    description: "Create a reusable letter, generate a batch for selected donors, and keep printable delivery in the mail queue.",
    primaryLabel: "Generate letters",
    primaryHref: "/oyama-letters/generate",
    secondaryLabel: "Letter templates",
    secondaryHref: "/oyama-letters",
    accent: "bg-[#424242]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7.25L19 8.5v11.75A1.75 1.75 0 0 1 17.25 22h-10.5A1.75 1.75 0 0 1 5 20.25v-14.5A1.75 1.75 0 0 1 6.75 4Zm7 0V9h5M8 13h8M8 16.5h8" />,
  },
] as const;

/** Shared donor-communications entry point for email and print workflows. */
export default function CommunicationsHub() {
  return (
    <EnterprisePageShell>
      <div className="mx-auto w-full max-w-[1320px] space-y-4 py-4">
        <section className="border border-[#d1d1d1] bg-white">
          <div className="border-b border-[#d1d1d1] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center bg-[#eff6fc] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f548c]">Donor CRM / Communications</span>
              <span className="inline-flex items-center border border-[#d1d1d1] bg-[#f3f2f1] px-2.5 py-1 text-[11px] font-medium text-[#616161]">Shared outreach workspace</span>
            </div>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-[30px] font-semibold tracking-tight text-[#242424]">Communications</h1>
                <p className="mt-1 text-sm text-[#616161]">Start with the donor audience, then choose the delivery channel. Email and letters share templates, companions, and an auditable handoff without mixing their delivery controls.</p>
              </div>
              <Link href="/constituents" className="inline-flex h-9 shrink-0 items-center justify-center border border-[#0f6cbd] bg-[#0f6cbd] px-3.5 text-xs font-semibold text-white hover:bg-[#115ea3]">
                Select donors first
              </Link>
            </div>
          </div>

          <div className="grid gap-px bg-[#d1d1d1] lg:grid-cols-2">
            {launchers.map((launcher) => (
              <article key={launcher.title} className="relative bg-white p-5 sm:p-6">
                <span className={`absolute inset-x-0 top-0 h-[3px] ${launcher.accent}`} aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center text-white ${launcher.accent}`}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">{launcher.icon}</svg>
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-[#242424]">{launcher.title}</h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-[#616161]">{launcher.description}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={launcher.primaryHref} className="inline-flex h-9 items-center justify-center border border-[#0f6cbd] bg-[#0f6cbd] px-3.5 text-xs font-semibold text-white hover:bg-[#115ea3]">
                    {launcher.primaryLabel}
                  </Link>
                  <Link href={launcher.secondaryHref} className="inline-flex h-9 items-center justify-center border border-[#c8c6c4] bg-white px-3.5 text-xs font-semibold text-[#424242] hover:bg-[#f3f2f1]">
                    {launcher.secondaryLabel}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="border border-[#d1d1d1] bg-white">
            <div className="border-b border-[#d1d1d1] bg-[#f3f2f1] px-5 py-3">
              <h2 className="text-sm font-semibold text-[#242424]">One audience, two channels</h2>
            </div>
            <ol className="grid divide-y divide-[#e5e5e5] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <li className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f548c]">1. Select</span>
                <p className="mt-1 text-sm font-semibold text-[#242424]">Build a donor scope</p>
                <p className="mt-1 text-xs leading-5 text-[#616161]">Select live constituent records or use a saved audience list.</p>
              </li>
              <li className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f548c]">2. Create</span>
                <p className="mt-1 text-sm font-semibold text-[#242424]">Choose the right format</p>
                <p className="mt-1 text-xs leading-5 text-[#616161]">Use a template for email, print, or a paired email-and-letter touchpoint.</p>
              </li>
              <li className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f548c]">3. Deliver</span>
                <p className="mt-1 text-sm font-semibold text-[#242424]">Review the handoff</p>
                <p className="mt-1 text-xs leading-5 text-[#616161]">Email remains reviewable before sending; printed work remains in the mail queue.</p>
              </li>
            </ol>
          </article>

          <article className="border border-[#d1d1d1] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#242424]">Paired template tools</h2>
            <p className="mt-1 text-sm leading-6 text-[#616161]">A template can move into the other channel without losing the original source. Use a companion when the same message needs both inbox and mailbox delivery.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/oyama-email/templates" className="text-xs font-semibold text-[#0f6cbd] hover:underline">Open email templates</Link>
              <span className="text-[#a19f9d]" aria-hidden="true">•</span>
              <Link href="/oyama-letters" className="text-xs font-semibold text-[#0f6cbd] hover:underline">Open letter templates</Link>
            </div>
          </article>
        </section>
      </div>
    </EnterprisePageShell>
  );
}
