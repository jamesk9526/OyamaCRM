"use client";
import { useState } from "react";
export type ProfileIdentity = { id: string; firstName: string; lastName: string; preferredName?: string | null; jobTitle?: string | null; avatarUrl?: string | null };
export function profileName(person: ProfileIdentity) { return `${person.preferredName || person.firstName} ${person.lastName}`.trim(); }
export default function ProfileAvatar({ person, large = false }: { person: ProfileIdentity; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = person.avatarUrl && /^https:\/\//i.test(person.avatarUrl) && failedUrl !== person.avatarUrl ? person.avatarUrl : null;
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-teal-100 font-semibold text-teal-900 ring-1 ring-teal-800/10 ${large ? "h-20 w-20 text-2xl" : "h-11 w-11 text-sm"}`} aria-hidden="true">
    {/* User-owned HTTPS images; no optimizer fetch or referrer sharing. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} className="h-full w-full object-cover" /> : `${(person.preferredName || person.firstName).charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()}
  </span>;
}
