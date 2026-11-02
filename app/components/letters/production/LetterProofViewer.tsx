"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | undefined;
function loadPdfJs() {
  const url = "/vendor/pdfjs/pdf.mjs";
  return pdfJsPromise ??= import(/* webpackIgnore: true */ url).catch(error => { pdfJsPromise = undefined; throw error; });
}

function PdfPage({ document, page, width, text = false }: { document: PDFDocumentProxy; page: number; width: number; text?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const textContainer = layer.current;
    let disposed = false; let task: RenderTask | undefined; let cancelText: (() => void) | undefined;
    void (async () => {
      const pdfPage = await document.getPage(page);
      if (disposed || !canvas.current) return;
      const viewport = pdfPage.getViewport({ scale: width / pdfPage.getViewport({ scale: 1 }).width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.current.width = viewport.width * ratio; canvas.current.height = viewport.height * ratio;
      canvas.current.style.width = `${viewport.width}px`; canvas.current.style.height = `${viewport.height}px`;
      task = pdfPage.render({ canvas: canvas.current, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      if (text && layer.current && !disposed) {
        const { TextLayer } = await loadPdfJs();
        if (disposed || !layer.current) return;
        layer.current.replaceChildren();
        layer.current.style.setProperty("--scale-factor", String(viewport.scale));
        layer.current.style.setProperty("--total-scale-factor", String(viewport.scale));
        const textLayer = new TextLayer({ textContentSource: await pdfPage.getTextContent(), container: layer.current, viewport });
        cancelText = () => textLayer.cancel(); await textLayer.render();
      }
    })().catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : "Page could not be displayed."); });
    return () => { disposed = true; task?.cancel(); cancelText?.(); textContainer?.replaceChildren(); };
  }, [document, page, width, text]);
  return <div className="relative mx-auto w-fit bg-white shadow-sm"><canvas ref={canvas} role="img" aria-label={`PDF page ${page}`} />{text ? <div ref={layer} className="textLayer" /> : null}{error ? <p role="alert" className="p-3 text-xs text-red-700">{error}</p> : null}</div>;
}

export default function LetterProofViewer({ url, stale, busy, label }: { url: string | null; stale: boolean; busy: boolean; label: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1); const [zoom, setZoom] = useState(100); const [width, setWidth] = useState(480); const [error, setError] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width - 24)));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!url) return;
    let disposed = false; let destroy: (() => void) | undefined;
    void (async () => {
      const pdfjs = await loadPdfJs();
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";
      const task = pdfjs.getDocument({ url, isEvalSupported: false }); destroy = () => { void task.destroy(); };
      const loaded = await task.promise;
      if (disposed) { await loaded.destroy(); return; }
      setDocument(loaded); setPage(1); setError("");
    })().catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : "PDF viewer could not load."); });
    return () => { disposed = true; destroy?.(); };
  }, [url]);
  const controls = "min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold disabled:opacity-40";
  return <section aria-label="Exact PDF proof" className="flex min-w-0 flex-col rounded-lg border border-blue-200 bg-slate-100">
    <div className="space-y-2 border-b border-slate-200 bg-white p-3"><h2 className="font-semibold text-slate-900">Print proof</h2><p className="text-xs text-slate-600">{label}</p>
      <p role="status" className={`text-xs font-semibold ${stale ? "text-amber-800" : "text-blue-800"}`}>{busy ? "Rendering updated proof…" : stale ? "Out of date · latest edits are not shown" : document ? `${document.numPages} PDF ${document.numPages === 1 ? "page" : "pages"} · current proof` : "No proof rendered"}</p>
      {document ? <div className="flex flex-wrap items-center gap-2"><button className={controls} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous page</button><span className="text-xs">{page} / {document.numPages}</span><button className={controls} disabled={page >= document.numPages} onClick={() => setPage(p => p + 1)}>Next page</button><select aria-label="Proof zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))} className={controls}><option value="100">Fit width</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></div> : null}
    </div>
    {document ? <nav aria-label="PDF page thumbnails" className="flex gap-2 overflow-x-auto border-b border-slate-200 p-2">{Array.from({ length: document.numPages }, (_, i) => <button type="button" key={i} aria-label={`Go to page ${i + 1}`} aria-current={page === i + 1 ? "page" : undefined} onClick={() => setPage(i + 1)} className={`shrink-0 rounded border p-1 text-xs ${page === i + 1 ? "border-blue-600 bg-blue-100" : "border-slate-300 bg-white"}`}>{Math.abs(i + 1 - page) < 3 ? <PdfPage document={document} page={i + 1} width={58} /> : null}<span>Page {i + 1}</span></button>)}</nav> : null}
    <div ref={viewport} className="min-h-[400px] flex-1 overflow-auto p-3 lg:max-h-[78dvh]">{error ? <p role="alert" className="text-sm text-red-700">{error} {url ? <a href={url} target="_blank" rel="noreferrer" className="underline">Open original PDF</a> : null}</p> : document ? <PdfPage document={document} page={page} width={width * zoom / 100} text /> : <p className="p-4 text-sm text-slate-600">Save the letter and render a proof. The PDF shows actual pagination, margins, branding, and signature placement.</p>}</div>
  </section>;
}
