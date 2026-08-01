"use client";

import { useSearchParams } from "next/navigation";
import StewardPathsPlaygroundModal from "./StewardPathsPlaygroundModal";

interface StewardPathPlaygroundPageProps {
  pathId: string;
}

/** Full-page Playground shell for one path id. */
export default function StewardPathPlaygroundPage({ pathId }: StewardPathPlaygroundPageProps) {
  const searchParams = useSearchParams();

  return (
    <StewardPathsPlaygroundModal
      fullPage
      templateId={pathId}
      initialConstituentId={searchParams.get("constituentId") ?? ""}
      initialDonorName={searchParams.get("donorName") ?? ""}
    />
  );
}
