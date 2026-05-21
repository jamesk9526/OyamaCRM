/**
 * Legacy Record Gift route.
 * Redirects old deep links into the Donations ledger modal workflow.
 */
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewDonationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("recordGift", "1");
    router.replace(`/donations?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="py-16 text-center text-sm text-slate-500">
      Opening Record Gift...
    </div>
  );
}
