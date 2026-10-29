"use client";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { CareError, CareHeading, useCareData } from "./care-ui";
import { useCareAccess } from "./CompassionShell";
import { careSettings } from "./navigation";

export default function AdministrationWorkspace() {
  const access = useCareAccess();
  const readiness = useCareData<{ encryptedStorage: boolean; clinicalCutoverApproved: boolean }>("/api/compassion/readiness");
  return <>
    <CareHeading title="Workspace settings" description="Set up your team and the tools that support their care." eyebrow="ADMINISTRATION" />
    <div className="care-readiness"><ShieldCheck size={24} /><div><strong>Protected care workspace</strong><p>{readiness.loading ? "Checking protected storage…" : readiness.error ? "Storage status is unavailable." : readiness.data?.encryptedStorage ? "Protected storage encryption is configured." : "Protected storage requires configuration."} {readiness.data && !readiness.data.clinicalCutoverApproved && "Clinical cutover awaits center review of migration, templates, backups, and operations."}</p></div></div>
    <CareError error={readiness.error} />
    {readiness.error && <button className="care-button secondary" onClick={() => void readiness.reload()}>Check again</button>}
    <div className="care-settings-cards">{careSettings.filter((item) => item.name !== "Overview" && access?.capabilities.includes(item.capability)).map(({ name, href, description, icon: Icon }) => <Link className="care-setting-card" href={href} key={href}><span className="care-tool-icon"><Icon size={23} /></span><ArrowUpRight size={17} className="care-setting-arrow" /><h2>{name}</h2><p>{description}</p></Link>)}</div>
  </>;
}
