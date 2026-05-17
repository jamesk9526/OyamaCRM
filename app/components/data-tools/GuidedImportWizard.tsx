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

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Guided Import Wizard</h2>
          <p className="mt-1 text-sm text-gray-500">One import path for contacts, donations, and Compassion clients.</p>
        </div>
        <Link href={targetHref} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
          Continue to Mapping
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">1. What are you importing?</p>
          <div className="mt-2 grid gap-2">
          <button
            type="button"
            onClick={() => setKind("contacts")}
            className={`rounded-lg border p-3 text-left ${kind === "contacts" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Donor or outreach contacts</span>
            <span className="mt-1 block text-xs text-gray-500">Donors, prospects, churches, businesses, organizations, and newsletter contacts.</span>
          </button>
          <button
            type="button"
            onClick={() => setKind("donations")}
            className={`rounded-lg border p-3 text-left ${kind === "donations" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Donation history</span>
            <span className="mt-1 block text-xs text-gray-500">Gifts, payment dates, campaigns, designations, and donor matching.</span>
          </button>
          <button
            type="button"
            onClick={() => { setKind("eventGuests"); setPreset("eventGuests"); }}
            className={`rounded-lg border p-3 text-left ${kind === "eventGuests" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-amber-300"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Event guest roster</span>
            <span className="mt-1 block text-xs text-gray-500">Guests, RSVP, payment status, seating, meals, party names, and check-in codes.</span>
          </button>
          <button
            type="button"
            onClick={() => setKind("clients")}
            className={`rounded-lg border p-3 text-left ${kind === "clients" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
          >
            <span className="block text-sm font-semibold text-gray-900">Compassion client records</span>
            <span className="mt-1 block text-xs text-gray-500">Private client-service files must go to Compassion CRM, not donor contacts.</span>
          </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">2. Choose source preset</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreset(option.id)}
                className={`rounded-lg border p-3 text-left ${preset === option.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"}`}
              >
                <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                <span className="mt-1 block text-xs text-gray-500">{option.description}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
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
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-900">3. Review mapping and safeguards next.</span>
            <span className="mt-1 block">The next step handles CSV parsing, duplicate checks, dry run, unsubscribe fields, and final import confirmation.</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Client files should be imported in the Compassion workspace. Donor contacts and audience files belong here; client-service files do not unless the person is intentionally linked or tagged as a donor after Compassion import.
      </div>
    </section>
  );
}
