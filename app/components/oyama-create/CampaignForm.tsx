"use client";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useCreate } from "./CreateShell";
import { Modal, channelIcons } from "./ui";
import { objectives, channelNames, message, type Audience, type Campaign, type Channel } from "./types";
type LinkRecord = { id: string; name: string };
const localDate = (value: string | null | undefined) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
export default function CampaignForm({ campaign, template = false, close, saved }: { campaign?: Campaign; template?: boolean; close: () => void; saved: (value: Campaign) => void }) {
  const { permissions } = useCreate();
  const [name, setName] = useState(campaign?.name || ""), [objective, setObjective] = useState(campaign?.objective || "FUNDRAISING"), [description, setDescription] = useState(campaign?.description || "");
  const [channels, setChannels] = useState<Channel[]>(campaign?.channelsJson || ["EMAIL", "LETTER"]);
  const [audiences, setAudiences] = useState<Audience[]>([]), [selected, setSelected] = useState(campaign?.audienceListIds || []);
  const [mode, setMode] = useState(campaign?.deliveryMode || ""), [fundraisingId, setFundraisingId] = useState(campaign?.fundraisingCampaignId || ""), [eventId, setEventId] = useState(campaign?.eventId || "");
  const [funds, setFunds] = useState<LinkRecord[]>([]), [events, setEvents] = useState<LinkRecord[]>([]);
  const [startsAt, setStartsAt] = useState(localDate(campaign?.startsAt)), [endsAt, setEndsAt] = useState(localDate(campaign?.endsAt));
  const [error, setError] = useState(""), [loadError, setLoadError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const requests = [apiFetch<Audience[]>("/api/oyama-create/audiences").then(value => { if (active) setAudiences(value); })];
    if (permissions.includes("view:campaigns")) requests.push(apiFetch<LinkRecord[]>("/api/campaigns?scope=ALL_YEARS&limit=500").then(value => { if (active) setFunds(value); }));
    if (permissions.includes("view:events")) requests.push(apiFetch<LinkRecord[] | { items: LinkRecord[] }>("/api/events?limit=100").then(value => { if (active) setEvents(Array.isArray(value) ? value : value.items || []); }));
    void Promise.allSettled(requests).then(results => { if (active && results.some(result => result.status === "rejected")) setLoadError("Some audience or linked-record options could not load. Existing selections are retained."); });
    return () => { active = false; };
  }, [permissions]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const value = await apiFetch<Campaign>(`/api/oyama-create/campaigns${campaign ? `/${campaign.id}` : ""}`, { method: campaign ? "PATCH" : "POST", body: JSON.stringify({ name, objective, description, channels, audienceListIds: selected, deliveryMode: mode || null, fundraisingCampaignId: fundraisingId || null, eventId: eventId || null, startsAt: startsAt ? new Date(startsAt).toISOString() : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null, revision: campaign?.revision, isTemplate: template }) });
      saved(value);
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <Modal title={campaign ? "Campaign settings" : template ? "New reusable template" : "New campaign"} close={() => { if (!busy) close(); }}><p className="oc-help" style={{ marginBottom: 18 }}>Choose the purpose and formats. Each format shares your core message and keeps its own layout.</p><form className="oc-form" onSubmit={event => void submit(event)}>
    {error && <div role="alert" className="oc-error">{error}</div>}{loadError && <div role="status" className="oc-notice">{loadError}</div>}
    <label>Name<input required autoComplete="off" maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Year-end community appeal"/></label>
    <label>Purpose<select value={objective} onChange={event => setObjective(event.target.value)}>{Object.entries(objectives).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <fieldset><legend>Campaign channels</legend><div className="oc-channel-choices">{Object.keys(channelNames).map(value => { const channel = value as Channel; const Icon = channelIcons[channel]; const allowed = permissions.includes(channel === "LETTER" ? "letters.edit" : "edit:communications"); return <label className="oc-channel-choice" key={channel}><Icon size={19} aria-hidden="true"/><span>{channelNames[channel]}</span><input type="checkbox" aria-label={channelNames[channel]} disabled={!allowed} checked={channels.includes(channel)} onChange={event => setChannels(current => event.target.checked ? [...current, channel] : current.filter(item => item !== channel))}/></label>; })}</div></fieldset>
    {channels.includes("EMAIL") && channels.includes("LETTER") && <label>Email and postal delivery<select value={mode} onChange={event => setMode(event.target.value)}><option value="">Choose before approval</option><option value="EMAIL_FIRST">Email first, postal for eligible contacts without email</option><option value="LETTER_FIRST">Letter first, email for eligible contacts without post</option><option value="BOTH">Both eligible formats</option></select><span className="oc-help">Fallback is reviewed before sending. A provider failure never silently sends another format.</span></label>}
    <label>Description<textarea rows={2} maxLength={10000} value={description} onChange={event => setDescription(event.target.value)}/></label>
    {!template && <><fieldset><legend>Shared audiences</legend>{audiences.length ? audiences.map(audience => <label className="oc-check" key={audience.id}><input type="checkbox" checked={selected.includes(audience.id)} onChange={event => setSelected(current => event.target.checked ? [...current, audience.id] : current.filter(id => id !== audience.id))}/><span>{audience.name} <span className="oc-help">· {audience._count.recipients} entries</span></span></label>) : <p className="oc-help">No saved lists available. Create or manage them in Audiences.</p>}</fieldset><div className="oc-form-grid"><label>Start / default delivery time<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)}/></label><label>Campaign ends<input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)}/></label></div></>}
    <details className="oc-disclosure"><summary>Fundraising and event attribution</summary><div className="oc-form" style={{ paddingTop: 15 }}><label>Fundraising campaign<select value={fundraisingId} onChange={event => setFundraisingId(event.target.value)} disabled={!permissions.includes("edit:campaigns")}><option value="">No financial campaign linked</option>{fundraisingId && !funds.some(item => item.id === fundraisingId) && <option value={fundraisingId}>Existing linked campaign</option>}{funds.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Event<select value={eventId} onChange={event => setEventId(event.target.value)}><option value="">No event linked</option>{eventId && !events.some(item => item.id === eventId) && <option value={eventId}>Existing linked event</option>}{events.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></details>
    <div className="oc-actions" style={{ justifyContent: "flex-end" }}><button className="oc-button" type="button" onClick={close} disabled={busy}>Cancel</button><button className="oc-button primary" disabled={busy || !channels.length}>{busy ? "Saving…" : campaign ? "Save settings" : template ? "Create template" : "Create campaign"}</button></div>
  </form></Modal>;
}
