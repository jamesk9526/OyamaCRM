/** Steward Path run and timeline history view. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface TimelineItem {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
  enrollmentId: string;
}

interface HistoryResponse {
  pathId: string;
  pathName: string;
  items: TimelineItem[];
}

interface HistoryPageProps {
  params: Promise<{ id: string }>;
}

/** Displays event history for one path from steward-paths timeline endpoint. */
export default function StewardPathHistoryPage({ params }: HistoryPageProps) {
  const [pathId, setPathId] = useState<string>("");
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function run(): Promise<void> {
      try {
        const resolved = await params;
        if (!active) return;
        setPathId(resolved.id);
        const history = await apiFetch<HistoryResponse>(`/api/steward-paths/templates/${resolved.id}/history`);
        if (!active) return;
        setData(history);
      } catch (historyError) {
        if (!active) return;
        setError(historyError instanceof Error ? historyError.message : "Failed to load history.");
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [params]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Steward Path History</h1>
        <Link href={pathId ? `/steward-paths/builder/${encodeURIComponent(pathId)}` : "/steward-paths"} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Edit workflow
        </Link>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {!data ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading history...</div>
      ) : data.items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">No run/timeline events found yet.</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">{data.pathName}</div>
          <ul className="divide-y divide-gray-100">
            {data.items.map((item) => (
              <li key={item.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{item.eventType}</span>
                  <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-gray-700">{item.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
