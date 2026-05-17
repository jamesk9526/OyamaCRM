/** Full-page saved audience list manager for Contacts Manager. */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import AudienceListManager from "@/app/components/contacts-manager/AudienceListManager";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  employer?: string | null;
}

interface SavedAudienceList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
  updatedAt: string;
}

interface SavedAudienceDetail {
  id: string;
  name: string;
  description?: string | null;
  recipients: Array<{ id: string; email: string }>;
}

/** Renders the saved list manager as a focused full-page workspace. */
export default function ContactsManagerListsPage() {
  const [constituents, setConstituents] = useState<ConstituentRow[]>([]);
  const [lists, setLists] = useState<SavedAudienceList[]>([]);
  const [listRecipientsById, setListRecipientsById] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [contactRows, listRows] = await Promise.all([
      apiFetch<ConstituentRow[]>("/api/constituents?limit=all"),
      apiFetch<SavedAudienceList[]>("/api/email-campaigns/lists"),
    ]);
    const listDetails = await Promise.all(listRows.map(async (list) => {
      const detail = await apiFetch<SavedAudienceDetail>(`/api/email-campaigns/lists/${list.id}`);
      return [list.id, detail.recipients.map((row) => row.email.trim().toLowerCase()).filter(Boolean)] as const;
    }));
    setConstituents(contactRows);
    setLists(listRows);
    setListRecipientsById(Object.fromEntries(listDetails));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-w-0 space-y-4">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Contacts Manager", href: "/contacts-manager" },
          { label: "List Manager" },
        ]}
        metadata={`${lists.length} saved lists`}
        primaryAction={<Link href="/contacts-manager" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Back to Contacts</Link>}
      />
      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      <AudienceListManager
        lists={lists}
        listRecipientsById={listRecipientsById}
        constituents={constituents}
        onReload={load}
        onMessage={setMessage}
        onError={setError}
      />
    </div>
  );
}
