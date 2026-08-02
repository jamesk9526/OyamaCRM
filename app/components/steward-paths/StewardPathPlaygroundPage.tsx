"use client";

import StewardPathsPlaygroundModal from "./StewardPathsPlaygroundModal";

interface StewardPathPlaygroundPageProps {
  pathId: string;
  initialConstituentId?: string;
  initialDonorName?: string;
}

/** Full-page Playground shell for one path id. */
export default function StewardPathPlaygroundPage({ pathId, initialConstituentId, initialDonorName }: StewardPathPlaygroundPageProps) {
  return (
    <StewardPathsPlaygroundModal
      fullPage
      templateId={pathId}
      initialConstituentId={initialConstituentId}
      initialDonorName={initialDonorName}
    />
  );
}
