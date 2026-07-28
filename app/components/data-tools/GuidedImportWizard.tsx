/** Guided import launcher that routes donor and Compassion client files to the correct importer. */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ImportKind = "contacts" | "donations" | "eventGuests" | "clients";
type ImportPreset = "hubspot" | "ekyros" | "eventGuests" | "generic";

const PRESETS: Array<{ id: ImportPreset; label: string; description: string }> = [
  { id: "hubspot", label: "HubSpot contacts", description: "Maps Record ID, Email Lists, email opt-outs, owner, and activity dates." },
  { id: "ekyros", label: "eKYROS records", description: "Uses existing eKYROS donor/client export mappings." },
  { id: "eventGuests", label: "Event guests", description: "Maps guest roster, ticket, RSVP, meal, seating, and check-in fields." },
  { id: "generic", label: "Generic CSV", description: "Use field mapping for another CRM or spreadsheet export." },
];

/** Presents the safest import path before staff reach detailed field mapping. */
export default function GuidedImportWizard() {
  const [kind, setKind] = useState<ImportKind>("contacts");
  const [preset, setPreset] = useState<ImportPreset>("hubspot");
  const [createList, setCreateList] = useState(true);

  const targetHref = useMemo(() => {
    if (kind === "clients") return `/compassion/import/clients?preset=${preset}`;
    if (kind === "eventGuests") return `/data-tools/import/events-guests?preset=eventGuests`;
    if (kind === "donations") return `/data-tools/import/donation?preset=${preset}`;
    const params = new URLSearchParams({ preset });
    params.set("type", "contacts");
    if (createList) params.set("target", "list");
    return `/data-tools/import?${params.toString()}`;
  }, [createList, kind, preset]);

  const nextStep = kind === "clients"
    ? "Records stay in the protected Compassion workspace."
    : kind === "donations"
      ? "You will review donor matching, dates, campaigns, and designations."
      : kind === "eventGuests"
        ? "You will review guests, RSVP, ticket, and check-in fields."
        : createList
          ? "A reviewed contact import can also create a reusable email audience."
          : "You will review contact identity, preferences, and duplicate handling.";

  return (
    <section className="border border-[#d1d1d1] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="border-l-4 border-[#0f6cbd] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f548c]">Data intake</p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900">Start a guided import</h2>
          <p className="mt-1 text-sm text-slate-600">Route every file to the correct CRM, inspect the data, and confirm before anything changes.</p>
        </div>
        <Link href={targetHref} className="m-3 bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f548c]">
          Continue to Mapping
        </Link>
      </div>

      <div className="grid gap-0 border-t border-[#d1d1d1] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="p-4 lg:border-r lg:border-[#d1d1d1]">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">1. What are you importing?</p>
          <div className="mt-2 grid gap-2">
          <button
            type="button"
            onClick={() => setKind("contacts")}
            className={`border p-3 text-left transition-colors ${kind === "contacts" ? "border-[#0f6cbd] bg-[#eff6fc] shadow-[inset_3px_0_0_#0f6cbd]" : "border-[#d1d1d1] hover:border-[#0f6cbd]"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Donor or outreach contacts</span>
            <span className="mt-1 block text-xs text-gray-500">Donors, prospects, churches, businesses, organizations, and newsletter contacts.</span>
          </button>
          <button
            type="button"
            onClick={() => setKind("donations")}
            className={`border p-3 text-left transition-colors ${kind === "donations" ? "border-[#0f6cbd] bg-[#eff6fc] shadow-[inset_3px_0_0_#0f6cbd]" : "border-[#d1d1d1] hover:border-[#0f6cbd]"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Donation history</span>
            <span className="mt-1 block text-xs text-gray-500">Gifts, payment dates, campaigns, designations, and donor matching.</span>
          </button>
          <button
            type="button"
            onClick={() => { setKind("eventGuests"); setPreset("eventGuests"); }}
            className={`border p-3 text-left transition-colors ${kind === "eventGuests" ? "border-[#0f6cbd] bg-[#eff6fc] shadow-[inset_3px_0_0_#0f6cbd]" : "border-[#d1d1d1] hover:border-[#0f6cbd]"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Event guest roster</span>
            <span className="mt-1 block text-xs text-gray-500">Guests, RSVP, payment status, seating, meals, party names, and check-in codes.</span>
          </button>
          <button
            type="button"
            onClick={() => setKind("clients")}
            className={`border p-3 text-left transition-colors ${kind === "clients" ? "border-[#0f6cbd] bg-[#eff6fc] shadow-[inset_3px_0_0_#0f6cbd]" : "border-[#d1d1d1] hover:border-[#0f6cbd]"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Compassion client records</span>
            <span className="mt-1 block text-xs text-gray-500">Private client-service files must go to Compassion CRM, not donor contacts.</span>
          </button>
          </div>
        </div>

        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">2. Choose source preset</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreset(option.id)}
                className={`border p-3 text-left transition-colors ${preset === option.id ? "border-[#0f6cbd] bg-[#eff6fc]" : "border-[#d1d1d1] hover:border-[#0f6cbd]"}`}
              >
                <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                <span className="mt-1 block text-xs text-gray-500">{option.description}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-start gap-2 border border-[#d1d1d1] bg-[#f3f2f1] p-3 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={createList}
              disabled={kind !== "contacts"}
              onChange={(event) => setCreateList(event.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-green-600"
            />
            <span>
              Create Contacts Manager audience lists from imported email rows and auto-segment Newsletter, Churches, Businesses, and Organizations.
            </span>
          </label>
          <div className="mt-3 border-l-4 border-[#0f6cbd] bg-[#eff6fc] p-3 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">3. Review mapping and safeguards next.</span>
            <span className="mt-1 block">{nextStep} The workspace then handles parsing, duplicate checks, dry run, unsubscribe fields, and a final confirmation.</span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#d1d1d1] bg-[#fff4ce] px-4 py-3 text-xs text-[#5c3b00]">
        Client files should be imported in the Compassion workspace. Donor contacts and audience files belong here; client-service files do not unless the person is intentionally linked or tagged as a donor after Compassion import.
      </div>
    </section>
  );
}
