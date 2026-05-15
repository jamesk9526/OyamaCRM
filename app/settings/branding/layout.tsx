/** Branding settings sub-layout — tab strip across Identity/Theme, Letter Presets, and Signatures. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";

const BRANDING_TABS = [
  { href: "/settings/branding", label: "Identity & Theme", exact: true },
  { href: "/settings/branding/letter-presets", label: "Letter Presets" },
  { href: "/settings/branding/signatures", label: "Signatures" },
];

/** BrandingLayout wraps all branding sub-pages with a shared header and tab navigation. */
export default function BrandingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Branding</h1>
        <p className="mt-1 text-sm text-gray-500">
          One source of truth for logos, colors, headers, footers, and signatures. All communication tools pull from here.
        </p>
      </div>

      <nav className="flex gap-0.5 border-b border-gray-200">
        {BRANDING_TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                active
                  ? "border-green-600 text-green-700 bg-green-50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
