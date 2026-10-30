"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, ThumbsUp, Users, RefreshCw, LockKeyhole } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ProfileAvatar, { profileName, type ProfileIdentity } from "./ProfileAvatar";

type Post = { id: string; body: string; authorId: string; author: ProfileIdentity; createdAt: string; updatedAt: string; _count: { replies: number; reactions: number }; reactions: Array<{ userId: string }> };
type Reply = { id: string; body: string; authorId: string; author: ProfileIdentity; createdAt: string };
type Member = ProfileIdentity & { bio: string | null; timezone: string | null; email: string; phone: string | null };
type Page<T> = { items: T[]; hasMore: boolean };
const root = "/api/admin-community";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50";
const input = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100";
function message(error: unknown) { return error instanceof Error ? error.message : "Unable to complete this action. Please retry."; }
function Stamp({ value }: { value: string }) { return <time dateTime={value} className="text-xs text-slate-600">{new Date(value).toLocaleString()}</time>; }

export default function AdminCommunity() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"feed" | "members">("feed");
  const [mine, setMine] = useState(false), [page, setPage] = useState(1);
  const [feed, setFeed] = useState<Page<Post>>({ items: [], hasMore: false });
  const searchParams = useSearchParams();
  const focusPost = searchParams.get("post");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [body, setBody] = useState(""), [posting, setPosting] = useState(false), [notice, setNotice] = useState("");
  const request = useRef<{ id: string; body: string } | null>(null), sending = useRef(false), generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError("");
    try {
      const result = focusPost ? { items: [await apiFetch<Post>(`${root}/posts/${encodeURIComponent(focusPost)}`)], hasMore: false } : await apiFetch<Page<Post>>(`${root}/posts?page=${page}&mine=${mine}`);
      if (generation.current === current) setFeed(result);
    } catch (reason) { if (generation.current === current) setError(message(reason)); }
    finally { if (generation.current === current) setLoading(false); }
  }, [page, mine, focusPost]);
  useEffect(() => { const counter = generation; if (user?.role === "admin") void load(); return () => { counter.current++; }; }, [load, user?.role]);
  if (authLoading) return <p role="status" className="p-6">Loading your workspace…</p>;
  if (user?.role !== "admin") return <section className="rounded-xl border bg-white p-8"><h1 className="text-xl font-semibold">Admin community</h1><p className="mt-3">This private workspace is available to your organization’s administrators.</p><Link href="/" className="mt-4 inline-block text-teal-800 underline">Return to dashboard</Link></section>;
  return <div className="mx-auto max-w-6xl space-y-6 pb-10">
    <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#10273d] to-[#075b59] p-6 shadow-sm sm:p-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-200"><LockKeyhole size={15} />Private to your organization</p>
      <h1 className="mt-3 text-3xl font-semibold" style={{ color: "#fff" }}>Your team. One conversation.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">Share progress, ask a question, and stay connected with the people guiding your mission.</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/settings/profile" className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-teal-900">Set up your profile</Link><Link href="/settings/notification-email" className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white">Email preferences</Link></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Community views" className="flex gap-2"><button className={tab === "feed" ? primary : button} aria-pressed={tab === "feed"} onClick={() => setTab("feed")}><MessageCircle size={17} />Feed</button><button className={tab === "members" ? primary : button} aria-pressed={tab === "members"} onClick={() => setTab("members")}><Users size={17} />Admin directory</button></nav>{tab === "feed" && <button className={button} disabled={loading} onClick={() => void load()}><RefreshCw size={16} className={loading ? "motion-safe:animate-spin" : ""} />Refresh feed</button>}</div>
    {tab === "members" ? <Directory /> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <main className="min-w-0 space-y-5">
        {!focusPost && <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={async event => {
          event.preventDefault(); if (sending.current || !body.trim()) return; sending.current = true; setPosting(true); setNotice(""); setError("");
          if (!request.current || request.current.body !== body) request.current = { id: crypto.randomUUID(), body };
          try { await apiFetch(`${root}/posts`, { method: "POST", body: JSON.stringify({ body, requestId: request.current.id }) }); setBody(""); request.current = null; setNotice("Your update is published to this organization’s administrators."); if (page === 1) await load(); else setPage(1); }
          catch (reason) { setError(message(reason)); } finally { sending.current = false; setPosting(false); }
        }}>
          <div className="flex items-center gap-3"><ProfileAvatar person={user} /><div><h2 className="font-semibold">Share an update</h2><p className="text-xs text-slate-600">Posting as {profileName(user)}</p></div></div>
          <label className="block"><span className="sr-only">Your update</span><textarea className={input} rows={4} maxLength={3000} required disabled={posting} placeholder="What would you like your fellow admins to know?" value={body} onChange={event => setBody(event.target.value)} /></label>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-600">Admins only · {body.length}/3,000</span><button disabled={posting || !body.trim()} className={primary}>{posting ? "Publishing…" : "Publish update"}</button></div>
        </form>}
        {notice && <p role="status" className="rounded-lg bg-teal-50 p-4 text-sm text-teal-900">{notice}</p>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{focusPost ? "Conversation" : "Latest conversations"}</h2>{focusPost ? <Link href="/community" className="text-sm font-semibold text-teal-800">All conversations</Link> : <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" checked={mine} onChange={event => { setMine(event.target.checked); setPage(1); }} />My posts only</label>}</div>
        {loading && !feed.items.length ? <div role="status" className="space-y-4 rounded-xl border bg-white p-6"><p className="text-sm text-slate-600">Loading conversations…</p><div className="h-24 rounded-lg bg-slate-100 motion-safe:animate-pulse" /></div> : !error && !feed.items.length ? <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><h3 className="font-semibold">{mine ? "You haven’t posted yet" : "Start your first conversation"}</h3><p className="mt-2 text-sm text-slate-600">Share a team win, an idea, or a question using the composer above.</p></section> : !error && feed.items.map(post => <PostCard key={post.id} post={post} userId={user.id} onChanged={load} initiallyOpen={Boolean(focusPost)} />)}
        {!focusPost && <Pagination page={page} hasMore={feed.hasMore} disabled={loading} setPage={setPage} />}
      </main>
      <aside className="space-y-4 lg:sticky lg:top-24"><section className="rounded-2xl border border-slate-200 bg-white p-5"><ProfileAvatar person={user} large /><h2 className="mt-4 font-semibold">{profileName(user)}</h2><p className="mt-1 text-sm text-slate-600">{user.jobTitle || "Add your professional title"}</p><Link href="/settings/profile" className="mt-4 inline-block text-sm font-semibold text-teal-800">Edit my profile →</Link></section><section className="rounded-2xl border border-teal-100 bg-teal-50 p-5"><h2 className="font-semibold text-teal-950">A space for your team</h2><p className="mt-2 text-sm leading-6 text-teal-950">Posts and profile contact details are visible to administrators in your organization. Keep donor and client details in their CRM records.</p><p className="mt-3 text-sm leading-6 text-teal-950">Replies notify the post’s author. Email delivery follows their personal notification preferences.</p></section></aside>
    </div>}
  </div>;
}

function Pagination({ page, hasMore, disabled, setPage }: { page: number; hasMore: boolean; disabled: boolean; setPage: (page: number) => void }) {
  return <div className="flex items-center justify-between gap-3"><button className={button} disabled={disabled || page === 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-sm text-slate-600">Page {page}</span><button className={button} disabled={disabled || !hasMore || page >= 1000} onClick={() => setPage(page + 1)}>Next</button></div>;
}
function PostCard({ post, userId, onChanged, initiallyOpen }: { post: Post; userId: string; onChanged: () => Promise<void>; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen), [editing, setEditing] = useState(false), [draft, setDraft] = useState(post.body);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const guard = useRef(false);
  async function action(work: () => Promise<unknown>) { if (guard.current) return; guard.current = true; setBusy(true); setError(""); try { await work(); setEditing(false); await onChanged(); } catch (reason) { setError(message(reason)); } finally { guard.current = false; setBusy(false); } }
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="space-y-4 p-5 sm:p-6"><div className="flex items-start gap-3"><ProfileAvatar person={post.author} /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{profileName(post.author)}</h3><p className="text-xs text-slate-600">{post.author.jobTitle || "Administrator"}</p><Stamp value={post.createdAt} />{post.updatedAt !== post.createdAt && <span className="ml-2 text-xs text-slate-600">Edited</span>}</div></div>
      {editing ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void action(() => apiFetch(`${root}/posts/${post.id}`, { method: "PUT", body: JSON.stringify({ body: draft, updatedAt: post.updatedAt }) })); }}><label className="block text-sm font-semibold">Edit update<textarea required maxLength={3000} disabled={busy} className={`${input} mt-2`} value={draft} onChange={event => setDraft(event.target.value)} rows={5} /></label><div className="flex gap-2"><button className={primary} disabled={busy || !draft.trim()}>Save changes</button><button type="button" className={button} disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div></form> : <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800 [overflow-wrap:anywhere]">{post.body}</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button className={button} disabled={busy} aria-pressed={post.reactions.length > 0} onClick={() => void action(() => apiFetch(`${root}/posts/${post.id}/reaction`, { method: "PUT", body: JSON.stringify({ liked: !post.reactions.length }) }))}><ThumbsUp size={16} fill={post.reactions.length ? "currentColor" : "none"} />{post.reactions.length ? "Liked" : "Like"} · {post._count.reactions}</button><button className={button} aria-expanded={open} onClick={() => setOpen(!open)}><MessageCircle size={16} />Replies · {post._count.replies}</button>{post.authorId === userId && <><button className={button} disabled={busy} onClick={() => { setDraft(post.body); setEditing(true); }}>Edit</button><button className={button} disabled={busy} onClick={() => { if (window.confirm("Remove your post and its conversation from the feed?")) void action(() => apiFetch(`${root}/posts/${post.id}`, { method: "DELETE" })); }}>Remove</button></>}</div>
    </div>
    {open && <Replies postId={post.id} userId={userId} onChanged={onChanged} />}
  </article>;
}

function Replies({ postId, userId, onChanged }: { postId: string; userId: string; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<Page<Reply>>({ items: [], hasMore: false }), [page, setPage] = useState(1);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [body, setBody] = useState("");
  const request = useRef<{ id: string; body: string } | null>(null), guard = useRef(false), generation = useRef(0);
  const load = useCallback(async () => { const current = ++generation.current; setLoading(true); setError(""); try { const result = await apiFetch<Page<Reply>>(`${root}/posts/${postId}/replies?page=${page}`); if (current === generation.current) setData(result); } catch (reason) { if (current === generation.current) setError(message(reason)); } finally { if (current === generation.current) setLoading(false); } }, [postId, page]);
  useEffect(() => { const counter = generation; void load(); return () => { counter.current++; }; }, [load]);
  return <section className="space-y-4 border-t border-slate-200 bg-slate-50 p-5 sm:p-6" aria-label="Replies">
    {error && <p role="alert" className="text-sm text-red-800">{error} <button className="underline" onClick={() => void load()}>Reload replies</button></p>}
    {loading ? <p role="status" className="text-sm text-slate-600">Loading replies…</p> : data.items.map(reply => <div key={reply.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><ProfileAvatar person={reply.author} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{profileName(reply.author)}</p><Stamp value={reply.createdAt} /><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 [overflow-wrap:anywhere]">{reply.body}</p>{reply.authorId === userId && <button disabled={busy} className="mt-2 text-xs font-semibold text-slate-600 underline" onClick={async () => { if (guard.current || !window.confirm("Remove your reply?")) return; guard.current = true; setBusy(true); try { await apiFetch(`${root}/posts/${postId}/replies/${reply.id}`, { method: "DELETE" }); await load(); await onChanged(); } catch (reason) { setError(message(reason)); } finally { guard.current = false; setBusy(false); } }}>Remove reply</button>}</div></div></div>)}
    {!loading && !error && !data.items.length && <p className="text-sm text-slate-600">No replies on this page yet. Add to the conversation.</p>}
    {(page > 1 || data.hasMore) && <Pagination page={page} hasMore={data.hasMore} disabled={loading || busy} setPage={setPage} />}
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault(); if (guard.current || !body.trim()) return; guard.current = true; setBusy(true); setError("");
      if (!request.current || request.current.body !== body) request.current = { id: crypto.randomUUID(), body };
      try { await apiFetch(`${root}/posts/${postId}/replies`, { method: "POST", body: JSON.stringify({ body, requestId: request.current.id }) }); setBody(""); request.current = null; await load(); await onChanged(); }
      catch (reason) { setError(message(reason)); } finally { guard.current = false; setBusy(false); }
    }}><label className="block text-sm font-semibold">Your reply<textarea className={`${input} mt-2`} rows={3} maxLength={1200} required disabled={busy} value={body} onChange={event => setBody(event.target.value)} placeholder="Add to the conversation…" /></label><div className="flex items-center justify-between"><span className="text-xs text-slate-600">{body.length}/1,200</span><button className={primary} disabled={busy || !body.trim()}>{busy ? "Saving…" : "Post reply"}</button></div></form>
  </section>;
}

function Directory() {
  const [data, setData] = useState<Page<Member>>({ items: [], hasMore: false }), [search, setSearch] = useState(""), [query, setQuery] = useState(""), [page, setPage] = useState(1), [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(""); apiFetch<Page<Member>>(`${root}/members?page=${page}&search=${encodeURIComponent(query)}`).then(result => { if (active) setData(result); }).catch(reason => { if (active) setError(message(reason)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [page, query, revision]);
  return <section className="space-y-5"><form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="min-w-0 flex-1"><span className="sr-only">Search administrators</span><input type="search" maxLength={100} className={input} placeholder="Search administrators by name or title" value={search} onChange={event => setSearch(event.target.value)} /></label><button className={primary}>Search</button></form>
    {error && <p role="alert" className="text-red-800">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {loading ? <p role="status">Loading administrators…</p> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.items.map(person => <article key={person.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-6"><ProfileAvatar person={person} large /><h2 className="break-words text-lg font-semibold">{profileName(person)}</h2><p className="text-sm font-medium text-teal-800">{person.jobTitle || "Administrator"}</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{person.bio || "This administrator hasn’t added an introduction yet."}</p><dl className="space-y-2 border-t border-slate-100 pt-3 text-sm"><div><dt className="text-xs text-slate-600">Work email</dt><dd className="break-all">{person.email}</dd></div>{person.phone && <div><dt className="text-xs text-slate-600">Phone</dt><dd>{person.phone}</dd></div>}{person.timezone && <div><dt className="text-xs text-slate-600">Timezone</dt><dd>{person.timezone.replaceAll("_", " ")}</dd></div>}</dl></article>)}</div>}
    {!loading && !error && !data.items.length && <p className="rounded-xl border bg-white p-6">No administrators match your search.</p>}
    <Pagination page={page} hasMore={data.hasMore} disabled={loading} setPage={setPage} />
  </section>;
}
