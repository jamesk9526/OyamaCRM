"use client";

import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";

interface MicrosoftProductBarProps {
  productName: string;
  homeHref: string;
  backHref: string;
  backLabel: string;
  helpHref: string;
}

/** Compact Microsoft 365-inspired product chrome shared by standalone workspaces. */
export default function MicrosoftProductBar({
  productName,
  homeHref,
  backHref,
  backLabel,
  helpHref,
}: MicrosoftProductBarProps) {
  const { user } = useAuth();
  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"
    : "U";

  return (
    <header className="flex h-[52px] shrink-0 items-center border-t-4 border-[#0f6cbd] bg-[#3b3a39] text-white">
      <Link
        href="/"
        aria-label="Open OyamaCRM"
        className="grid h-12 w-[52px] shrink-0 place-items-center hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
      >
        <span className="grid grid-cols-3 gap-[3px]" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className="h-[3px] w-[3px] rounded-full bg-current" />
          ))}
        </span>
      </Link>

      <Link href={homeHref} className="truncate px-2 text-[16px] font-semibold tracking-[0.01em]">
        {productName}
      </Link>

      <div className="ml-auto flex h-12 items-center pr-2">
        <Link
          href={backHref}
          className="hidden h-10 items-center px-3 text-xs font-medium text-white/90 hover:bg-white/10 hover:text-white sm:inline-flex"
        >
          {backLabel}
        </Link>
        <Link
          href={helpHref}
          aria-label={`${productName} help`}
          className="grid h-10 w-10 place-items-center text-xl hover:bg-white/10"
        >
          ?
        </Link>
        <div
          className="ml-1 grid h-8 w-8 place-items-center rounded-full border border-white/90 text-[11px] font-semibold"
          aria-label={user ? `${user.firstName} ${user.lastName}` : "Account"}
          title={user ? `${user.firstName} ${user.lastName}` : "Account"}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
