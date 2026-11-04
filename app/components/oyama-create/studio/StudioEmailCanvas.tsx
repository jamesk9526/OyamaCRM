"use client";
/* eslint-disable @next/next/no-img-element -- The editor previews the same public artwork used by email. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import type { BrandDocument, DonorContext, StudioDesign, StudioNode } from "@/server/src/oyama-create/studio/types";
import { emailReviewRequired, sourceIdentity, walkNodes } from "@/server/src/oyama-create/studio/design";
import { applyEmailEditingDocument, customizeEmailBlock, emailEditingDocument, emailOverrideForSelection, relinkEmailBlock, studioNodeId } from "@/server/src/oyama-create/studio/email-document";
import { profileIdentity } from "@/server/src/oyama-create/studio/brand";
import { normalizePublicMediaUrl } from "@/server/src/lib/public-media";
import { renderStudio } from "@/server/src/oyama-create/studio/render";
import StudioEditor, { type StudioEditorContext } from "./StudioEditor";

type Props = {
  design: StudioDesign;
  brand: BrandDocument;
  donor: DonorContext;
  editable: boolean;
  selectedId?: string;
  mobile?: boolean;
  onChange: (design: StudioDesign) => void;
  onReady: (editor: Editor) => void;
  onSelect: (node: StudioNode | null, position: number) => void;
  onInsertRequest?: (node: StudioNode) => void;
};

function blockText(node: StudioNode): string {
  return walkNodes(node).filter(child => child.type === "text").map(child => child.text || "").join(" ").trim();
}

export default function StudioEmailCanvas({ design, brand, donor, editable, selectedId = "", mobile = false, onChange, onReady, onSelect, onInsertRequest }: Props) {
  const document = useMemo(() => emailEditingDocument(design), [design]);
  const [initial] = useState(document);
  const latest = useRef({ design, onChange, onSelect, onReady });
  const retainedSources = useRef(new Map<string, StudioNode>());
  useLayoutEffect(() => {
    latest.current = { design, onChange, onSelect, onReady };
    // Preserve the letter source while Tiptap can undo an email-side block deletion.
    for (const node of walkNodes(design.body)) {
      const id = studioNodeId(node);
      if (id && Object.prototype.hasOwnProperty.call(design.email.overrides, id)) retainedSources.current.set(id, structuredClone(node));
    }
  }, [design, onChange, onSelect, onReady]);
  const context = useMemo<{ current: StudioEditorContext }>(() => ({ current: { design: { ...design, email: { ...design.email, overrides: {} } }, brand, donor, channel: "EMAIL" } }), [design, brand, donor]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selection, setSelection] = useState(selectedId);
  const [reviewed, setReviewed] = useState<{ source: string; ids: string[] }>({ source: "", ids: [] });
  const emitted = useRef("");
  const identity = profileIdentity(brand, "EMAIL", "", design.profileId);
  const overrideId = emailOverrideForSelection(design, selection);
  const sharedNodes = new Map(walkNodes(design.body).map(node => [studioNodeId(node), node]));
  const projection = JSON.stringify(document);
  const currentSource = sourceIdentity(design);
  const ready = useCallback((value: Editor) => { setEditor(value); latest.current.onReady(value); }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed || projection === emitted.current) return;
    if (JSON.stringify(editor.getJSON()) === projection) return;
    const previous = editor.state.selection;
    editor.commands.setContent(JSON.parse(projection) as JSONContent, { emitUpdate: false });
    const maximum = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(previous.from, maximum), to: Math.min(previous.to, maximum) });
  }, [editor, projection]);

  const adaptations = renderStudio(design, donor, brand, { channel: "EMAIL" }).adaptations;
  return <section className="cs-email-design" aria-label="Editable email design">
    <div className="cs-email-edit-status" role="status">
      <strong>{overrideId ? "Customized for Email" : "Shared with Letter and Email"}</strong>
      <span>{overrideId ? "Changes here update the protected email version." : "Changes here update both draft formats."}</span>
      {selection && editable && (overrideId
        ? <button type="button" className="oc-button small" onClick={() => onChange(relinkEmailBlock(design, overrideId))}>Use shared version</button>
        : <button type="button" className="oc-button small" onClick={() => onChange(customizeEmailBlock(design, selection))}>Customize for Email</button>)}
    </div>
    <div className={`cs-email-edit-shell${mobile ? " mobile" : ""}`} style={{ background: String(identity.emailBackgroundColor || "#edf4fc") }}>
      <article className="cs-email-editor" style={{ maxWidth: mobile ? 375 : Number(identity.emailContentWidth) || 640, color: design.styles.color, background: design.styles.background, fontFamily: design.styles.emailFont, fontSize: `${design.styles.fontSize + 1}pt`, lineHeight: design.styles.lineHeight }}>
        <header className="cs-email-brand-header" contentEditable={false}>
          {identity.globalHeaderHtml ? <div dangerouslySetInnerHTML={{ __html: String(identity.globalHeaderHtml) }}/>
            : <>{identity.logoUrl && <img src={normalizePublicMediaUrl(String(identity.logoUrl))} alt={String(identity.organizationDisplayName || "Organization logo")} style={{ maxWidth: 160, height: "auto", display: "block", marginBottom: 8 }}/>}<strong>{String(identity.organizationDisplayName || "")}</strong></>}
        </header>
        <div className="cs-email-writing">
          <StudioEditor initial={initial} context={context} editable={editable} onReady={ready} onInsertRequest={onInsertRequest} onSelect={(node, position) => { const id = node ? studioNodeId(node) : "";  setSelection(id); latest.current.onSelect(node, position); }} onChange={doc => {
            emitted.current = JSON.stringify(doc);
            latest.current.onChange(applyEmailEditingDocument(latest.current.design, doc, retainedSources.current));
          }}/>
        </div>
        <footer className="cs-email-brand-footer" contentEditable={false}>
          {identity.globalFooterHtml ? <div dangerouslySetInnerHTML={{ __html: String(identity.globalFooterHtml) }}/> : <p>{String(identity.footerLegalText || identity.organizationDisplayName || "")}</p>}
          <p>{[identity.streetAddress1, identity.streetAddress2, identity.city, identity.stateProvince, identity.postalCode, identity.country].filter(Boolean).join(", ")}</p>
          <p>Unsubscribe · Email preferences</p>
        </footer>
      </article>
    </div>
    {adaptations.length > 0 && <details className="cs-email-adaptations"><summary>Letter-to-email adaptations</summary>{adaptations.map((item, index) => <p className="oc-help" key={`${item.nodeId}-${index}`}>{item.message}</p>)}</details>}
    {Object.keys(design.email.overrides).length > 0 && <details className="cs-email-comparison" open={emailReviewRequired(design)}>
      <summary>{emailReviewRequired(design) ? "Review shared changes and protected email versions" : "Protected email versions"}</summary>
      {Object.entries(design.email.overrides).map(([id, customized]) => {
        const shared = sharedNodes.get(id);
        return <section className="oc-card cs-email-compare-block" key={id}>
          <strong>{shared ? "Linked block with an email customization" : "Shared block removed — email customization retained"}</strong>
          <div className="oc-grid-two"><div><h4>Current shared version</h4><p>{shared ? blockText(shared) || shared.type : "The shared block has been removed."}</p></div><div><h4>Protected email version</h4><p>{blockText(customized) || customized.type}</p></div></div>
          {editable && <div className="oc-actions">
            <button type="button" className="oc-button small" onClick={() => {
              const ids = [...new Set([...(reviewed.source === currentSource ? reviewed.ids : []), id])];
              setReviewed({ source: currentSource, ids });
              if (Object.keys(design.email.overrides).every(key => ids.includes(key))) onChange({ ...design, email: { ...design.email, reviewedSource: currentSource } });
            }}>{reviewed.source === currentSource && reviewed.ids.includes(id) ? "Email version reviewed" : "Keep email version"}</button>
            {shared ? <button type="button" className="oc-button small" onClick={() => onChange(relinkEmailBlock(design, id))}>Use shared version</button>
              : <><button type="button" className="oc-button small" onClick={() => onChange({ ...design, body: { ...design.body, content: [...design.body.content, structuredClone(customized)] } })}>Restore block to shared document</button><button type="button" className="oc-button small" onClick={() => { if (window.confirm("Discard this retained email customization? Saved revisions remain in History.")) onChange(relinkEmailBlock(design, id)); }}>Discard reviewed customization</button></>}
          </div>}
        </section>;
      })}
    </details>}
  </section>;
}
