/** Horizontal sub-navigation used across Letters & Printables workspace pages. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/letters-printables", label: "Dashboard" },
  { href: "/letters-printables/templates", label: "Templates" },
  { href: "/letters-printables/generate", label: "Generate" },
  { href: "/letters-printables/generated", label: "Generated" },
  { href: "/letters-printables/signatures", label: "Signatures" },
  { href: "/letters-printables/branding", label: "Branding" },
] as const;

/** Renders active-aware workspace links for major letters features. */
export default function LettersWorkspaceNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
      {LINKS.map((link) => {
        const active = link.href === "/letters-printables"
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              active
                ? "border-green-600 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
