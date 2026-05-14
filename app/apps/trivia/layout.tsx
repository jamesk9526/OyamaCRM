// Trivia layout applies the dark standalone shell for all Oyama Trivia routes.
"use client";

import { usePathname } from "next/navigation";
import TriviaOpsShell from "@/app/components/trivia/TriviaOpsShell";

/**
 * TriviaLayout wraps all /apps/trivia routes with a dedicated non-CRM shell.
 * This shell intentionally excludes CRM top search and CRM AI controls.
 */
export default function TriviaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Projector display route must stay shell-free and audience-safe.
  if (pathname.startsWith("/apps/trivia/display/")) {
    return <>{children}</>;
  }

  return <TriviaOpsShell>{children}</TriviaOpsShell>;
}
