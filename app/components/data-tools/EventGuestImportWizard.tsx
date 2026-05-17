/** Event guest CSV importer for Events CRM roster, seating, RSVP, and check-in exports. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { computeColumnStats, parseCSV, type CsvParseResult } from "@/app/data-tools/import/csvParser";

interface EventOption {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
  errorMessages?: string[];
}

type DuplicateResolution = "skip" | "update";

const GUEST_FIELD_ALIASES: Record<string, string> = {
  id: "sourceId",
  name: "displayName",
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  phone: "phone",
  ticket_type: "ticketType",
  seat_type: "seatType",
  payment_status: "paymentStatus",
  checkin_code: "checkinCode",
  seat_number: "seatNumber",
  notes: "notes",
  dietary_restrictions: "dietaryRestrictions",
  warnings: "warnings",
  rsvp_status: "rsvpStatus",
  meal_preference: "mealPreference",
  special_requests: "specialRequests",
  check_in_status: "checkInStatus",
  arrival_time: "arrivalTime",
  checked_in_at: "checkedInAt",
  party_name: "partyName",
  created_at: "sourceCreatedAt",
};

/** Imports event guest CSV rows into a selected Events CRM event. */
export default function EventGuestImportWizard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [duplicateResolution, setDuplicateResolution] = useState<DuplicateResolution>("skip");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<EventOption[]>("/api/events")
      .then((rows) => {
        const activeEvents = rows.filter((event) => event.active !== false);
        setEvents(activeEvents);
        setEventId(activeEvents[0]?.id ?? "");
      })
      .catch(() => setEvents([]));
  }, []);

  const stats = useMemo(() => parsed ? computeColumnStats(parsed.headers, parsed.rows) : {}, [parsed]);
  const mappedRecords = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const header of parsed.headers) {
        const target = GUEST_FIELD_ALIASES[header.trim().toLowerCase()];
        if (target) mapped[target] = cleanCsvValue(row[header]);
      }
      if (!mapped.firstName && !mapped.lastName && mapped.displayName) {
        const parts = mapped.displayName.split(/\s+/).filter(Boolean);
        mapped.firstName = parts.shift() ?? "";
        mapped.lastName = parts.join(" ");
      }
      return mapped;
    });
  }, [parsed]);
  const usableRows = mappedRecords.filter((row) => row.firstName || row.lastName || row.email).length;
  const checkedInRows = mappedRecords.filter((row) => row.checkInStatus?.toLowerCase() === "checked-in").length;

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result ?? "");
      setParsed(parseCSV(text));
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!eventId || mappedRecords.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const response = await apiFetch<ImportResult>(`/api/events/${eventId}/guests/import`, {
        method: "POST",
        body: JSON.stringify({ records: mappedRecords, dryRun, duplicateResolution }),
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to import event guests.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Import Event Guests</h2>
          <p className="mt-1 text-sm text-gray-500">Supports guest roster CSVs with RSVP, payment, check-in, table, seat, meal, and party fields.</p>
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Choose CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); }} />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
        <label className="block text-xs font-semibold text-gray-600">
          Event
          <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Duplicates
          <select value={duplicateResolution} onChange={(event) => setDuplicateResolution(event.target.value as DuplicateResolution)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="skip">Skip duplicates</option>
            <option value="update">Update matching guests</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} className="rounded border-blue-300" />
          Dry run
        </label>
      </div>

      {parsed && (
        <div className="grid gap-3 md:grid-cols-4">
          <ImportStat label="File" value={fileName || "CSV"} />
          <ImportStat label="Rows" value={parsed.rows.length.toLocaleString()} />
          <ImportStat label="Usable Guests" value={usableRows.toLocaleString()} />
          <ImportStat label="Checked In" value={checkedInRows.toLocaleString()} />
        </div>
      )}

      {parsed && parsed.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">CSV warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {parsed.warnings.slice(0, 6).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      {parsed && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Detected Guest Columns</div>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-auto p-3">
            {parsed.headers.map((header) => (
              <span key={header} className={`rounded-full px-2 py-1 text-xs font-semibold ${GUEST_FIELD_ALIASES[header.toLowerCase()] ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                {header}{stats[header] ? ` · ${stats[header].fillRate}%` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {result.dryRun ? "Dry run complete" : "Import complete"}: {result.created} created, {result.updated} updated, {result.skipped} skipped, {result.errors} errors.
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => void runImport()} disabled={!eventId || !parsed || importing} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
          {importing ? "Importing..." : dryRun ? "Run Dry Run" : "Import Guests"}
        </button>
      </div>
    </div>
  );
}

function ImportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function cleanCsvValue(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.toUpperCase() === "NULL" ? "" : trimmed;
}
