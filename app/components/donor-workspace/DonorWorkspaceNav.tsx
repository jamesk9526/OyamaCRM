"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, Gift, Users } from "lucide-react";

const destinations = [
  { href: "/", name: "Overview", detail: "See what needs attention", icon: ChartNoAxesCombined },
  { href: "/constituents", name: "Constituents", detail: "Build supporter relationships", icon: Users },
  { href: "/donations", name: "Donations", detail: "Record and acknowledge giving", icon: Gift },
];

export default function DonorWorkspaceNav() {
  const pathname = usePathname();
  return <nav className="donor-workspace-nav" aria-label="Donor workspace">{destinations.map(({ href, name, detail, icon: Icon }) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={18} aria-hidden="true" /><span><strong>{name}</strong><small>{detail}</small></span></Link>;
  })}</nav>;
}
