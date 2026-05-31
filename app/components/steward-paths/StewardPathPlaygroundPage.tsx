"use client";

import { useEffect, useState } from "react";
import StewardPathsPlaygroundModal from "./StewardPathsPlaygroundModal";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardPathPlaygroundPageProps {
  pathId: string;
}

interface TemplateSummaryResponse {
  id: string;
  name: string;
}

/** Full-page Playground shell for one path id. */
export default function StewardPathPlaygroundPage({ pathId }: StewardPathPlaygroundPageProps) {
  const [pathName, setPathName] = useState("Steward Path");

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate(): Promise<void> {
      try {
        const data = await apiFetch<TemplateSummaryResponse>(`/api/steward-paths/templates/${pathId}`);
        if (cancelled) return;
        setPathName(data.name || "Steward Path");
      } catch {
        if (cancelled) return;
        setPathName("Steward Path");
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [pathId]);

  return (
    <StewardPathsPlaygroundModal
      fullPage
      templateId={pathId}
      pathName={pathName}
    />
  );
}
