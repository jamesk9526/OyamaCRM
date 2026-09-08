"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { parseCSV, type CsvParseResult } from "./import/csvParser";

interface AudienceMatchConstituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  zip?: string;
}

interface AudienceCsvListToolProps {
  constituents: AudienceMatchConstituent[];
}

const normalize = (value: string | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const normalizePhone = (value: string | undefined) => (value ?? "").replace(/\D/g, "").slice(-10);
const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function findHeader(headers: string[], candidates: string[]): string | undefined {
  const wanted = new Set(candidates.map(normalizeHeader));
  return headers.find((header) => wanted.has(normalizeHeader(header)));
}

export function matchAudienceCsvRows(parsed: CsvParseResult, constituents: AudienceMatchConstituent[]) {
  const emailHeader = findHeader(parsed.headers, ["email", "email address", "primary email", "e-mail"]);
  const phoneHeader = findHeader(parsed.headers, ["phone", "phone number", "primary phone", "mobile", "cell phone"]);
  const firstHeader = findHeader(parsed.headers, ["first name", "firstname", "given name"]);
  const lastHeader = findHeader(parsed.headers, ["last name", "lastname", "surname", "family name"]);
  const fullHeader = findHeader(parsed.headers, ["name", "full name", "constituent name", "donor name"]);
  const zipHeader = findHeader(parsed.headers, ["zip", "zipcode", "zip code", "postal code"]);

  const matchedIds = new Set<string>();
  let matchedRows = 0;
  let unmatchedRows = 0;
  for (const row of parsed.rows) {
    const email = normalize(emailHeader ? row[emailHeader] : undefined);
    const phone = normalizePhone(phoneHeader ? row[phoneHeader] : undefined);
    const first = normalize(firstHeader ? row[firstHeader] : undefined);
    const last = normalize(lastHeader ? row[lastHeader] : undefined);
    const full = normalize(fullHeader ? row[fullHeader] : `${first} ${last}`);
    const zip = normalize(zipHeader ? row[zipHeader] : undefined);

    const matches = constituents.filter((constituent) => {
      if (email && normalize(constituent.email) === email) return true;
      if (phone && normalizePhone(constituent.phone) === phone) return true;
      const constituentName = normalize(`${constituent.firstName} ${constituent.lastName}`);
      if (full && constituentName === full) {
        return !zip || !constituent.zip || normalize(constituent.zip) === zip;
      }
      return Boolean(first && last && normalize(constituent.firstName) === first && normalize(constituent.lastName) === last);
    });
    if (matches.length === 0) unmatchedRows += 1;
    else {
      matchedRows += 1;
      matches.forEach((match) => matchedIds.add(match.id));
    }
  }

  return {
    constituentIds: Array.from(matchedIds),
    matchedRows,
    unmatchedRows,
    usableColumns: [emailHeader, phoneHeader, fullHeader, firstHeader && lastHeader ? `${firstHeader} + ${lastHeader}` : undefined].filter(Boolean) as string[],
  };
}

export default function AudienceCsvListTool({ constituents }: AudienceCsvListToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [listName, setListName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; recipientsCount: number } | null>(null);
  const match = useMemo(() => parsed ? matchAudienceCsvRows(parsed, constituents) : null, [parsed, constituents]);

  async function chooseFile(file: File) {
    setError(null);
    setCreated(null);
    const result = parseCSV(await file.text());
    if (result.headers.length === 0 || result.rows.length === 0) {
      setError("This CSV has no usable header and data rows.");
      setParsed(null);
      return;
    }
    setParsed(result);
    setFileName(file.name);
    setListName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  async function createList() {
    if (!match || match.constituentIds.length === 0 || !listName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ id: string; name: string; recipientsCount: number }>("/api/email-campaigns/lists", {
        method: "POST",
        body: JSON.stringify({
          name: listName.trim(),
          description: `Matched from ${fileName} in Data Tools. ${match.matchedRows} CSV rows matched existing CRM constituents.`,
          recipientConstituentIds: match.constituentIds,
        }),
      });
      setCreated(result);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The audience list could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6" aria-labelledby="csv-audience-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 id="csv-audience-title" className="text-sm font-semibold text-gray-900">Create an audience list from a CSV</h2>
          <p className="mt-1 text-sm text-gray-500">Upload a CSV to match existing CRM contacts by email, phone, or name. The saved list contains each matched constituent once and does not create new contacts.</p>
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          Choose CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseFile(file); event.currentTarget.value = ""; }} />
      </div>

      {match && parsed && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="CSV rows" value={parsed.rows.length} />
            <Stat label="Rows matched" value={match.matchedRows} />
            <Stat label="Unique CRM contacts" value={match.constituentIds.length} />
            <Stat label="Rows unmatched" value={match.unmatchedRows} />
          </div>
          <p className="text-xs text-gray-500">Matched with: {match.usableColumns.join(", ") || "no recognized identity columns"}</p>
          <label className="block max-w-xl text-sm font-medium text-gray-800">
            Audience list name
            <input value={listName} onChange={(event) => setListName(event.target.value)} maxLength={160} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </label>
          <button type="button" onClick={() => void createList()} disabled={busy || !listName.trim() || match.constituentIds.length === 0} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? "Saving audience…" : `Save audience list (${match.constituentIds.length})`}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {created && <p role="status" className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Saved <strong>{created.name}</strong> with {created.recipientsCount} contacts. <Link href="/contacts-manager/lists" className="font-semibold underline">Open audience lists</Link></p>}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-gray-50 px-3 py-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 text-xl font-semibold text-gray-900">{value}</p></div>;
}
