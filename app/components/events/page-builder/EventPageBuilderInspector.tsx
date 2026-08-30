// Right inspector for event page section content, design, and data bindings.
import { useEffect, useState } from "react";
import { getSectionDefinition, getSectionSourceFields } from "@/app/components/events/page-builder/section-config";
import type { EventPageBranding, EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

interface EventPageBuilderInspectorProps {
  section: EventPageSectionState;
  onUpdateSection: (sectionId: EventPageSectionId, updater: (current: EventPageSectionState) => EventPageSectionState) => void;
  branding?: EventPageBranding;
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="mt-1.5 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
      />
    </label>
  );
}

/** Inspector panel for section settings in the Events page builder. */
export default function EventPageBuilderInspector({ section, onUpdateSection, branding }: EventPageBuilderInspectorProps) {
  const [activeTab, setActiveTab] = useState<"Content" | "Design" | "Advanced">("Content");
  const definition = getSectionDefinition(section.id);
  const sourceFields = getSectionSourceFields(section.id);
  const content = section.content ?? {};
  const design = section.design ?? {};
  const advanced = section.advanced ?? {};
  const isHero = section.id === "hero";

  useEffect(() => {
    setActiveTab("Content");
  }, [section.id]);

  function updateContent(key: keyof NonNullable<EventPageSectionState["content"]>, value: string) {
    onUpdateSection(section.id, (current) => ({
      ...current,
      content: {
        ...(current.content ?? {}),
        [key]: value,
      },
    }));
  }

  function updateContentValue<K extends keyof NonNullable<EventPageSectionState["content"]>>(key: K, value: NonNullable<EventPageSectionState["content"]>[K]) {
    onUpdateSection(section.id, (current) => ({ ...current, content: { ...(current.content ?? {}), [key]: value } }));
  }

  function updateDesign(key: keyof NonNullable<EventPageSectionState["design"]>, value: string | number | boolean) {
    onUpdateSection(section.id, (current) => ({
      ...current,
      design: {
        ...(current.design ?? {}),
        [key]: value,
      },
    }));
  }

  function updateAdvanced(key: keyof NonNullable<EventPageSectionState["advanced"]>, value: string) {
    onUpdateSection(section.id, (current) => ({
      ...current,
      advanced: {
        ...(current.advanced ?? {}),
        [key]: value,
      },
    }));
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-300 bg-slate-50">
      <div className="flex min-h-[58px] items-center justify-between border-b border-slate-300 bg-slate-200/70 px-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Properties</p>
          <h2 className="truncate text-sm font-semibold text-slate-950">{definition.label.replace(" Section", "")}</h2>
        </div>
        <span className={`h-2.5 w-2.5 ${section.enabled ? "bg-emerald-500" : "bg-slate-400"}`} title={section.enabled ? "Section is visible" : "Section is hidden"} aria-label={section.enabled ? "Section is visible" : "Section is hidden"} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex border-b border-slate-300 bg-white px-2 text-xs font-semibold">
          {["Content", "Design", "Advanced"].map((tabName) => (
            <button
              key={tabName}
              type="button"
              onClick={() => setActiveTab(tabName as "Content" | "Design" | "Advanced")}
              className={[
                "h-10 flex-1 border-b-2",
                activeTab === tabName ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-900",
              ].join(" ")}
            >
              {tabName}
            </button>
          ))}
        </div>

        <section className="space-y-5 p-4">
          <div className="border-l-2 border-sky-500 bg-white px-3 py-2.5">
            <p className="text-xs leading-5 text-slate-600">{definition.description}</p>
          </div>

          {activeTab === "Advanced" ? null : (
          <div>
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Data binding</h3>
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-between border border-slate-300 bg-white px-3 py-2.5">
                <span>
                  <span className="block text-xs font-semibold text-slate-800">Sync with event record</span>
                  <span className="block text-[11px] text-slate-500">Keep connected source fields current.</span>
                </span>
                <input
                  type="checkbox"
                  checked={section.lockToEventData}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    onUpdateSection(section.id, (current) => ({ ...current, lockToEventData: nextChecked }));
                  }}
                  className="h-4 w-4 border-slate-300 text-sky-600"
                />
              </label>
            </div>
          </div>
          )}

          {activeTab === "Content" && isHero ? (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Content</h3>
                <div className="mt-3 space-y-3">
                  <TextField label="Kicker Text" value={content.kicker ?? ""} onChange={(value) => updateContent("kicker", value)} />
                  <TextField label="Title Override" value={content.title ?? ""} placeholder="Defaults to event name" onChange={(value) => updateContent("title", value)} />
                  <TextField label="Subtitle" value={content.subtitle ?? ""} onChange={(value) => updateContent("subtitle", value)} />
                  <TextField label="Attire / dress code" value={content.attire ?? ""} placeholder="Optional" onChange={(value) => updateContent("attire", value)} />
                  <TextField label="Primary Button" value={content.primaryButtonText ?? ""} onChange={(value) => updateContent("primaryButtonText", value)} />
                  <TextField label="Primary Link" value={content.primaryButtonLink ?? ""} onChange={(value) => updateContent("primaryButtonLink", value)} />
                  <TextField label="Secondary Button" value={content.secondaryButtonText ?? ""} onChange={(value) => updateContent("secondaryButtonText", value)} />
                  <TextField label="Secondary Link" value={content.secondaryButtonLink ?? ""} onChange={(value) => updateContent("secondaryButtonLink", value)} />
                </div>
              </div>

            </>
          ) : null}

          {activeTab === "Content" && !isHero ? (
            <div>
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Section content</h3>
              <div className="mt-3 space-y-3">
                <TextField label="Heading" value={content.heading ?? ""} placeholder={definition.label} onChange={(value) => updateContent("heading", value)} />
                <TextAreaField label="Body" value={content.body ?? ""} placeholder={definition.description} onChange={(value) => updateContent("body", value)} />
                {["cta-banner", "donation-form", "documents"].includes(section.id) ? (
                  <>
                    <TextField label="Button / Document Label" value={content.buttonText ?? content.documentLabel ?? ""} onChange={(value) => {
                      updateContent("buttonText", value);
                      updateContent("documentLabel", value);
                    }} />
                    <TextField label="Link URL" value={content.buttonLink ?? content.documentUrl ?? ""} onChange={(value) => {
                      updateContent("buttonLink", value);
                      updateContent("documentUrl", value);
                    }} />
                  </>
                ) : null}
                {section.id === "video" ? (
                  <TextField label="Media URL" value={content.mediaUrl ?? ""} placeholder="https://..." onChange={(value) => updateContent("mediaUrl", value)} />
                ) : null}
                {section.id === "image-gallery" ? <TextAreaField label="Image URLs (one per line)" value={(content.galleryImages ?? []).join("\n")} placeholder="https://..." onChange={(value) => updateContentValue("galleryImages", value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 6))} /> : null}
                {section.id === "schedule" ? <div className="space-y-2"><p className="text-xs font-semibold text-slate-700">Schedule items</p>{(content.scheduleItems ?? []).map((item, index) => <div key={index} className="grid grid-cols-[90px_1fr_auto] gap-1"><input aria-label={`Schedule item ${index + 1} time`} value={item.time ?? ""} onChange={(event) => updateContentValue("scheduleItems", (content.scheduleItems ?? []).map((current, itemIndex) => itemIndex === index ? { ...current, time: event.target.value } : current))} placeholder="6:00 PM" className="h-9 border border-slate-300 px-2 text-xs" /><input aria-label={`Schedule item ${index + 1} label`} value={item.label ?? ""} onChange={(event) => updateContentValue("scheduleItems", (content.scheduleItems ?? []).map((current, itemIndex) => itemIndex === index ? { ...current, label: event.target.value } : current))} placeholder="Doors open" className="h-9 min-w-0 border border-slate-300 px-2 text-xs" /><button type="button" onClick={() => updateContentValue("scheduleItems", (content.scheduleItems ?? []).filter((_, itemIndex) => itemIndex !== index))} className="h-9 px-2 text-xs text-red-600" aria-label={`Remove schedule item ${index + 1}`}>×</button></div>)}<button type="button" onClick={() => updateContentValue("scheduleItems", [...(content.scheduleItems ?? []), { time: "", label: "" }].slice(0, 12))} className="event-studio-secondary-button w-full">+ Add schedule item</button></div> : null}
                {section.id === "faq" ? <div className="space-y-2"><p className="text-xs font-semibold text-slate-700">Questions and answers</p>{(content.faqItems ?? []).map((item, index) => <div key={index} className="border border-slate-200 p-2"><input aria-label={`FAQ ${index + 1} question`} value={item.question ?? ""} onChange={(event) => updateContentValue("faqItems", (content.faqItems ?? []).map((current, itemIndex) => itemIndex === index ? { ...current, question: event.target.value } : current))} placeholder="Question" className="h-9 w-full border border-slate-300 px-2 text-xs" /><textarea aria-label={`FAQ ${index + 1} answer`} value={item.answer ?? ""} onChange={(event) => updateContentValue("faqItems", (content.faqItems ?? []).map((current, itemIndex) => itemIndex === index ? { ...current, answer: event.target.value } : current))} placeholder="Answer" rows={3} className="mt-2 w-full border border-slate-300 p-2 text-xs" /><button type="button" onClick={() => updateContentValue("faqItems", (content.faqItems ?? []).filter((_, itemIndex) => itemIndex !== index))} className="mt-1 text-xs font-semibold text-red-600">Remove</button></div>)}<button type="button" onClick={() => updateContentValue("faqItems", [...(content.faqItems ?? []), { question: "", answer: "" }].slice(0, 12))} className="event-studio-secondary-button w-full">+ Add FAQ</button></div> : null}
                {section.id === "highlights" ? <div className="space-y-2"><p className="text-xs font-semibold text-slate-700">Highlight cards</p>{(content.highlightItems ?? []).map((item, index) => <div key={index} className="border border-slate-200 p-2"><input aria-label={`Highlight ${index + 1} title`} value={item.title ?? ""} onChange={(event) => updateContentValue("highlightItems", (content.highlightItems ?? []).map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))} placeholder="Title" className="h-9 w-full border border-slate-300 px-2 text-xs" /><textarea aria-label={`Highlight ${index + 1} body`} value={item.body ?? ""} onChange={(event) => updateContentValue("highlightItems", (content.highlightItems ?? []).map((current, itemIndex) => itemIndex === index ? { ...current, body: event.target.value } : current))} placeholder="Short description" rows={2} className="mt-2 w-full border border-slate-300 p-2 text-xs" /><button type="button" onClick={() => updateContentValue("highlightItems", (content.highlightItems ?? []).filter((_, itemIndex) => itemIndex !== index))} className="mt-1 text-xs font-semibold text-red-600">Remove</button></div>)}<button type="button" onClick={() => updateContentValue("highlightItems", [...(content.highlightItems ?? []), { title: "", body: "" }].slice(0, 6))} className="event-studio-secondary-button w-full">+ Add highlight</button></div> : null}
                {section.id === "testimonial" ? <><TextField label="Quote author" value={content.quoteAuthor ?? ""} onChange={(value) => updateContent("quoteAuthor", value)} /><TextField label="Author role / organization" value={content.quoteRole ?? ""} onChange={(value) => updateContent("quoteRole", value)} /></> : null}
              </div>
            </div>
          ) : null}

          {activeTab === "Design" ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Background</h3>
                {section.id === "hero" ? <div className="mt-3 grid grid-cols-3 overflow-hidden border border-slate-200 text-xs font-semibold">
                  {(["image", "color", "video"] as const).map((type) => <button key={type} type="button" onClick={() => updateDesign("backgroundType", type)} className={`h-9 capitalize ${(design.backgroundType ?? "image") === type ? "bg-[#eff6fc] text-[#0f6cbd]" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{type}</button>)}
                </div> : <p className="mt-1 text-xs text-slate-500">Choose a surface color for this block. Page accents inherit global branding unless overridden below.</p>}
                <div className="mt-3 space-y-3">
                  {section.id === "hero" && design.backgroundType !== "color" ? <TextField label="Image / Video URL" value={design.backgroundImageUrl ?? ""} placeholder="https://..." onChange={(value) => updateDesign("backgroundImageUrl", value)} /> : null}
                  <label className="block"><span className="text-xs font-medium text-slate-500">Background color</span><div className="mt-1 flex gap-2"><input type="color" value={design.backgroundColor || branding?.primaryColor || "#0f6cbd"} onChange={(event) => updateDesign("backgroundColor", event.target.value)} className="h-9 w-12 border border-slate-300 bg-white p-1" /><input value={design.backgroundColor ?? ""} onChange={(event) => updateDesign("backgroundColor", event.target.value)} placeholder={branding?.primaryColor || "#0f6cbd"} className="h-9 min-w-0 flex-1 border border-slate-300 px-2 text-xs" /></div></label>
                  <label className="block"><span className="text-xs font-medium text-slate-500">Accent color</span><div className="mt-1 flex gap-2"><input type="color" value={design.accentColor || branding?.accentColor || "#5c2d91"} onChange={(event) => updateDesign("accentColor", event.target.value)} className="h-9 w-12 border border-slate-300 bg-white p-1" /><input value={design.accentColor ?? ""} onChange={(event) => updateDesign("accentColor", event.target.value)} placeholder={branding?.accentColor || "#5c2d91"} className="h-9 min-w-0 flex-1 border border-slate-300 px-2 text-xs" /></div></label>
                </div>
                {section.id === "hero" && design.backgroundType !== "color" ? <label className="mt-3 block">
                  <span className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Overlay Opacity</span>
                    <span>{design.overlayOpacity ?? 62}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={design.overlayOpacity ?? 62}
                    onChange={(event) => updateDesign("overlayOpacity", Number(event.target.value))}
                    className="mt-2 w-full accent-[#0f6cbd]"
                  />
                </label> : null}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">Layout</h3>
                <p className="mt-3 text-xs font-medium text-slate-500">Section surface</p><div className="mt-1 grid grid-cols-3 border border-slate-200 text-xs font-semibold">{(["default", "white", "soft"] as const).map((tone) => <button key={tone} type="button" onClick={() => updateDesign("backgroundTone", tone)} className={`h-9 capitalize ${(design.backgroundTone ?? "default") === tone ? "bg-[#eff6fc] text-[#0f6cbd]" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{tone}</button>)}</div>
                <p className="mt-3 text-xs font-medium text-slate-500">Content width</p><div className="mt-1 grid grid-cols-3 border border-slate-200 text-xs font-semibold">{(["narrow", "standard", "wide"] as const).map((width) => <button key={width} type="button" onClick={() => updateDesign("contentWidth", width)} className={`h-9 capitalize ${(design.contentWidth ?? "standard") === width ? "bg-[#eff6fc] text-[#0f6cbd]" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{width}</button>)}</div>
                <div className="mt-3 grid grid-cols-2 overflow-hidden border border-slate-300 text-xs font-semibold">
                  {(["left", "center"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateDesign("textAlign", align)}
                      className={[
                        "h-9 capitalize",
                        (design.textAlign ?? "left") === align ? "bg-sky-50 text-sky-700" : "bg-white text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {align}
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex items-center justify-between border border-slate-300 bg-white px-3 py-2.5">
                  <span className="text-xs font-semibold text-slate-700">Compact Spacing</span>
                  <input type="checkbox" checked={Boolean(design.compact)} onChange={(event) => updateDesign("compact", event.target.checked)} className="h-4 w-4 border-slate-300 text-sky-600" />
                </label>
                <label className="mt-2 flex items-center justify-between border border-slate-300 bg-white px-3 py-2.5">
                  <span className="text-xs font-semibold text-slate-700">Show Scroll Indicator</span>
                  <input type="checkbox" checked={design.showScrollIndicator !== false} onChange={(event) => updateDesign("showScrollIndicator", event.target.checked)} className="h-4 w-4 border-slate-300 text-sky-600" />
                </label>
              </div>
            </div>
          ) : null}

          {activeTab === "Advanced" ? (
            <div className="space-y-3">
              <TextField label="Anchor ID" value={advanced.anchorId ?? ""} placeholder={section.id} onChange={(value) => updateAdvanced("anchorId", value)} />
              <TextField label="Custom CSS Class" value={advanced.customCssClass ?? ""} placeholder="optional-class-name" onChange={(value) => updateAdvanced("customCssClass", value)} />
              <div className="border-l-2 border-amber-500 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                Advanced values are sanitized before saving. Custom classes are stored for future theme hooks and do not execute code.
              </div>
            </div>
          ) : null}

          {activeTab !== "Advanced" && sourceFields.length > 0 ? <div className="border border-slate-300 bg-slate-100 px-3 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Connected event fields</p>
            <ul className="mt-2 grid gap-1 text-[11px] text-slate-700">
              {sourceFields.map((field) => (
                <li key={field} className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-sky-500" aria-hidden />{field}</li>
              ))}
            </ul>
          </div> : null}
        </section>
      </div>
    </aside>
  );
}
