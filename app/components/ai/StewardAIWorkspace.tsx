"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { openStewardWithPrompt, type StewardOpenPromptDetail } from "@/app/lib/steward-context";

/** Compatibility entry for saved links. All conversation UI lives in the chathead. */
export default function StewardAIWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const scope = params.get("scope");
    router.replace(scope?.startsWith("/") && !scope.startsWith("//") && !scope.includes("\\") && !scope.startsWith("/steward-ai-workspace") ? scope : "/");
    // Route replacement keeps the shared shell/chathead mounted.
    const requestedModule = params.get("module") || "donor";
    const mode = params.get("mode") || "ask";
    openStewardWithPrompt({ prompt: params.get("prompt")?.slice(0, 3500) || undefined,
      scopePath: scope || "/",
      moduleKey: ["donor", "events", "watchdog", "webmaster", "all"].includes(requestedModule) ? requestedModule as StewardOpenPromptDetail["moduleKey"] : "donor",
      mode: ["ask", "help", "analyze", "draft", "action"].includes(mode) ? mode as StewardOpenPromptDetail["mode"] : "ask",
    });
  }, [params, router]);
  return null;
}
