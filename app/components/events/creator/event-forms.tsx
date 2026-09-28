"use client";

import { apiFetch } from "@/app/lib/auth-client";

export const creatorInput = "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
export interface EventDetailsFieldsValue {
  name: string; description?: string | null; startDate: string; endDate?: string | null;
  location?: string | null; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; virtualUrl?: string | null;
}
export function toLocalEventDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function eventDetailsPayload(value: EventDetailsFieldsValue) {
  return {
    name: value.name.trim(), description: value.description?.trim() || null,
    startDate: new Date(value.startDate).toISOString(), endDate: value.endDate ? new Date(value.endDate).toISOString() : null,
    location: value.location?.trim() || null, address: value.address?.trim() || null,
    city: value.city?.trim() || null, state: value.state?.trim() || null, zip: value.zip?.trim() || null, virtualUrl: value.virtualUrl?.trim() || null,
  };
}

/** Shared canonical public details fields, used by settings and creation. */
export function EventDetailsFields({ value, onChange }: { value: EventDetailsFieldsValue; onChange: (value: EventDetailsFieldsValue) => void }) {
  function field(key: keyof EventDetailsFieldsValue, label: string, type = "text", required = false, maxLength?: number) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input className={creatorInput} type={type} required={required} maxLength={maxLength} value={value[key] ?? ""} min={key === "endDate" ? value.startDate : undefined} onChange={(event) => onChange({ ...value, [key]: event.target.value })} /></label>;
  }
  return <div className="space-y-5">
    {field("name", "Event name", "text", true, 160)}
    <label className="block text-sm font-medium text-slate-700">Description<textarea className={`${creatorInput} py-3`} rows={4} maxLength={10000} value={value.description ?? ""} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label>
    {field("startDate", "Start date and time", "datetime-local", true)}
    <p className="text-xs text-slate-500">Times use your browser timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
    {field("location", "Venue name (optional)", "text", false, 255)}
    <details className="rounded-xl border border-slate-200 p-4" open={Boolean(value.endDate || value.address || value.virtualUrl) || undefined}>
      <summary className="cursor-pointer text-sm font-semibold text-blue-700">End time, address, and virtual access</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2">{field("endDate", "End date and time", "datetime-local")}</div><div className="sm:col-span-2">{field("address", "Street address", "text", false, 255)}</div>{field("city", "City", "text", false, 120)}{field("state", "State", "text", false, 80)}{field("zip", "ZIP / postal code", "text", false, 24)}{field("virtualUrl", "Virtual event URL", "url", false, 2000)}</div>
    </details>
  </div>;
}

export interface TicketFormValue {
  name: string; description: string; price: string; capacity: string; available: string; isTable: boolean; seatsIncluded: string;
  minPerOrder: string; maxPerOrder: string; active: boolean;
}
export const defaultCreationTicket: TicketFormValue = { name: "General Admission", description: "", price: "0", capacity: "", available: "", isTable: false, seatsIncluded: "1", minPerOrder: "1", maxPerOrder: "", active: true };
export function ticketPayload(form: TicketFormValue) {
  return { name: form.name.trim(), description: form.description.trim() || null, price: Number(form.price), capacity: form.capacity === "" ? null : Number(form.capacity), available: form.available === "" ? null : Number(form.available), isTable: form.isTable, seatsIncluded: Number(form.seatsIncluded), minPerOrder: Number(form.minPerOrder), maxPerOrder: form.maxPerOrder === "" ? null : Number(form.maxPerOrder), active: form.active };
}
export function saveEventTicket<T>(eventId: string, form: TicketFormValue, id?: string): Promise<T> {
  return apiFetch<T>(`/api/events/${eventId}/ticket-types${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(ticketPayload(form)) });
}
export function TicketFields({ value, onChange }: { value: TicketFormValue; onChange: (value: TicketFormValue) => void }) {
  function field(key: "name" | "price" | "capacity" | "available" | "seatsIncluded" | "minPerOrder" | "maxPerOrder", label: string, required = false) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input className={creatorInput} type={key === "name" ? "text" : "number"} min={["price", "capacity", "available"].includes(key) ? 0 : 1} max={key === "price" ? 100000000 : key === "seatsIncluded" ? 50 : key === "name" ? undefined : 1000000} maxLength={key === "name" ? 160 : undefined} step={key === "price" ? "0.01" : 1} required={required} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} /></label>;
  }
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">{field("name", "Ticket name", true)}{field("price", "Price per ticket", true)}</div>
    <div className="grid gap-4 sm:grid-cols-2">{field("seatsIncluded", "Guests per ticket", true)}<label className="flex min-h-11 items-center gap-3 self-end text-sm font-medium text-slate-700"><input className="h-4 w-4 accent-blue-600" type="checkbox" checked={value.isTable} onChange={(event) => onChange({ ...value, isTable: event.target.checked, seatsIncluded: event.target.checked && value.seatsIncluded === "1" ? "8" : value.seatsIncluded })} />Reserve a table for each ticket</label></div>
    <div className="border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-900">Inventory</h3><p className="mt-1 text-xs text-slate-500">Limits count tickets; event capacity counts guests.</p><div className="mt-3 grid gap-4 sm:grid-cols-2">{field("capacity", "Total ticket limit")}{field("available", "Tickets remaining")}</div><p className="mt-2 text-xs text-slate-500">New tickets start with the total limit available. Edit remaining tickets to change what guests can reserve now.</p></div>
    <div className="border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-900">Order limits</h3><div className="mt-3 grid gap-4 sm:grid-cols-2">{field("minPerOrder", "Minimum per order", true)}{field("maxPerOrder", "Maximum per order")}</div><p className="mt-2 text-xs text-slate-500">Leave maximum blank for 10 tickets per order.</p></div>
    <div className="border-t border-slate-200 pt-5"><label className="block text-sm font-medium text-slate-700">Description <span className="font-normal text-slate-500">(optional)</span><textarea className={`${creatorInput} py-2`} rows={3} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label></div>
    <label className="flex min-h-11 items-center gap-3 border-t border-slate-200 pt-5 text-sm font-medium text-slate-700"><input className="h-4 w-4 accent-blue-600" type="checkbox" checked={value.active} onChange={(event) => onChange({ ...value, active: event.target.checked })} />Available for registration</label>
  </div>;
}
