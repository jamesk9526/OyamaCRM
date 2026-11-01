"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { BRIDGE_PENDING_KEY } from "@/app/components/settings/ai/BridgeConnectPanel";
/** Preserve an explicit desktop handoff through normal CRM sign-in, without putting keys in server URLs. */
export default function BridgeConnectionResume() {
  const { user, loading } = useAuth(); const pathname = usePathname(); const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    const key = new URLSearchParams(url.hash.slice(1)).get("bridgePair") || url.searchParams.get("bridgePair");
    if (key && key.length <= 64000) {
      try { sessionStorage.setItem(BRIDGE_PENDING_KEY, JSON.stringify({ key, expires: Date.now() + 10 * 60000 })); } catch { /* Manual import remains available. */ }
      url.searchParams.delete("bridgePair"); url.hash = ""; history.replaceState(null, "", url.pathname + url.search);
    }
    try { if (!loading && user && pathname !== "/settings/ai" && sessionStorage.getItem(BRIDGE_PENDING_KEY)) router.replace("/settings/ai"); } catch { /* Manual import remains available when session storage is blocked. */ }
  }, [loading, user, pathname, router]);
  return null;
}
