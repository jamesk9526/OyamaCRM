"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { TemplateBuilder, type CreateLetterSurface } from "../letters/OyamaLettersWorkspace";
import { defaultDesign } from "@/server/src/oyama-create/studio/design";
import { useCreateData } from "./use-create-data";
import { useDraftGuard } from "./use-draft-guard";
import WorkspaceFrame from "./v5/WorkspaceFrame";
import ContentNotes from "./v5/ContentNotes";
import SourceComparison from "./v5/SourceComparison";
import ContentImportNotice from "./ContentImportNotice";
import OriginalSourceNames from "./OriginalSourceNames";
import LetterConversionDialog from "./LetterConversionDialog";
import ChannelEditor from "./ChannelEditor";
import { Modal } from "./ui";
import { channelNames, type Campaign, type Channel, type Content } from "./types";
import type { EditorHandle } from "./SharedEditor";

type Props = {
  campaign: Campaign; content: Content; active: boolean; readonly: boolean; notesReadonly?: boolean; convertChannel?: Exclude<Channel, "LETTER">;
  onSaved: () => Promise<unknown>; onDirty: (dirty: boolean) => void; onReview: () => void; onAudience: () => void;
  onChannel: (channel: Channel) => void; onSelectContent: (id: string) => void; onAddContent: () => void; onCampaignSettings: () => void;
  closeConversion: () => void;
};
type Revision = { id: string; revision: number; createdAt: string; documentJson: { classicLetter?: { template?: { printBody?: string } }; originalLetter?: { html: string } } };

export default forwardRef<EditorHandle, Props>(function ClassicLetterWorkspace(props, ref) {
  const { user } = useAuth();
  const router = useRouter();
  const [panel, setPanel] = useState<"html" | "source" | "history" | "convert" | "settings" | null>(null);
  const [epoch, setEpoch] = useState(0), [html, setHtml] = useState("");
  const [letterDirty, setLetterDirty] = useState(false), [notesDirty, setNotesDirty] = useState(false), [settingsDirty, setSettingsDirty] = useState(false);
  const notesRef = useRef<EditorHandle>(null), settingsRef = useRef<EditorHandle>(null), surfaceRef = useRef<CreateLetterSurface>(null);
  const history = useCreateData<Revision[]>(panel === "history" ? `/api/oyama-create/contents/${props.content.id}/revisions` : null);
  const dirty = letterDirty || notesDirty || settingsDirty;
  useEffect(() => props.onDirty(dirty), [dirty, props.onDirty]);
  useDraftGuard(dirty);
  const flush = useCallback(async () => (!surfaceRef.current || await surfaceRef.current.flush())
    && (!notesRef.current || await notesRef.current.flush()) && (!settingsRef.current || await settingsRef.current.flush()), []);
  useImperativeHandle(ref, () => ({ flush }), [flush]);
  const letter = props.content.variants.find(item => item.channel === "LETTER")!;
  const formats = props.campaign.channelsJson.filter(channel => props.content.variants.some(variant => variant.channel === channel));
  const recoveryKey = `create:classic-letter:${user?.organizationId || ""}:${user?.id || ""}:${props.content.id}`;

  function render(surface: CreateLetterSurface) {
    const design = props.content.designJson || defaultDesign();
    const action = async (id: string) => {
      if (id === "preview" || id === "proof") surface.preview(id === "proof");
      if (id === "review" && (props.readonly || await surface.save()) && await flush()) props.onReview();
      if (id === "html") { setHtml(surface.html); setPanel("html"); }
      if (id === "history") setPanel("history");
      if (id === "channel-settings" && await flush()) setPanel("settings");
      if (id === "compare-source" && await flush()) setPanel("source");
      if (id === "convert" && await surface.save() && await flush()) setPanel("convert");
      if (id === "campaign" && await flush()) props.onAudience();
      if (id === "brand" && await flush()) router.push("/oyama-create/library/brand");
    };
    return <WorkspaceFrame
      active={props.active} campaign={props.campaign} content={props.content} formats={formats}
      editor={null} design={{ ...design, page: surface.page }} readonly={props.readonly}
      activeChannel="LETTER" classic={surface} saveState={surface.saving ? "Working…" : dirty ? "Unsaved changes" : surface.saved ? "Saved in Create" : "Ready to edit"}
      busy={surface.saving} pages={surface.pages} zoom={surface.zoom} onZoom={surface.setZoom} onChange={() => {}}
      onSave={async () => (props.readonly || await surface.save()) && await flush()} onAction={id => void action(id)}
      onChannel={props.onChannel} onInsert={type => { if (type === "letterPageBreak") surface.newPage(); }}
      onSelectContent={props.onSelectContent} onAddContent={props.onAddContent} onCampaignSettings={props.onCampaignSettings}
      library={surface.blocks} pageInspector={surface.pageInspector} blockInspector={surface.blockInspector}
      notes={<ContentNotes ref={notesRef} contentId={props.content.id} readonly={props.notesReadonly ?? props.readonly} onDirty={setNotesDirty}/>}
      alerts={<>{surface.alerts}<ContentImportNotice contentId={props.content.id} onChanged={async () => { await props.onSaved(); if (!letterDirty) setEpoch(value => value + 1); }}/></>}
      issues={[]} customized={false} recipientControls={surface.recipientControls}
      pieceControls={<div className="v5-command-stack">
        <button onClick={() => void action("convert")} disabled={props.readonly}>Convert to Email, Web, Social or SMS</button>
        {props.content.variants.filter(item => item.letterUpdateAvailable).map(item => <button key={item.id} onClick={() => props.onChannel(item.channel)}>
          {channelNames[item.channel]} has a Letter update
        </button>)}
        <button onClick={() => void action("campaign")}>Campaign workflow</button>
        <Link href="/oyama-create/library/brand">Brand Hub</Link>
        <details><summary>Original names</summary><OriginalSourceNames contentId={props.content.id}/></details>
      </div>}
      dialogs={<>
        {surface.dialogs}
        {panel === "source" && <SourceComparison contentId={props.content.id} close={() => setPanel(null)} changed={async () => {
          await props.onSaved(); setPanel(null); setEpoch(value => value + 1);
        }}/>}
        {panel === "history" && <Modal title="Letter revision history" close={() => setPanel(null)}>
          {history.error && <p role="alert" className="oc-error">{history.error}</p>}
          {history.loading && <p role="status">Loading revisions…</p>}
          {history.data?.map(item => <div key={item.id} className="oc-list-item"><strong>Revision {item.revision}</strong><span>{new Date(item.createdAt).toLocaleString()}</span>
            {item.documentJson.classicLetter?.template?.printBody !== undefined && !props.readonly && <button className="oc-button small" onClick={() => {
              surface.applyHtml(item.documentJson.classicLetter!.template!.printBody || ""); setPanel(null);
            }}>Use this body in draft</button>}
          </div>)}
        </Modal>}
        {panel === "html" && <Modal title="Letter body HTML" wide close={() => setPanel(null)}><div className="oc-form">
          <label>Body HTML<textarea rows={18} readOnly={props.readonly} value={html} onChange={event => setHtml(event.target.value)}/></label>
          <button className="oc-button primary" disabled={props.readonly} onClick={() => { surface.applyHtml(html); setPanel(null); }}>Apply to canvas</button>
        </div></Modal>}
        {panel === "settings" && <Modal title="Letter format settings" close={() => void (async () => { if (await flush()) setPanel(null); })()}>
          <ChannelEditor ref={settingsRef} content={{ ...props.content, classicLetter: true }} variant={letter} campaign={props.campaign} readonly={props.readonly} onDirty={setSettingsDirty} onSaved={props.onSaved}/>
        </Modal>}
        {(panel === "convert" || props.convertChannel) && <LetterConversionDialog content={props.content} initial={props.convertChannel}
          close={() => { setPanel(null); props.closeConversion(); }} applied={async (channel, open) => {
            await props.onSaved(); setPanel(null); props.closeConversion(); if (open) props.onChannel(channel);
          }}/>}
      </>}
    >{surface.canvas}</WorkspaceFrame>;
  }

  return <TemplateBuilder key={epoch} onEditorState={state => setLetterDirty(state.dirty)} create={{
    contentId: props.content.id, recoveryKey, revision: props.content.revision, campaignRevision: props.campaign.revision,
    active: props.active, readonly: props.readonly, onSaved: props.onSaved, surfaceRef, render,
  }}/>;
});
