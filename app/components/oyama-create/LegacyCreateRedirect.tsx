"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
export default function LegacyCreateRedirect() {
  const { user } = useAuth(); const path = usePathname(), query = useSearchParams(), router = useRouter();
  useEffect(() => {
    if (!user || query.get("legacy") === "1" || path === "/communications") return;
    const eligible = /^\/(oyama-email|oyama-letters|communications|campaigns)(\/|$)/.test(path);
    if (!eligible) return;
    let active = true;
    void (async () => {
      const bootstrap = await apiFetch<{ enabled: boolean }>("/api/oyama-create/bootstrap"); if (!bootstrap.enabled || !active) return;
      let target = "/oyama-create";
      if (/^\/communications\/(?!new(?:\/|$)|library(?:\/|$)|log(?:\/|$)|letters-printables(?:\/|$))[^/]+/.test(path)) target = `/oyama-create/tools/email/campaigns/${path.split("/")[2]}`;
      const source = path.startsWith("/oyama-email") ? "EMAIL" : path.startsWith("/oyama-letters") ? "LETTER" : "";
      const match = /^\/oyama-(?:email|letters)\/templates\/([^/]+)/.exec(path);
      if (source && match) {
        const binding = await apiFetch<{ campaignId: string | null; contentId?: string }>(`/api/oyama-create/legacy/${source}/${encodeURIComponent(match[1])}`);
        target = binding.campaignId ? `/oyama-create/campaigns/${binding.campaignId}?content=${binding.contentId}` : `/oyama-create/library/legacy?legacyId=${encodeURIComponent(match[1])}&legacyChannel=${source}`;
      } else if (path.startsWith("/campaigns")) target = path.split("/")[2] ? `/oyama-create/fundraising/${path.split("/")[2]}` : "/oyama-create/fundraising";
      else if (source === "LETTER") target = path.includes("/labels") ? "/oyama-create/tools/letters/labels" : path.includes("/generate") ? "/oyama-create/tools/letters/generate" : /\/(history|generated|queue)/.test(path) ? "/oyama-create/tools/letters/history" : path.includes("/settings") ? "/oyama-create/tools/letters/settings" : "/oyama-create/library/legacy";
      else if (source === "EMAIL") {
        const campaign = /^\/oyama-email\/campaigns\/([^/]+)/.exec(path);
        target = campaign ? `/oyama-create/tools/email/campaigns/${campaign[1]}` : path.includes("/queue") ? "/oyama-create/tools/email/queue" : path.includes("/settings") ? "/oyama-create/tools/email/settings" : path.includes("/calendar") || path.includes("/callender") ? "/oyama-create/calendar" : path.includes("/campaigns") ? "/oyama-create/tools/email/campaigns" : path.includes("/docs") ? "/oyama-create/tools/email/docs" : "/oyama-create/library/legacy";
      }
      const url = new URL(target, window.location.origin);
      // Keep legacy query context without replacing Create's content identity.
      for (const [key, value] of query) if (!url.searchParams.has(key) && key !== "legacy") url.searchParams.append(key, value);
      if (path.startsWith("/campaigns/") && !url.searchParams.has("legacyCampaignId")) url.searchParams.set("legacyCampaignId", path.split("/")[2]);
      if (active) router.replace(url.pathname + url.search);
    })().catch(() => { /* Preserve the working legacy screen when rollout data is unavailable. */ });
    return () => { active = false; };
  }, [user, path, query, router]);
  return null;
}
