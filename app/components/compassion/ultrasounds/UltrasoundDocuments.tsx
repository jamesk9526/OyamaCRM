"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiFetch } from "@/app/lib/auth-client";
import { CareCard, CareEmpty, CareError, careWrite, downloadCareFile, useCareData } from "../care-ui";
import type { UltrasoundDocument } from "./types";

interface CareFile { name: string; mimeType: string; base64: string }
export default function UltrasoundDocuments({ clientId, chartId, editable, busy, run, onChanged }: { clientId: string; chartId: string; editable: boolean; busy: boolean; run: (work: () => Promise<void>) => Promise<void>; onChanged: () => Promise<void> }) {
  const documents = useCareData<UltrasoundDocument[]>(`/api/compassion/documents?clientId=${encodeURIComponent(clientId)}`);
  const [preview, setPreview] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const files = documents.data?.filter((file) => file.chartId === chartId) ?? [];
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function upload(file: File) {
    await run(async () => {
      if (file.size > 10000000) throw new Error("Choose a scan or report up to 10 MB.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("The selected file could not be read.")); reader.readAsDataURL(file);
      });
      await careWrite("/documents", { clientId, chartId, name: file.name, mimeType: file.type, base64 });
      await documents.reload(); await onChanged();
    });
  }
  return <CareCard title="Scans & supporting files" description="Protected images, PDF reports, and MP4 clips · up to 10 MB each">
    <CareError error={documents.error} />
    {editable && <div className="care-card-body care-form"><label>Attach scan or report<input type="file" accept="image/jpeg,image/png,application/pdf,video/mp4" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /></label></div>}
    {documents.loading ? <CareEmpty title="Loading supporting files…" /> : documents.error ? <CareEmpty title="Files are unavailable"><button className="care-button secondary" onClick={() => void documents.reload()}>Try again</button></CareEmpty> : files.length ? files.map((file) => <div className="care-row" key={file.id}><div className="care-row-main"><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB · {file.mimeType}</small></div><div className="care-actions">
      <button className="care-button secondary" disabled={busy} onClick={() => void run(async () => {
        const value = await apiFetch<CareFile>(`/api/compassion/documents/${file.id}/download`);
        const bytes = Uint8Array.from(atob(value.base64), (character) => character.charCodeAt(0));
        setPreview({ url: URL.createObjectURL(new Blob([bytes], { type: value.mimeType })), name: value.name, mimeType: value.mimeType });
      })}>Preview</button>
      <button className="care-button secondary" disabled={busy} onClick={() => void run(async () => downloadCareFile(await apiFetch<CareFile>(`/api/compassion/documents/${file.id}/download`)))}>Download</button>
      {editable && <button className="care-button secondary" disabled={busy} onClick={() => { if (window.confirm(`Remove ${file.name} from this draft?`)) void run(async () => { await careWrite(`/documents/${file.id}`, { deleted: true }, "PATCH"); await documents.reload(); await onChanged(); }); }}>Remove</button>}
    </div></div>) : <CareEmpty title="No supporting scans yet">Attach at least one scan or report before submitting this exam for review.</CareEmpty>}
    {preview && <div className="care-card-body care-scan-preview"><div className="care-actions"><strong>{preview.name}</strong><button className="care-button secondary" onClick={() => setPreview(null)}>Close preview</button></div>{preview.mimeType.startsWith("image/") ? <Image src={preview.url} alt={preview.name} width={800} height={600} unoptimized /> : preview.mimeType === "video/mp4" ? <video src={preview.url} controls aria-label={preview.name} /> : <iframe src={preview.url} title={`Preview ${preview.name}`} />}</div>}
  </CareCard>;
}
