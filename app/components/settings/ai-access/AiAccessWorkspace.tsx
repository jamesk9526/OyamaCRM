"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import type { AccessDocument, AccessRule, RuleSet, AccessDecision } from "@/server/src/ai-access/contracts";
import type { AccessMode } from "@/server/src/ai-access/catalog";
import type { McpPolicy } from "@/server/src/chatgpt/policy";
import ChatGptMcpControls from "../integrations/ChatGptMcpControls";

type Capability = { key: string; title: string; module: string; resource?: string; policyFields?: string[]; read: boolean; risk: string; permissions: string[]; effective: AccessDecision };
type Resource = { key: string; title: string; module: string; fields: string[]; owner?: string; campaign?: string; event?: string };
type Connection = { id: string; userId: string; scopes: string; createdAt: string; lastUsedAt: string | null };
type Person = { id: string; firstName: string; lastName: string; email: string; role: string };
type Setup = { scopes?: string[]; revision: number; document: AccessDocument; canManage: boolean; userId: string; capabilities: Capability[]; resources: Resource[]; users: Person[]; connections: Connection[]; targets: { events: { id: string; name: string }[]; campaigns: { id: string; name: string }[]; customFields: { id: string; name: string; entityType: string }[] }; presets: Record<string, RuleSet>; mcpPolicy: McpPolicy; mcpRevision: number; imageGenerationConfigured: boolean };
type Operation = { id: string; capability: string; status: string; actorId: string; createdAt: string; expiresAt: string; reviewerId?: string | null; finishedAt?: string | null };
type OperationDetails = Operation & { preview: { title: string; changes: { field: string; before: unknown; after: unknown }[]; heldEffects: string[] }; canInspect?: boolean; canCancel?: boolean; links?: { id: string; resource: string; url: string }[]; reviewReason?: string | null; runAfter?: string | null; exportReady?: boolean; progress?: { processed: number; total: number; items: { index: number; status: string; message?: string }[] } };
type Subject = "organization" | "roles" | "users" | "connections";
type Tab = "capabilities" | "profiles" | "connections" | "approvals" | "activity";
const tabs: { id: Tab; title: string }[] = [{ id: "capabilities", title: "Capabilities" }, { id: "profiles", title: "Profiles and overrides" }, { id: "connections", title: "Connections" }, { id: "approvals", title: "Approvals" }, { id: "activity", title: "Activity" }];
const inputStyle = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-100";
const buttonStyle = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50";
const primaryStyle = "inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50";
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
const modeLabel = (mode?: string, read = false) => mode === "automatic" ? read ? "Allowed" : "Automatic" : mode === "approval" ? "CRM approval" : "Blocked";
const display = (value: unknown) => value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

export default function AiAccessWorkspace() {
  const [data, setData] = useState<Setup | null>(null), [draft, setDraft] = useState<AccessDocument | null>(null);
  const [tab, setTab] = useState<Tab>("capabilities"), [subject, setSubject] = useState<Subject>("organization"), [subjectId, setSubjectId] = useState("");
  const [query, setQuery] = useState(""), [module, setModule] = useState("all"), [kind, setKind] = useState("all"), [selected, setSelected] = useState("constituents.read");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [preset, setPreset] = useState("read"), [presetPreview, setPresetPreview] = useState<RuleSet | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]), [cursor, setCursor] = useState<string | null>(null), [detail, setDetail] = useState<OperationDetails | null>(null), [loadingOps, setLoadingOps] = useState(false);
  const [inspectUser, setInspectUser] = useState(""), [inspectConnection, setInspectConnection] = useState(""), [inspectCapability, setInspectCapability] = useState("constituents.read"), [inspectRecord, setInspectRecord] = useState(""), [decision, setDecision] = useState<AccessDecision | null>(null);
  const [inspectField, setInspectField] = useState("");
  const [scopesCopied, setScopesCopied] = useState(false);
  const load = useCallback(async () => { try { setError(""); const setup = await apiFetch<Setup>("/api/chatgpt/access"); setData(setup); setScopesCopied(false); setDraft(structuredClone(setup.document)); setInspectUser(current => current || setup.userId); } catch (cause) { setError(cause instanceof Error ? cause.message : "AI access is unavailable."); } }, []);
  useEffect(() => { void load(); const requested = new URLSearchParams(window.location.search).get("tab"); if (tabs.some(item => item.id === requested)) setTab(requested as Tab); }, [load]);
  const loadOperations = useCallback(async (after?: string) => {
    setLoadingOps(true);
    try { const page = await apiFetch<{ items: Operation[]; nextCursor: string | null }>(`/api/chatgpt/access/operations?${new URLSearchParams({ ...(tab === "approvals" ? { status: "PENDING" } : {}), ...(after ? { cursor: after } : {}) })}`); setOperations(current => after ? [...current, ...page.items] : page.items); setCursor(page.nextCursor); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load AI operations."); }
    finally { setLoadingOps(false); }
  }, [tab]);
  useEffect(() => { if (tab === "approvals" || tab === "activity") { setDetail(null); void loadOperations(); } }, [tab, loadOperations]);
  const rules = useMemo(() => !draft ? {} : subject === "organization" ? draft.organization : draft[subject][subjectId] || {}, [draft, subject, subjectId]);
  const dirty = !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.document);
  const canEdit = !!data && (data.canManage || subject === "connections" && !!subjectId && data.connections.some(connection => connection.id === subjectId && connection.userId === data.userId));
  const capabilities = useMemo(() => data?.capabilities.filter(cap => (module === "all" || cap.module === module) && (kind === "all" || (kind === "read") === cap.read) && `${cap.key} ${cap.title} ${cap.module}`.toLowerCase().includes(query.toLowerCase())) || [], [data, module, kind, query]);
  const selectedCapability = data?.capabilities.find(cap => cap.key === selected), resource = data?.resources.find(item => item.key === selectedCapability?.resource), selectedRule = rules[selected];
  const scopeFields = selectedCapability?.policyFields || resource?.fields || [];
  const inspectResource = data?.resources.find(item => item.key === data.capabilities.find(cap => cap.key === inspectCapability)?.resource);
  const setRules = (next: RuleSet) => setDraft(current => current ? subject === "organization" ? { ...current, organization: next } : { ...current, [subject]: { ...current[subject], [subjectId]: next } } : current);
  const updateRule = (key: string, rule?: AccessRule) => { const next = { ...rules }; if (rule) next[key] = rule; else delete next[key]; setRules(next); };
  const updateSelected = (change: Partial<AccessRule>) => updateRule(selected, { ...selectedRule, ...change, mode: change.mode ?? selectedRule?.mode ?? "blocked" });
  function previewProfile(name: string) {
    if (!data) return;
    setPreset(name);
    setPresetPreview(name === "all" ? Object.fromEntries(data.capabilities.map(cap => [cap.key, { mode: "automatic" as const }])) : data.presets[name]);
    setTab("profiles");
  }
  async function save() {
    if (!data || !draft) return;
    setBusy(true); setError(""); setNotice("");
    try { await apiFetch(data.canManage ? "/api/chatgpt/access" : `/api/chatgpt/access/connections/${encodeURIComponent(subjectId)}`, { method: "PUT", body: JSON.stringify(data.canManage ? { revision: data.revision, document: draft } : { revision: data.revision, rules }) }); await load(); setNotice("AI access saved. Existing connections keep their consent limits; reconnect in ChatGPT to increase access."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save AI access."); }
    finally { setBusy(false); }
  }
  async function inspect() {
    setBusy(true); setError("");
    try { setDecision(await apiFetch<AccessDecision>("/api/chatgpt/access/effective", { method: "POST", body: JSON.stringify({ userId: inspectUser, connectionId: inspectConnection || undefined, capability: inspectCapability, recordId: inspectRecord.trim() || undefined, field: inspectField || undefined }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to inspect access."); }
    finally { setBusy(false); }
  }
  async function inspectOperation(id: string) { setError(""); try { setDetail(await apiFetch<OperationDetails>(`/api/chatgpt/access/operations/${encodeURIComponent(id)}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to review this operation."); } }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("operation");
    if (id && (tab === "activity" || tab === "approvals")) void inspectOperation(id);
  }, [tab]);
  async function downloadExport(id: string) {
    setBusy(true); setError("");
    try {
      const response = await apiFetchResponse(`/api/chatgpt/access/operations/${encodeURIComponent(id)}/export`);
      if (!response.ok) throw new Error("This export is unavailable under the current connection permissions.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "oyama-crm-export.csv"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to download the export."); }
    finally { setBusy(false); }
  }
  async function decide(approved: boolean) {
    if (!detail) return; setBusy(true); setError("");
    try { await apiFetch(`/api/chatgpt/access/operations/${encodeURIComponent(detail.id)}/decision`, { method: "POST", body: JSON.stringify({ approved }) }); setDetail(null); await loadOperations(); setNotice(approved ? "Approved. CRM will recheck access and record versions before execution." : "Request rejected."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to handle this approval."); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true); setError("");
    try {
      await apiFetch(`/api/chatgpt/access/operations/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      setDetail(null); await loadOperations(); setNotice("Operation cancelled.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0 space-y-5 text-slate-900">
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Settings · ChatGPT</p><h1 className="mt-1 text-2xl font-semibold">AI access</h1><p className="mt-2 text-sm leading-6 text-slate-700">Control what ChatGPT can read and change across your CRM. Each connection stays within the signed-in user’s CRM permissions.</p></div>
      <Link href="/settings/integrations" className={buttonStyle}>Connection setup</Link>
    </header>
    <nav aria-label="AI access views" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{tabs.map(item => <button key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? primaryStyle : buttonStyle} onClick={() => setTab(item.id)}>{item.title}</button>)}</nav>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}<button className="ml-3 underline" onClick={() => void load()}>Reload settings</button></div>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}
    {!data && !error && <p role="status">Loading AI access…</p>}
    {data && draft && <>
      {(tab === "capabilities" || tab === "profiles") && <>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Policy subject">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <label className="text-sm font-medium">Policy level<select className={`${inputStyle} mt-1`} value={subject} onChange={event => { setSubject(event.target.value as Subject); setSubjectId(""); setPresetPreview(null); }}><option value="organization">Organization ceiling</option><option value="roles" disabled={!data.canManage}>Role defaults</option><option value="users" disabled={!data.canManage}>User exceptions</option><option value="connections">Connection restrictions</option></select></label>
            {subject !== "organization" ? <label className="text-sm font-medium">{subject === "roles" ? "Role" : subject === "users" ? "CRM user" : "Connection"}<select className={`${inputStyle} mt-1`} value={subjectId} onChange={event => setSubjectId(event.target.value)}><option value="">Choose a {subject === "roles" ? "role" : subject === "users" ? "user" : "connection"}</option>{subject === "roles" ? ["admin", "manager", "staff", "readonly", "report_viewer", "shareview_user"].map(role => <option key={role}>{role}</option>) : subject === "users" ? data.users.map(user => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {user.email}</option>) : data.connections.map(connection => <option key={connection.id} value={connection.id}>{data.users.find(user => user.id === connection.userId)?.email || "My account"} · {new Date(connection.createdAt).toLocaleDateString()} · {connection.id.slice(-6)}</option>)}</select></label> : <p className="self-center text-sm leading-6 text-slate-600">Organization limits always apply. User exceptions can change a role default; connections and consent can only narrow access.</p>}
            <button className={`${primaryStyle} self-end`} disabled={busy || !dirty || !canEdit} onClick={() => void save()}>{busy ? "Saving…" : "Save access"}</button>
          </div>
          {!data.canManage && <p className="text-sm text-slate-600">An administrator manages organization access. You can inspect your permissions and restrict your own connections.</p>}
          {data.canManage && subject !== "connections" && <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4"><button className={buttonStyle} disabled={busy || subject !== "organization" && !subjectId} onClick={() => previewProfile("all")}>Allow all capabilities</button><p className="text-sm text-slate-600">Allow every current read and set writes to automatic at this policy level. Review the changes, then save access.</p></div>}
          {presetPreview && preset === "all" && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">This grants automatic sending, publishing, deletion and paid image generation at the selected policy level. CRM permissions, organization limits, integration controls and existing connection consent still apply.</p>}
          {dirty && <p role="status" className="text-sm font-medium text-amber-900">You have unsaved changes. Effective-access previews use the saved policy.</p>}
        </section>
        <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="ChatGPT OAuth scopes">
          <h2 className="font-semibold">Scopes to allow in ChatGPT</h2>
          <p className="text-sm text-slate-700">This list reflects saved access for your CRM account. Save Allow all changes first, then copy these default scopes into the MCP connection and reconnect to approve expanded access.</p>
          <pre className="whitespace-pre-wrap break-all rounded-lg border border-blue-100 bg-white p-3 text-sm">{data.scopes?.join("\n") || "Save access to see available scopes."}</pre>
          <button className={buttonStyle} disabled={!data.scopes?.length} onClick={async () => { try { await navigator.clipboard.writeText(data.scopes!.join("\n")); setScopesCopied(true); } catch { setError("Select and copy the displayed scope list."); } }}>{scopesCopied ? "Scopes copied" : "Copy MCP scopes"}</button>
          <p className="text-xs text-slate-600">The same list appears in Connection setup. Integration controls and current CRM permissions still apply.</p>
        </section>
        {tab === "profiles" && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Start with a profile</h2><p className="text-sm text-slate-600">Review the exact changes before applying a profile to this policy level. Billed image generation remains an explicit choice.</p><div className="flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-sm font-medium"><span className="sr-only">Access profile</span><select className={inputStyle} value={preset} onChange={event => setPreset(event.target.value)}><option value="all">Allow all · automatic writes</option><option value="read">Full business read</option><option value="drafting">Drafting assistant</option><option value="supervised">Supervised operations</option></select></label><button className={buttonStyle} disabled={!canEdit || subject !== "organization" && !subjectId} onClick={() => previewProfile(preset)}>Preview profile changes</button></div>
          {presetPreview && <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><h3 className="font-semibold">Profile change preview</h3><p className="text-sm">{Object.entries(presetPreview).filter(([key, value]) => JSON.stringify(rules[key]) !== JSON.stringify(value)).length} scope rules will change. Existing custom rules outside this profile are retained.</p><ul className="max-h-64 overflow-auto text-sm">{Object.entries(presetPreview).filter(([key, value]) => JSON.stringify(rules[key]) !== JSON.stringify(value)).map(([key, rule]) => <li key={key} className="flex flex-wrap justify-between gap-2 border-b border-blue-100 py-2"><span className="break-all">{key}</span><span>{modeLabel(rules[key]?.mode, data.capabilities.find(cap => cap.key === key)?.read)} → {modeLabel(rule.mode, data.capabilities.find(cap => cap.key === key)?.read)}</span></li>)}</ul><div className="flex flex-wrap gap-2"><button className={primaryStyle} onClick={() => { setRules({ ...rules, ...presetPreview }); setPresetPreview(null); }}>Apply to draft policy</button><button className={buttonStyle} onClick={() => setPresetPreview(null)}>Cancel preview</button></div></div>}
          <h3 className="pt-3 font-semibold">Operation limits</h3><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(draft.limits).map(([key, value]) => <label key={key} className="text-sm font-medium">{({ maxRows: "Rows per record page", maxBatch: "Actions per batch", maxRecipients: "Recipients per send", maxExport: "Records per export", dailyImages: "Image requests per UTC day" } as Record<string, string>)[key]}<input type="number" className={`${inputStyle} mt-1`} min={key === "dailyImages" ? 0 : 1} max={key === "maxRows" || key === "maxBatch" ? 100 : key === "dailyImages" ? 10 : 10000} value={value} disabled={!data.canManage} onChange={event => setDraft({ ...draft, limits: { ...draft.limits, [key]: event.target.valueAsNumber } })}/></label>)}</div>
          <ChatGptMcpControls key={data.mcpRevision} policy={data.mcpPolicy} revision={data.mcpRevision} canManage={data.canManage} imageGenerationConfigured={data.imageGenerationConfigured} onSaved={async () => { await load(); setNotice("MCP controls saved."); }} onReload={load}/>
        </section>}
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white" aria-label="Capability matrix">
            <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-3"><label className="text-sm font-medium">Search capabilities<input className={`${inputStyle} mt-1`} placeholder="Donors, email, gifts…" value={query} onChange={event => setQuery(event.target.value)}/></label><label className="text-sm font-medium">Module<select className={`${inputStyle} mt-1`} value={module} onChange={event => setModule(event.target.value)}><option value="all">All modules</option>{[...new Set(data.capabilities.map(cap => cap.module))].sort().map(item => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-medium">Action type<select className={`${inputStyle} mt-1`} value={kind} onChange={event => setKind(event.target.value)}><option value="all">Read and write</option><option value="read">Read</option><option value="write">Write</option></select></label></div>
            <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">{capabilities.length} capabilities · New capabilities are blocked until granted. Existing letter and report tools retain their previous settings.</p>
            {!capabilities.length && <p className="p-6 text-sm text-slate-600">No capabilities match these filters.</p>}
            <div className="max-h-[650px] overflow-y-auto">{capabilities.map(cap => <div key={cap.key} className={`grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] ${selected === cap.key ? "bg-blue-50/60" : ""}`}><div className="min-w-0"><p className="text-sm font-semibold">{cap.title}</p><p className="mt-1 break-all text-xs text-slate-600">{cap.module} · {cap.key}</p>{rules[cap.key]?.records && rules[cap.key].records !== "all" && <p className="mt-1 text-xs text-blue-800">Restricted records</p>}</div><select aria-label={`Access for ${cap.key}`} className={inputStyle} value={rules[cap.key]?.mode || ""} disabled={!canEdit || subject !== "organization" && !subjectId} onChange={event => updateRule(cap.key, event.target.value ? { ...rules[cap.key], mode: event.target.value as AccessMode } : undefined)}><option value="">{subject === "organization" ? "Use default" : "Inherit"}</option><option value="blocked">Blocked</option>{!cap.read && <option value="approval">CRM approval</option>}<option value="automatic">{cap.read ? "Allowed" : "Automatic"}</option></select><button aria-label={`Configure ${cap.key}`} className={buttonStyle} onClick={() => setSelected(cap.key)}>Details</button></div>)}</div>
          </section>
          <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Scope details">{selectedCapability && <>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Scope details</p><h2 className="mt-2 font-semibold">{selectedCapability.title}</h2><p className="mt-1 break-all text-xs text-slate-600">{selectedCapability.key}</p></div>
            <p className="text-sm text-slate-600">CRM permission: {selectedCapability.permissions.join(", ") || "Each returned record is checked separately."}</p>
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">Saved access for your CRM account: {modeLabel(selectedCapability.effective.mode, selectedCapability.read)}</p>{selectedCapability.effective.reasons.map(reason => <p key={reason} className="mt-2 text-slate-600">{reason}</p>)}</div>
            {resource && <fieldset disabled={!canEdit || subject !== "organization" && !subjectId} className="space-y-4 disabled:opacity-60"><legend className="text-sm font-semibold">Record and field restrictions</legend>
              <label className="block text-sm font-medium">Records<select className={`${inputStyle} mt-1`} value={selectedRule?.records || "all"} onChange={event => updateSelected({ records: event.target.value as AccessRule["records"] })}><option value="all">All otherwise accessible records</option>{resource.owner && <option value="own">Owned by or assigned to this user</option>}{(resource.campaign || resource.event || ["campaigns", "events"].includes(resource.key)) && <option value="selected">Selected campaigns or events</option>}</select></label>
              {selectedRule?.records === "selected" && <>{(["campaigns", "events"] as const).filter(group => group === "campaigns" ? resource.campaign || resource.key === "campaigns" : resource.event || resource.key === "events").map(group => <fieldset key={group} className="max-h-44 overflow-auto rounded-lg border border-slate-200 p-3"><legend className="px-1 text-sm font-medium">{group === "campaigns" ? "Campaigns" : "Events"}</legend>{data.targets[group].length ? data.targets[group].map(target => { const key = group === "campaigns" ? "campaignIds" : "eventIds"; return <label key={target.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selectedRule[key]?.includes(target.id) || false} onChange={event => updateSelected({ [key]: event.target.checked ? [...selectedRule[key] || [], target.id] : selectedRule[key]?.filter(id => id !== target.id) })}/>{target.name}</label>; }) : <p className="text-sm text-slate-600">No records available.</p>}</fieldset>)}</>}
              {!!scopeFields.length && <div><p className="text-sm font-medium">Permitted fields</p><p className="mt-1 text-xs text-slate-600">Field categories need their own read scope. A field list can narrow that access further.</p><div className="mt-2 flex gap-3"><button type="button" className="min-h-9 text-sm text-blue-700 underline" onClick={() => updateSelected({ fields: scopeFields })}>Select all</button><button type="button" className="min-h-9 text-sm text-blue-700 underline" onClick={() => updateSelected({ fields: [] })}>Clear all</button></div><div className="max-h-64 overflow-auto">{scopeFields.map(field => <label key={field} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={!selectedRule?.fields || selectedRule.fields.includes(field)} onChange={event => { const fields = selectedRule?.fields || scopeFields; updateSelected({ fields: event.target.checked ? [...fields, field] : fields.filter(value => value !== field) }); }}/>{label(field)}</label>)}</div></div>}
              {["custom_fields", "custom_values"].includes(resource.key) && selected !== "custom_fields.create" && <fieldset className="max-h-56 overflow-auto rounded-lg border border-slate-200 p-3"><legend className="px-1 text-sm font-medium">Individual custom fields</legend>{data.targets.customFields.map(field => <label key={field.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!selectedRule?.customFieldIds || selectedRule.customFieldIds.includes(field.id)} onChange={event => { const values = selectedRule?.customFieldIds || data.targets.customFields.map(item => item.id); updateSelected({ customFieldIds: event.target.checked ? [...values, field.id] : values.filter(value => value !== field.id) }); }}/>{field.name} · {field.entityType}</label>)}</fieldset>}
            </fieldset>}
          </>}</aside>
        </div>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-label="Effective access preview">
          <h2 className="font-semibold">Explain effective access</h2>
          <p className="text-sm text-slate-600">Inspect saved policy, consent and CRM permissions together. Choose a connection to check record ownership.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium">User
              <select className={`${inputStyle} mt-1`} value={inspectUser} onChange={event => { setInspectUser(event.target.value); setInspectConnection(""); setInspectRecord(""); setDecision(null); }} disabled={!data.canManage}>
                {data.users.length ? data.users.map(user => <option key={user.id} value={user.id}>{user.email}</option>) : <option value={data.userId}>My account</option>}
              </select>
            </label>
            <label className="text-sm font-medium">Connection
              <select className={`${inputStyle} mt-1`} value={inspectConnection} onChange={event => { setInspectConnection(event.target.value); setInspectRecord(""); setDecision(null); }}>
                <option value="">Without connection limits</option>
                {data.connections.filter(connection => connection.userId === inspectUser).map(connection => <option key={connection.id} value={connection.id}>{new Date(connection.createdAt).toLocaleDateString()} · {connection.id.slice(-6)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Capability
              <select className={`${inputStyle} mt-1`} value={inspectCapability} onChange={event => { setInspectCapability(event.target.value); setInspectField(""); setInspectRecord(""); setDecision(null); }}>
                {data.capabilities.map(cap => <option key={cap.key} value={cap.key}>{cap.key}</option>)}
              </select>
            </label>
            {inspectResource && <>
              <label className="text-sm font-medium">Record ID (optional)
                <input className={`${inputStyle} mt-1`} value={inspectRecord} onChange={event => { setInspectRecord(event.target.value); setDecision(null); }} placeholder="A verified CRM record ID" disabled={!inspectConnection} />
              </label>
              <label className="text-sm font-medium">Field (optional)
                <select className={`${inputStyle} mt-1`} value={inspectField} onChange={event => { setInspectField(event.target.value); setDecision(null); }}>
                  <option value="">Check the action</option>
                  {inspectResource.fields.map(field => <option key={field} value={field}>{label(field)}</option>)}
                </select>
              </label>
            </>}
          </div>
          <button className={buttonStyle} disabled={busy} onClick={() => void inspect()}>Check effective access</button>
          {decision && <div role="status" className={`rounded-lg border p-4 text-sm ${decision.mode === "blocked" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
            <p className="font-semibold">{decision.capability}{inspectField ? ` · ${label(inspectField)}` : ""} · {modeLabel(decision.mode, data.capabilities.find(cap => cap.key === decision.capability)?.read)}</p>
            {decision.reasons.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{decision.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p className="mt-2">Allowed by the selected policy and current CRM permissions.</p>}
          </div>}
        </section>
      </>}
      {tab === "connections" && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Connected accounts</h2><p className="mt-2 text-sm text-slate-600">Increasing a policy never increases an existing connection’s consent. Disconnecting cancels work that has not started.</p>{!data.connections.length && <p className="py-6 text-sm text-slate-600">No active ChatGPT connections. Use Connection setup to link an account.</p>}<ul className="mt-4 space-y-3">{data.connections.map(connection => <li key={connection.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-medium">{data.users.find(user => user.id === connection.userId)?.email || "My ChatGPT connection"}</p><p className="mt-1 text-sm text-slate-600">Connected {new Date(connection.createdAt).toLocaleString()} · {connection.lastUsedAt ? `Last used ${new Date(connection.lastUsedAt).toLocaleString()}` : "Not used yet"}</p></div><div className="flex flex-wrap gap-2"><button className={buttonStyle} onClick={() => { setSubject("connections"); setSubjectId(connection.id); setTab("capabilities"); }}>Configure access</button><button className={buttonStyle} disabled={busy} onClick={async () => { setBusy(true); try { await apiFetch(`/api/chatgpt/access/connections/${encodeURIComponent(connection.id)}`, { method: "DELETE" }); await load(); setNotice("Connection disconnected; pending work was cancelled."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to disconnect."); } finally { setBusy(false); } }}>Disconnect</button></div></div><details className="mt-3"><summary className="min-h-9 cursor-pointer text-sm font-medium">Consented OAuth scopes</summary><p className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs">{connection.scopes.split(" ").join("\n")}</p></details></li>)}</ul></section>}
      {(tab === "approvals" || tab === "activity") && <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]"><section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{tab === "approvals" ? "Pending CRM approvals" : "AI operation history"}</h2><button className={buttonStyle} disabled={loadingOps} onClick={() => void loadOperations()}>Refresh operations</button></div><p className="mt-2 text-sm text-slate-600">{tab === "approvals" ? "Requests expire after 24 hours. CRM rechecks access and record versions before executing approved changes." : "Follow requested changes, queued work and outcomes. Interrupted actions are not automatically repeated."}</p>{loadingOps && <p role="status" className="py-4 text-sm">Loading operations…</p>}{!operations.length && !loadingOps && <p className="py-6 text-sm text-slate-600">{tab === "approvals" ? "No requests are waiting for approval." : "No AI operations have been requested yet."}</p>}<ul className="mt-4 divide-y divide-slate-100">{operations.map(operation => <li key={operation.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-all text-sm font-semibold">{data.capabilities.find(cap => cap.key === operation.capability)?.title || operation.capability}</p><p className="mt-1 text-xs text-slate-600">{new Date(operation.createdAt).toLocaleString()} · {operation.status}</p></div><button className={buttonStyle} onClick={() => void inspectOperation(operation.id)}>Review details</button></li>)}</ul>{cursor && <button className={`${buttonStyle} mt-4`} disabled={loadingOps} onClick={() => void loadOperations(cursor)}>Load more operations</button>}</section>
        <section className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-label="Operation details">
          {detail ? <>
            <h2 className="font-semibold">{detail.preview.title}</h2>
            <p className="text-sm text-slate-600">{detail.status} · Requested {new Date(detail.createdAt).toLocaleString()}</p>
            {!!detail.links?.length && <details className="rounded-lg border border-slate-200 p-3 text-sm">
              <summary className="cursor-pointer font-medium">Affected records ({detail.links.length})</summary>
              <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">{detail.links.map((target, index) => <li key={`${target.resource}:${target.id}:${index}`} className="break-all"><Link href={target.url} className="text-blue-700 underline">{label(target.resource)} · {target.id}</Link></li>)}</ul>
            </details>}
            <dl className="divide-y divide-slate-200">
              {detail.preview.changes.map((change, index) => <div key={`${change.field}-${index}`} className="py-3">
                <dt className="text-sm font-semibold">{label(change.field)}</dt>
                <dd className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                  <div className="min-w-0"><p className="text-xs font-medium text-slate-600">Before</p><pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs">{display(change.before)}</pre></div>
                  <div className="min-w-0"><p className="text-xs font-medium text-slate-600">Proposed</p><pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-blue-50 p-3 text-xs">{display(change.after)}</pre></div>
                </dd>
              </div>)}
            </dl>
            {detail.preview.heldEffects.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{detail.preview.heldEffects.map(effect => <p key={effect}>{effect}</p>)}</div>}
            {detail.reviewReason && <p className="text-sm text-slate-700">{detail.reviewReason}</p>}
            {detail.status === "PENDING" && <div className="flex flex-wrap gap-2">
              <button className={primaryStyle} disabled={busy || detail.canInspect === false || new Date(detail.expiresAt).getTime() <= Date.now()} onClick={() => void decide(true)}>Approve changes</button>
              <button className={buttonStyle} disabled={busy} onClick={() => void decide(false)}>Reject request</button>
            </div>}
            {detail.runAfter && <p className="text-sm text-slate-700">Scheduled for {new Date(detail.runAfter).toLocaleString()}</p>}
            {detail.progress && <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>{detail.progress.processed} of {detail.progress.total} actions processed</p>
              <ul className="mt-2 space-y-1">{detail.progress.items.map(item => <li key={item.index}>Item {item.index} · {item.status}{item.message ? ` · ${item.message}` : ""}</li>)}</ul>
            </div>}
            <div className="flex flex-wrap gap-2">
              {detail.exportReady && <button className={buttonStyle} disabled={busy} onClick={() => void downloadExport(detail.id)}>Download CSV</button>}
              {detail.canCancel !== false && (["PENDING", "QUEUED", "SCHEDULED"].includes(detail.status) || detail.status === "RUNNING" && detail.capability === "records.batch") && <button className={buttonStyle} disabled={busy} onClick={() => void cancel(detail.id)}>{detail.status === "RUNNING" ? "Cancel remaining actions" : "Cancel operation"}</button>}
            </div>
          </> : <p className="text-sm text-slate-600">Choose an operation to inspect its proposed changes and review status.</p>}
        </section>
      </div>}
      <p className="text-xs leading-5 text-slate-600">Clinical records, credentials, security administration and system resets are outside this connection. CRM permissions and ownership checks always apply. Manage staff permissions in <Link href="/settings/users" className="text-blue-700 underline">Team access</Link>.</p>
    </>}
  </div>;
}
