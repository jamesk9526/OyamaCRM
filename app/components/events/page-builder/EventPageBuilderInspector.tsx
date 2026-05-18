// Right inspector for event page section content, design, and data bindings.
import { useEffect, useState } from "react";
import { getSectionDefinition, getSectionSourceFields } from "@/app/components/events/page-builder/section-config";
import type { EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

interface EventPageBuilderInspectorProps {
  section: EventPageSectionState;
  onUpdateSection: (sectionId: EventPageSectionId, updater: (current: EventPageSectionState) => EventPageSectionState) => void;
  onDeleteSection: (sectionId: EventPageSectionId) => void;
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
        className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
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
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
      />
    </label>
  );
}

/** Inspector panel for section settings in the Events page builder. */
export default function EventPageBuilderInspector({ section, onUpdateSection, onDeleteSection }: EventPageBuilderInspectorProps) {
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
    <aside className="min-h-0 border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Section Settings</h2>
            <p className="mt-1 text-sm text-slate-700">{definition.label.replace(" Section", "")}</p>
          </div>
          <button
            type="button"
            onClick={() => onDeleteSection(section.id)}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
          >
            Delete Section
          </button>
        </div>
      </div>

      <div className="h-[calc(100vh-8rem)] overflow-y-auto px-4 py-4">
        <div className="flex border-b border-slate-200 text-xs font-semibold">
          {["Content", "Design", "Advanced"].map((tabLabel) => (
            <button
              key={tabLabel}
              type="button"
              onClick={() => setActiveTab(tabLabel as "Content" | "Design" | "Advanced")}
              className={[
                "h-9 flex-1 border-b-2",
                activeTab === tabLabel ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500",
              ].join(" ")}
            >
              {tabLabel}
            </button>
          ))}
        </div>

        <section className="mt-5 space-y-4">
          <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Selected Block</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950">{definition.label}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">{definition.description}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${section.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                {section.enabled ? "Visible" : "Hidden"}
              </span>
            </div>
            {sourceFields.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sourceFields.slice(0, 5).map((field) => (
                  <span key={field} className="rounded-full border border-violet-100 bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                    {field}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {activeTab === "Advanced" ? null : (
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Visibility</h3>
            <div className="mt-3 space-y-2">
              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">Show Section</span>
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    onUpdateSection(section.id, (current) => ({ ...current, enabled: nextChecked }));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-slate-700">Lock To Event Data</span>
                  <span className="block text-[11px] text-slate-500">Keep event source fields synchronized.</span>
                </span>
                <input
                  type="checkbox"
                  checked={section.lockToEventData}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    onUpdateSection(section.id, (current) => ({ ...current, lockToEventData: nextChecked }));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600"
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
                  <TextField label="Primary Button" value={content.primaryButtonText ?? ""} onChange={(value) => updateContent("primaryButtonText", value)} />
                  <TextField label="Primary Link" value={content.primaryButtonLink ?? ""} onChange={(value) => updateContent("primaryButtonLink", value)} />
                  <TextField label="Secondary Button" value={content.secondaryButtonText ?? ""} onChange={(value) => updateContent("secondaryButtonText", value)} />
                  <TextField label="Secondary Link" value={content.secondaryButtonLink ?? ""} onChange={(value) => updateContent("secondaryButtonLink", value)} />
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">Show Scroll Indicator</span>
                <input
                  type="checkbox"
                  checked={design.showScrollIndicator !== false}
                  onChange={(event) => updateDesign("showScrollIndicator", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600"
                />
              </label>
            </>
          ) : null}

          {activeTab === "Content" && !isHero ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold text-slate-700">Content Source</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{definition.description}</p>
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
                {["video", "image-gallery"].includes(section.id) ? (
                  <TextField label="Media URL" value={content.mediaUrl ?? ""} placeholder="https://..." onChange={(value) => updateContent("mediaUrl", value)} />
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === "Design" ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Background</h3>
                <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
                  {(["image", "color", "video"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateDesign("backgroundType", type)}
                      className={[
                        "h-9 capitalize",
                        (design.backgroundType ?? "image") === type ? "bg-violet-50 text-violet-700" : "bg-white text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-3">
                  <TextField label="Image / Video URL" value={design.backgroundImageUrl ?? ""} placeholder="https://..." onChange={(value) => updateDesign("backgroundImageUrl", value)} />
                  <TextField label="Background Color" value={design.backgroundColor ?? ""} placeholder="#120c3b" onChange={(value) => updateDesign("backgroundColor", value)} />
                  <TextField label="Accent Color" value={design.accentColor ?? ""} placeholder="#8b5cf6" onChange={(value) => updateDesign("accentColor", value)} />
                </div>
                <label className="mt-3 block">
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
                    className="mt-2 w-full accent-violet-600"
                  />
                </label>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">Layout</h3>
                <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
                  {(["left", "center"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateDesign("textAlign", align)}
                      className={[
                        "h-9 capitalize",
                        (design.textAlign ?? "left") === align ? "bg-violet-50 text-violet-700" : "bg-white text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {align}
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-700">Compact Spacing</span>
                  <input type="checkbox" checked={Boolean(design.compact)} onChange={(event) => updateDesign("compact", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600" />
                </label>
                <label className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-700">Show Scroll Indicator</span>
                  <input type="checkbox" checked={design.showScrollIndicator !== false} onChange={(event) => updateDesign("showScrollIndicator", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600" />
                </label>
              </div>
            </div>
          ) : null}

          {activeTab === "Advanced" ? (
            <div className="space-y-3">
              <TextField label="Anchor ID" value={advanced.anchorId ?? ""} placeholder={section.id} onChange={(value) => updateAdvanced("anchorId", value)} />
              <TextField label="Custom CSS Class" value={advanced.customCssClass ?? ""} placeholder="optional-class-name" onChange={(value) => updateAdvanced("customCssClass", value)} />
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                Advanced values are sanitized before saving. Custom classes are stored for future theme hooks and do not execute code.
              </div>
            </div>
          ) : null}

          {activeTab !== "Advanced" ? <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3">
            <p className="text-xs font-semibold text-violet-800">Connected Fields</p>
            <ul className="mt-2 space-y-1 text-[11px] text-violet-900">
              {sourceFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div> : null}

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
            Changes are auto-saved.
          </div>
        </section>
      </div>
    </aside>
  );
}
