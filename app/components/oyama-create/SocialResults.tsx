"use client";
import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { message } from "./types";
export default function SocialResults({ posts }: { posts: Array<{ id: string; recipientKey: string; providerId: string | null }> }) {
  const [loaded, setLoaded] = useState<Record<string, { available: boolean; reason?: string; metrics?: Array<{ name: string; value: number | null }> }>>({});
  const [busy, setBusy] = useState("");
  async function load(id: string) { setBusy(id); try { const result = await apiFetch<typeof loaded[string]>(`/api/oyama-create/deliveries/${id}/insights`); setLoaded(items => ({ ...items, [id]: result })); } catch (error) { setLoaded(items => ({ ...items, [id]: { available: false, reason: message(error) } })); } finally { setBusy(""); } }
  return <section className="oc-card" style={{ marginTop: 20 }}><div className="oc-card-heading"><h2>Published social posts</h2></div>{posts.map(post => <div className="oc-list-item" key={post.id}><div><strong>{post.recipientKey.startsWith("INSTAGRAM") ? "Instagram" : "Facebook"} · {post.providerId}</strong>{loaded[post.id] && (loaded[post.id].available ? <p>{loaded[post.id].metrics?.map(metric => `${metric.name.replaceAll("_", " ")}: ${metric.value ?? "Unavailable"}`).join(" · ")}</p> : <p>{loaded[post.id].reason}</p>)}</div><button className="oc-button small" disabled={!!busy} onClick={() => void load(post.id)}>{busy === post.id ? "Loading…" : "Load available insights"}</button></div>)}</section>;
}
