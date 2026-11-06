"use client";
import { useState } from "react";
import { defaultAppearance, type Appearance } from "@/server/src/surveys/definition";
export default function SurveyAppearance({ value, onChange, disabled, organizationLogo, uploadLogo }: { value?: Appearance; onChange: (value: Appearance) => void; disabled: boolean; organizationLogo: () => Promise<string>; uploadLogo: (image: string) => Promise<string> }) {
  const theme = value ?? defaultAppearance;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const change = (patch: Partial<Appearance>) => onChange({ ...theme, ...patch });
  return <section className="survey-card survey-stack" aria-label="Survey appearance"><h2>Look & logo</h2>
    <p className="survey-caption">Your logo and colors appear on the survey and its invitation email. Publish changes to update the shared survey.</p>
    <fieldset disabled={disabled || loading} className="survey-stack">
      <label className="survey-field">Upload survey logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async event => {
        const file = event.currentTarget.files?.[0]; if (!file) return;
        setError("");
        if (file.size > 200000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP image up to 200 KB."); return; }
        setLoading(true);
        try {
          const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("The image could not be read.")); reader.readAsDataURL(file); });
          change({ logoUrl: await uploadLogo(image) });
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Logo upload failed."); } finally { setLoading(false); }
      }} /><span className="survey-caption">PNG, JPEG or WebP · up to 200 KB. Stored with this survey revision.</span></label>
      <div className="survey-row"><button type="button" className="survey-btn" onClick={async () => { setLoading(true); setError(""); try { const logoUrl = await organizationLogo(); if (!logoUrl) throw new Error("Add your organization logo in Settings → Branding, or upload one here."); change({ logoUrl }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Logo could not be loaded."); } finally { setLoading(false); } }}>Use organization logo</button>
        {theme.logoUrl && <button type="button" className="survey-btn" onClick={() => change({ logoUrl: "" })}>Remove logo</button>}</div>
      {theme.logoUrl && <img src={theme.logoUrl} alt={theme.logoAlt} className="survey-logo" />}
      <label className="survey-field">Logo description<input value={theme.logoAlt} maxLength={160} onChange={event => change({ logoAlt: event.currentTarget.value })} /></label>
      <div className="survey-grid"><label className="survey-field">Accent color<input type="color" value={theme.accentColor} onChange={event => change({ accentColor: event.currentTarget.value })} /></label>
      <label className="survey-field">Page background<input type="color" value={theme.backgroundColor} onChange={event => change({ backgroundColor: event.currentTarget.value })} /></label></div>
      <label className="survey-field">Survey font<select value={theme.font} onChange={event => change({ font: event.currentTarget.value as Appearance["font"] })}><option value="sans">Clean sans serif</option><option value="serif">Classic serif</option></select></label>
      <label className="survey-field">Submit button text<input value={theme.buttonLabel} maxLength={80} onChange={event => change({ buttonLabel: event.currentTarget.value })} /></label>
    </fieldset>{error && <p role="alert" className="survey-rule survey-error">{error}</p>}
  </section>;
}
