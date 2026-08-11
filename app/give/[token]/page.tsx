import type { Metadata } from "next";
import HostedGivingPage from "@/app/components/giving/HostedGivingPage";

interface HostedGivingRouteProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Make a secure gift",
  description: "Complete a secure online donation.",
  robots: { index: false, follow: false },
};

/** Public, shell-free OyamaCRM giving route shared directly with donors. */
export default async function HostedGivingRoute({ params }: HostedGivingRouteProps) {
  const { token } = await params;
  return <HostedGivingPage token={token} />;
}
