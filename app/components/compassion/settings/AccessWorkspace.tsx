"use client";
import { useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { CareCard, CareEmpty, CareError, CareHeading, careWrite, useCareData } from "../care-ui";

interface MembershipData { memberships: Array<{ userId: string; role: string; active: boolean }>; users: Array<{ id: string; firstName: string; lastName: string; email: string }>; roles: string[] }
const roleDescriptions: Record<string, string> = { ADMIN: "Manage the care workspace and records. Physician sign-off requires the physician role.", RECEPTION: "Client directory, scheduling, and secure messages.", CASEWORKER: "Client casework, intake requests, classes, scheduling, and messages.", CLINICIAN: "Clinical charting alongside casework, scheduling, and messages.", PHYSICIAN: "Clinical care and electronic physician sign-off.", READONLY: "Read client directory information without clinical chart access." };

export default function AccessWorkspace() {
  const memberships = useCareData<MembershipData>("/api/compassion/memberships");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(""); const [role, setRole] = useState("RECEPTION"); const [query, setQuery] = useState("");
  async function save(userId: string, role: string, active = true) {
    if (!window.confirm(`${active ? "Grant" : "Disable"} ${role.toLowerCase()} access for this account?`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await careWrite("/memberships", { userId, role, active }); setNotice("Care membership updated."); await memberships.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update access."); }
    finally { setBusy(false); }
  }
  const rows = memberships.data?.memberships.filter((member) => {
    const user = memberships.data?.users.find((person) => person.id === member.userId);
    return `${user?.firstName} ${user?.lastName} ${user?.email} ${member.role}`.toLowerCase().includes(query.toLowerCase());
  });
  return <><CareHeading title="Access & roles" description="Give each person the client-care access their work requires." /><CareError error={error || memberships.error} />{notice && <div className="care-notice" role="status">{notice}</div>}<div className="care-grid"><CareCard title="Care team access" description="Care memberships are separate from donor permissions"><div className="care-card-body"><label className="care-search-field"><Search size={17} /><input className="care-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a person or role" aria-label="Search care memberships" /></label></div>{memberships.loading ? <CareEmpty title="Loading care memberships…" /> : memberships.error ? <CareEmpty title="Unable to load memberships"><button className="care-button secondary" onClick={() => void memberships.reload()}>Try again</button></CareEmpty> : rows?.length ? rows.map((member) => { const user = memberships.data?.users.find((person) => person.id === member.userId); return <div className="care-row" key={member.userId}><span className="care-person-avatar">{user?.firstName?.[0] || "?"}{user?.lastName?.[0]}</span><div className="care-row-main"><strong>{user ? `${user.firstName} ${user.lastName}` : "Inactive account"}</strong><small>{member.role.toLowerCase()} · {member.active ? "Active" : "Disabled"}</small></div><button className="care-button secondary" disabled={busy} onClick={() => void save(member.userId, member.role, !member.active)}>{member.active ? "Disable" : "Enable"}</button></div>; }) : <CareEmpty title="No matching memberships" />}</CareCard><CareCard title="Assign care access" description="Review the role before granting access"><div className="care-card-body care-form"><label>Platform account<select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Select an existing account</option>{memberships.data?.users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {user.email}</option>)}</select></label><label>Care role<select value={role} onChange={(event) => setRole(event.target.value)}>{memberships.data?.roles.map((item) => <option key={item} value={item}>{item.toLowerCase()}</option>)}</select></label><div className="care-inline-help"><ShieldCheck size={19} /><p>{roleDescriptions[role]}</p></div><button className="care-button" disabled={!userId || busy || !memberships.data} onClick={() => void save(userId, role)}>{busy ? "Saving…" : "Review and grant access"}</button></div></CareCard></div></>;
}
