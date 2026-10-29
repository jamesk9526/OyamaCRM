"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useCareAccess } from "../CompassionShell";
import { carePathMatches, careSettings } from "../navigation";

export default function SettingsNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const access = useCareAccess();
  const current = careSettings.find((item) => carePathMatches(pathname, item.href));
  const items = careSettings.filter((item) => access?.capabilities.includes(item.capability));
  const allowed = current ? access?.capabilities.includes(current.capability) : false;
  return <div className="care-settings-workspace"><div className="care-settings-intro"><span className="care-eyebrow">WORKSPACE SETTINGS</span><p>People, permissions, scheduling, and data — all in one place.</p></div><nav className="care-settings-nav" aria-label="Compassion settings">{items.map(({ name, href, icon: Icon }) => <Link href={href} key={href} className={carePathMatches(pathname, href) ? "active" : ""} aria-current={carePathMatches(pathname, href) ? "page" : undefined}><Icon size={16} />{name}</Link>)}</nav>{allowed ? children : <div className="care-empty"><ShieldCheck size={30} /><strong>Settings access required</strong><p>Your care role does not allow this setting. Contact your Compassion administrator.</p></div>}</div>;
}
