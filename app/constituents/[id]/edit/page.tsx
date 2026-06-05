/**
 * Edit Constituent page.
 * Client component that loads constituent data via authenticated apiFetch
 * and renders ConstituentForm in edit mode.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ConstituentForm from "@/app/components/constituents/ConstituentForm";
import { getConstituentDisplayName } from "@/app/components/constituents/constituent-utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";

/** Edit Constituent page — loads constituent data and renders ConstituentForm in edit mode. */
export default function EditConstituentPage() {
  const { id } = useParams<{ id: string }>();
  const [constituent, setConstituent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Record<string, unknown>>(`/api/constituents/${id}`);
        setConstituent(data);
      } catch {
        setNotFoundFlag(true);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-gray-400 text-sm animate-pulse">
        Loading…
      </div>
    );
  }

  if (notFoundFlag || !constituent) {
    notFound();
    return null;
  }

  const displayName = getConstituentDisplayName(constituent);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/constituents" className="hover:text-green-600 transition-colors">Constituents</Link>
        <span>/</span>
        <Link href={`/constituents/${id}`} className="hover:text-green-600 transition-colors">
          {displayName}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Edit Constituent</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Update profile information for {displayName}.
        </p>
      </div>

      <ConstituentForm
        mode="edit"
        constituentId={id}
        initialData={constituent}
      />
    </div>
  );
}
