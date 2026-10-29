"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/app/lib/auth-client";

export function useCareData<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data: T | null }>({ path: null, data: null }); const [error, setError] = useState(""); const [loading, setLoading] = useState(Boolean(path));
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { const data = await apiFetch<T>(path); setState({ path, data }); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load records."); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => {
    if (!path) return;
    let active = true; const controller = new AbortController(); setLoading(true); setError("");
    apiFetch<T>(path, { signal: controller.signal }).then((data) => { if (active) setState({ path, data }); }, (reason: Error) => { if (active && reason.name !== "AbortError") setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [path]);
  return { data: state.path === path ? state.data : null, error, loading: Boolean(path) && (loading || (!error && state.path !== path)), reload };
}
export function CareHeading({ title, description, eyebrow = "CLIENT CARE", children }: { title: string; description: string; eyebrow?: string; children?: ReactNode }) {
  return <div className="care-heading"><div><div className="care-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="care-actions">{children}</div></div>;
}
export function CareError({ error }: { error: string }) { return error ? <div className="care-error" role="alert">{error}</div> : null; }
export function CareCard({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="care-card"><div className="care-card-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>;
}
export function CareEmpty({ title, children }: { title: string; children?: ReactNode }) { return <div className="care-empty"><strong>{title}</strong>{children}</div>; }
export async function careWrite<T = unknown>(path: string, body?: unknown, method = "POST"): Promise<T> {
  return apiFetch<T>(`/api/compassion${path}`, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
export interface ClientOption { id: string; firstName: string; lastName: string; email?: string; phone?: string; clientStatus?: string; intakeDate?: string }
export function ClientPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const { data, error } = useCareData<ClientOption[]>(`/api/compassion/clients?limit=100&search=${encodeURIComponent(query)}`);
  return <div className="care-form"><label>Find a client<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or contact information" /></label><label>Client<select required value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select a client</option>{data?.map((row) => <option value={row.id} key={row.id}>{row.firstName} {row.lastName}</option>)}</select></label><CareError error={error} /></div>;
}
export function downloadCareFile(row: { base64: string; mimeType: string; name: string }) {
  const bytes = Uint8Array.from(atob(row.base64), (c) => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: row.mimeType }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = row.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
