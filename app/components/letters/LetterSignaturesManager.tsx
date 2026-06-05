/** Signature block management UI for reusable signer presets with handwritten image uploads. */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { SignatureBlock } from "@/app/components/letters/types";

interface SignatureForm {
  name: string;
  signerName: string;
  signerTitle: string;
  closingPhrase: string;
  signatureImageUrl: string;
  typedSignature: string;
  email: string;
  phone: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY_FORM: SignatureForm = {
  name: "",
  signerName: "",
  signerTitle: "",
  closingPhrase: "With gratitude,",
  signatureImageUrl: "",
  typedSignature: "",
  email: "",
  phone: "",
  isDefault: false,
  isActive: true,
};

/** Manages create/edit for signature presets used by printable letter templates. */
export default function LetterSignaturesManager() {
  const [items, setItems] = useState<SignatureBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<SignatureForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [signatureInputMode, setSignatureInputMode] = useState<"draw" | "upload">("draw");
  const [drawHasInk, setDrawHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<SignatureBlock[]>("/api/letters/signatures");
      setItems(result);
      if (!selectedId && result.length > 0) setSelectedId(result[0].id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load signatures.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setForm(EMPTY_FORM);
      setDrawHasInk(false);
      return;
    }
    setForm({
      name: selected.name,
      signerName: selected.signerName,
      signerTitle: selected.signerTitle ?? "",
      closingPhrase: selected.closingPhrase ?? "",
      signatureImageUrl: selected.signatureImageUrl ?? "",
      typedSignature: selected.typedSignature ?? "",
      email: selected.email ?? "",
      phone: selected.phone ?? "",
      isDefault: selected.isDefault,
      isActive: selected.isActive,
    });
    setDrawHasInk(false);
  }, [selected]);

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = 560;
    const logicalHeight = 160;
    canvas.width = Math.floor(logicalWidth * ratio);
    canvas.height = Math.floor(logicalHeight * ratio);
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(ratio, ratio);
    context.clearRect(0, 0, logicalWidth, logicalHeight);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.strokeStyle = "#111827";
    drawingRef.current = false;
    lastDrawPointRef.current = null;
  }, [selectedId]);

  function startNew() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setDrawHasInk(false);
    setMessage(null);
    setError(null);
    setEditorOpen(true);
  }

  function pointerToCanvas(event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function clearDrawCanvas() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setDrawHasInk(false);
    drawingRef.current = false;
    lastDrawPointRef.current = null;
  }

  function beginDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext("2d");
    const point = pointerToCanvas(event);
    if (!canvas || !context || !point) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastDrawPointRef.current = point;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();
    setDrawHasInk(true);
  }

  function moveDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext("2d");
    const point = pointerToCanvas(event);
    if (!canvas || !context || !point) return;

    event.preventDefault();
    const previous = lastDrawPointRef.current ?? point;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastDrawPointRef.current = point;
    setDrawHasInk(true);
  }

  function endDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = drawCanvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
    lastDrawPointRef.current = null;
  }

  function useDrawnSignature() {
    if (!drawHasInk) {
      setError("Draw a signature before applying it.");
      return;
    }

    const canvas = drawCanvasRef.current;
    if (!canvas) {
      setError("Signature canvas is not ready.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    setForm((prev) => ({ ...prev, signatureImageUrl: dataUrl }));
    setMessage("Drawn signature applied. Save the preset to upload and store it.");
    setError(null);
  }

  async function uploadSignatureDataUrl(dataBase64: string, fileName: string, mimeType: string): Promise<string> {
    const uploaded = await apiFetch<{ url: string }>("/api/letters/media", {
      method: "POST",
      body: JSON.stringify({
        fileName,
        mimeType,
        dataBase64,
        purpose: "signature",
      }),
    });
    return uploaded.url;
  }

  function mimeTypeFromDataUrl(dataUrl: string): string {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(dataUrl);
    return match?.[1] ?? "image/png";
  }

  function extensionFromMimeType(mimeType: string): string {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("svg")) return "svg";
    return "png";
  }

  async function saveSignature() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let signatureImageUrl = form.signatureImageUrl || null;
      if (signatureImageUrl?.startsWith("data:image/")) {
        setUploading(true);
        const mimeType = mimeTypeFromDataUrl(signatureImageUrl);
        const extension = extensionFromMimeType(mimeType);
        signatureImageUrl = await uploadSignatureDataUrl(signatureImageUrl, `drawn-signature-${Date.now()}.${extension}`, mimeType);
        setForm((prev) => ({ ...prev, signatureImageUrl: signatureImageUrl ?? "" }));
      }

      const payload = {
        ...form,
        signerTitle: form.signerTitle || null,
        closingPhrase: form.closingPhrase || null,
        signatureImageUrl,
        typedSignature: form.typedSignature || null,
        email: form.email || null,
        phone: form.phone || null,
      };

      const saved = selectedId
        ? await apiFetch<SignatureBlock>(`/api/letters/signatures/${selectedId}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiFetch<SignatureBlock>("/api/letters/signatures", { method: "POST", body: JSON.stringify(payload) });

      setSelectedId(saved.id);
      await load();
      setMessage("Signature preset saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save signature.");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  /** Uploads a scanned/photographed handwritten signature and stores its public URL on the preset. */
  async function uploadSignature(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dataBase64 = await readFileAsDataUrl(file);
      const uploadedUrl = await uploadSignatureDataUrl(dataBase64, file.name, file.type || "image/png");
      setForm((prev) => ({ ...prev, signatureImageUrl: uploadedUrl }));
      setMessage("Signature image uploaded. Save the preset to keep it.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to upload signature image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="pt-2">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Saved Signatures</h2>
          <button type="button" onClick={startNew} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">New</button>
        </div>
        <div className="space-y-2">
          {loading ? <p className="text-sm text-gray-500">Loading...</p> : items.length === 0 ? <p className="text-sm text-gray-500">No signatures yet.</p> : items.map((item) => (
            <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setEditorOpen(true); }} className={`grid w-full gap-3 rounded-lg border px-3 py-3 text-left sm:grid-cols-[minmax(0,1fr)_220px] ${selectedId === item.id ? "border-green-300 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <span>
                <span className="block truncate text-sm font-semibold text-gray-900">{item.name}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{item.signerName}{item.signerTitle ? ` · ${item.signerTitle}` : ""}</span>
                <span className="mt-0.5 block text-xs text-gray-400">{item.isDefault ? "Default" : "Custom"} · {item.isActive ? "Active" : "Inactive"}</span>
              </span>
              <span className="flex min-h-16 items-center justify-center rounded border border-gray-200 bg-white px-3">
                {item.signatureImageUrl ? <img src={item.signatureImageUrl} alt={`${item.signerName} signature`} className="max-h-14 max-w-full object-contain" /> : <span className="font-serif text-xl text-gray-800">{item.typedSignature || item.signerName}</span>}
              </span>
            </button>
          ))}
        </div>
      </section>

      {editorOpen ? (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-8">
        <button type="button" aria-label="Close signature builder" className="fixed inset-0 bg-slate-950/60" onClick={() => setEditorOpen(false)} />
      <section className="relative z-10 w-full max-w-6xl rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{selected ? "Edit Signature Visual Builder" : "New Signature Visual Builder"}</h2>
            <p className="text-xs text-gray-500">Draw or upload a signature, then review exactly how the reusable block will appear.</p>
          </div>
          <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Close</button>
        </div>
        {error && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
        {message && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">{selected ? "Edit Signature" : "New Signature"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Preset Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
              <Field label="Signer Name"><input value={form.signerName} onChange={(event) => setForm({ ...form, signerName: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
              <Field label="Signer Title"><input value={form.signerTitle} onChange={(event) => setForm({ ...form, signerTitle: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
              <Field label="Closing Phrase"><input value={form.closingPhrase} onChange={(event) => setForm({ ...form, closingPhrase: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
              <Field label="Email"><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
              <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
            </div>
            <Field label="Typed Signature Fallback">
              <input value={form.typedSignature} onChange={(event) => setForm({ ...form, typedSignature: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Jane A. Smith" />
            </Field>
            <Field label="Handwritten Signature">
              <div className="space-y-2">
                <div className="inline-flex rounded-lg border border-gray-300 p-1 text-xs font-semibold">
                  <button type="button" onClick={() => setSignatureInputMode("draw")} className={`rounded px-3 py-1.5 ${signatureInputMode === "draw" ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}>Draw</button>
                  <button type="button" onClick={() => setSignatureInputMode("upload")} className={`rounded px-3 py-1.5 ${signatureInputMode === "upload" ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}>Upload</button>
                </div>

                {signatureInputMode === "draw" ? (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
                      <canvas
                        ref={drawCanvasRef}
                        onPointerDown={beginDraw}
                        onPointerMove={moveDraw}
                        onPointerUp={endDraw}
                        onPointerCancel={endDraw}
                        className="block h-40 w-full touch-none cursor-crosshair"
                        aria-label="Draw signature canvas"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={clearDrawCanvas} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Clear</button>
                      <button type="button" onClick={useDrawnSignature} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Use Drawing</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input value={form.signatureImageUrl} onChange={(event) => setForm({ ...form, signatureImageUrl: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="/uploads/letter-media/..." />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">{uploading ? "Uploading..." : "Upload"}</button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadSignature(event.target.files?.[0])} />
                  </div>
                )}

                <p className="text-xs text-gray-500">Use a PNG, JPG, or WEBP image. Transparent PNG files usually produce the cleanest generated PDF.</p>
              </div>
            </Field>
            <div className="flex flex-wrap gap-3">
              <Toggle label="Default" checked={form.isDefault} onChange={(value) => setForm({ ...form, isDefault: value })} />
              <Toggle label="Active" checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} />
            </div>
            <p className="text-xs text-gray-500">When marked Default, this signature is synced into Donor CRM branding settings.</p>
            <button type="button" onClick={() => void saveSignature()} disabled={saving || !form.name.trim() || !form.signerName.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{saving ? "Saving..." : "Save Signature"}</button>
          </div>

          <SignaturePreview form={form} />
        </div>
      </section>
      </div>
      ) : null}
    </div>
  );
}

function SignaturePreview({ form }: { form: SignatureForm }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rendered Preview</p>
      <div className="mt-3 rounded border border-gray-300 bg-white p-6 text-sm text-gray-800 shadow-sm">
        {form.closingPhrase && <p>{form.closingPhrase}</p>}
        {form.signatureImageUrl ? (
          <img src={form.signatureImageUrl} alt="" className="mt-4 max-h-20 max-w-56 object-contain" />
        ) : (
          <p className="mt-4 font-serif text-2xl text-gray-900">{form.typedSignature || form.signerName || "Signature"}</p>
        )}
        <p className="mt-4 font-semibold">{form.signerName || "Signer Name"}</p>
        {form.signerTitle && <p className="text-gray-500">{form.signerTitle}</p>}
        {[form.email, form.phone].filter(Boolean).length > 0 && <p className="mt-1 text-xs text-gray-500">{[form.email, form.phone].filter(Boolean).join(" | ")}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-600">{label}<div className="mt-1">{children}</div></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600" />
      {label}
    </label>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read signature image."));
    reader.readAsDataURL(file);
  });
}
