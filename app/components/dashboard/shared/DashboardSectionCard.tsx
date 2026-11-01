import Link from "next/link";
import type { ReactNode } from "react";

/** Common operational panel, with one heading and a named destination. */
export default function DashboardSectionCard({title, icon, href, children}: {
  title: string; icon: ReactNode; href: string; children: ReactNode;
}) {
  return <article className="donor-reference-widget">
    <header><h2>{icon}{title}</h2><Link href={href} aria-label={`View all ${title.toLowerCase()}`}>View all</Link></header>
    {children}
  </article>;
}
