// Main Watchdog feedback ticketing workspace with queue, filters, metrics, and detail triage panel.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteWatchdogTicket,
  fetchWatchdogTicketById,
  fetchWatchdogTicketDevelopers,
  fetchWatchdogTicketList,
  fetchWatchdogTicketSummary,
  reopenWatchdogTicket,
  resolveWatchdogTicket,
  updateWatchdogTicket,
} from "@/app/features/watchdog/tickets/api";
import { WatchdogTicketDetail } from "@/app/features/watchdog/tickets/WatchdogTicketDetail";
import { WatchdogTicketFilters } from "@/app/features/watchdog/tickets/WatchdogTicketFilters";
import { WatchdogTicketList } from "@/app/features/watchdog/tickets/WatchdogTicketList";
import {
  DEFAULT_TICKET_FILTERS,
  type WatchdogFeedbackTicket,
  type WatchdogTicketFilters as WatchdogTicketFiltersType,
  type WatchdogTicketSummary,
  type WatchdogTicketUser,
} from "@/app/features/watchdog/tickets/types";

const DEFAULT_LIMIT = 15;

/**
 * WatchdogTicketsDashboard composes summary cards, filters, queue list, and detail editing.
 * It drives all data through server APIs so triage operations remain auditable and consistent.
 */
export function WatchdogTicketsDashboard() {
  const [summary, setSummary] = useState<WatchdogTicketSummary | null>(null);
  const [developers, setDevelopers] = useState<WatchdogTicketUser[]>([]);

  const [filters, setFilters] = useState<WatchdogTicketFiltersType>(DEFAULT_TICKET_FILTERS);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<WatchdogFeedbackTicket[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_LIMIT, total: 0, totalPages: 1 });

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<WatchdogFeedbackTicket | null>(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBootData() {
      setLoadingSummary(true);
      setError(null);

      try {
        const [summaryData, developerData] = await Promise.all([
          fetchWatchdogTicketSummary(),
          fetchWatchdogTicketDevelopers(),
        ]);

        if (!active) return;
        setSummary(summaryData);
        setDevelopers(developerData);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load Watchdog ticket dashboard.");
      } finally {
        if (active) setLoadingSummary(false);
      }
    }

    void loadBootData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    setError(null);

    async function loadList() {
      try {
        const response = await fetchWatchdogTicketList({ filters, page, limit: DEFAULT_LIMIT });
        if (!active) return;

        setItems(response.items);
        setPagination(response.pagination);

        if (response.items.length === 0) {
          setSelectedTicketId(null);
          setSelectedTicket(null);
          return;
        }

        const hasSelected = response.items.some((item) => item.id === selectedTicketId);
        if (!hasSelected) {
          setSelectedTicketId(response.items[0].id);
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load ticket queue.");
      } finally {
        if (active) setLoadingList(false);
      }
    }

    void loadList();
    return () => {
      active = false;
    };
  }, [filters, page, selectedTicketId]);

  useEffect(() => {
    if (!selectedTicketId) return;

    let active = true;
    setLoadingDetail(true);
    setError(null);

    async function loadDetail() {
      try {
        const ticket = await fetchWatchdogTicketById(selectedTicketId);
        if (!active) return;
        setSelectedTicket(ticket);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load ticket details.");
      } finally {
        if (active) setLoadingDetail(false);
      }
    }

    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedTicketId]);

  const summaryCards = useMemo(() => {
    return [
      { label: "Total", value: summary?.totals.total ?? 0 },
      { label: "Unresolved", value: summary?.totals.unresolved ?? 0 },
      { label: "Unassigned", value: summary?.totals.unassigned ?? 0 },
      { label: "Urgent", value: summary?.totals.urgent ?? 0 },
      { label: "High Priority", value: summary?.totals.high ?? 0 },
      { label: "Open >72h", value: summary?.totals.openOver72h ?? 0 },
    ];
  }, [summary]);

  async function refreshSummaryAndList() {
    const [summaryData, listData] = await Promise.all([
      fetchWatchdogTicketSummary(),
      fetchWatchdogTicketList({ filters, page, limit: DEFAULT_LIMIT }),
    ]);
    setSummary(summaryData);
    setItems(listData.items);
    setPagination(listData.pagination);
  }

  async function handleSave(params: {
    status: WatchdogFeedbackTicket["status"];
    priority: WatchdogFeedbackTicket["priority"];
    assignedDeveloperId: string | null;
    developerNotes: string;
    resolutionNotes: string;
  }) {
    if (!selectedTicket) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await updateWatchdogTicket({
        id: selectedTicket.id,
        status: params.status,
        priority: params.priority,
        assignedDeveloperId: params.assignedDeveloperId,
        developerNotes: params.developerNotes,
        resolutionNotes: params.resolutionNotes,
      });
      setSelectedTicket(updated);
      await refreshSummaryAndList();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save ticket changes.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(resolutionNotes: string) {
    if (!selectedTicket) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await resolveWatchdogTicket(selectedTicket.id, resolutionNotes || undefined);
      setSelectedTicket(updated);
      await refreshSummaryAndList();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Failed to resolve ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!selectedTicket) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await reopenWatchdogTicket(selectedTicket.id);
      setSelectedTicket(updated);
      await refreshSummaryAndList();
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : "Failed to reopen ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selectedTicket) return;

    const confirmed = window.confirm(`Delete ticket ${selectedTicket.ticketNumber}? This action cannot be undone.`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await deleteWatchdogTicket(selectedTicket.id);
      setSelectedTicket(null);
      setSelectedTicketId(null);
      await refreshSummaryAndList();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete ticket.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Feedback Ticketing Command Center</h1>
        <p className="text-sm text-slate-400 mt-1">Cross-CRM user feedback queue with assignment, status workflow, and resolution notes.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-600/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">{card.label}</p>
            <p className="text-xl font-semibold text-slate-100 mt-1">{loadingSummary ? "..." : card.value}</p>
          </div>
        ))}
      </div>

      <WatchdogTicketFilters
        value={filters}
        developers={developers}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        onReset={() => {
          setFilters(DEFAULT_TICKET_FILTERS);
          setPage(1);
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-4">
        <WatchdogTicketList
          items={items}
          selectedTicketId={selectedTicketId}
          loading={loadingList}
          pagination={pagination}
          onSelect={setSelectedTicketId}
          onPageChange={setPage}
        />

        {loadingDetail && !selectedTicket ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-400">Loading ticket details...</div>
        ) : (
          <WatchdogTicketDetail
            ticket={selectedTicket}
            developers={developers}
            busy={busy}
            onSave={handleSave}
            onResolve={handleResolve}
            onReopen={handleReopen}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
