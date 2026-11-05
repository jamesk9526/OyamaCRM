"use client";
import { useEffect, useState, type FormEvent, type CSSProperties } from "react";
import type { SharedDocument, VariantDocument } from "./types";
import { message } from "./types";
import { effectiveBlocks } from "@/server/src/oyama-create/domain";
import "./oyama-create.css";
type PublicPage = { renderVersion?:number; html?:string; id: string; name: string; document: SharedDocument; format: VariantDocument; publishedAt: string; branding?:Record<string,string|number|boolean>|null };
function PublicImage({ src, alt }: { src: string; alt: string }) {
  // Native images preserve the dimensions of reviewed public campaign assets.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy"/>;
}
export default function PublicCampaign({ slug }: { slug: string }) {
  const [page, setPage] = useState<PublicPage | null>(null), [error, setError] = useState("");
  const [formError, setFormError] = useState(""), [submitted, setSubmitted] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/oyama-create/public/pages/${encodeURIComponent(slug)}`, { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Campaign page unavailable.");
      setPage(result);
    }).catch(error => { if (!controller.signal.aborted) setError(message(error)); });
    return () => controller.abort();
  }, [slug]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setFormError("");
    try {
      const response = await fetch(`/api/oyama-create/public/pages/${encodeURIComponent(slug)}/submissions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), message: data.get("message"), consent: data.get("consent") === "yes", website: data.get("website") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Your response could not be submitted.");
      setSubmitted(true);
    } catch (error) { setFormError(message(error)); } finally { setBusy(false); }
  }
  function attributedDestination() {
    if (!page?.format.ctaUrl) return "";
    const url = new URL(page.format.ctaUrl);
    if (url.origin === window.location.origin && url.pathname.startsWith("/give/")) url.searchParams.set("createPublication", page.id);
    return url.toString();
  }
  const safeColor=(value:unknown,fallback:string)=>/^#[a-f0-9]{6}$/i.test(String(value))?String(value):fallback;
  return <main className="oc-public-page" style={{"--oc-blue":safeColor(page?.branding?.primaryColor,"#245ec7"),background:safeColor(page?.branding?.backgroundColor,"#eef4fc"),color:safeColor(page?.branding?.textColor,"#213650"),fontFamily:page?.branding?.emailFontFamily?String(page.branding.emailFontFamily):undefined} as CSSProperties}><article className="oc-public-content">
    {error ? <><h1>Campaign page unavailable</h1><p role="alert">{error}</p></> : !page ? <p role="status">Loading campaign…</p> : <>
      {page.branding?.logoUrl&&<div style={{maxWidth:180,marginBottom:20}}><PublicImage src={String(page.branding.logoUrl)} alt={String(page.branding.organizationDisplayName||"Organization")}/></div>}
      {page.branding?.organizationDisplayName&&<p>{String(page.branding.organizationDisplayName)}</p>}<h1>{page.format.subject || page.name}</h1>
      {page.renderVersion===2?<div dangerouslySetInnerHTML={{__html:page.html||""}}/>:effectiveBlocks(page.document, page.format).map(block => {
        if (block.kind === "heading") return <h2 key={block.id}>{block.text}</h2>;
        if (block.kind === "image" && block.url) return <figure key={block.id}><PublicImage src={block.url} alt={block.text}/></figure>;
        if (block.kind === "link" && block.url) return <p key={block.id}><a href={block.url}>{block.text}</a></p>;
        return <p key={block.id}>{block.text}</p>;
      })}
      {page.format.ctaUrl && <p><a className="oc-public-cta" href={attributedDestination()}>{page.format.ctaLabel || "Learn more"}</a></p>}
      {page.format.formEnabled && (submitted ? <p role="status">Thank you. Your response has been received for staff review.</p> : <form onSubmit={event => void submit(event)}>
        <h2>Get in touch</h2>
        <label>Name<input name="name" required maxLength={200} autoComplete="name"/></label>
        <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
        <label>Message<textarea name="message" rows={4} maxLength={5000}/></label>
        <label className="oc-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><input type="checkbox" name="consent" value="yes" required style={{ marginTop: 3 }}/>{page.format.consentText}</label>
        {formError && <p role="alert">{formError}</p>}
        <button disabled={busy}>{busy ? "Sending…" : "Submit response"}</button>
      </form>)}
    </>}
  </article></main>;
}
