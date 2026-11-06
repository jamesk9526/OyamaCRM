"use client";

import { useState } from "react";
import { CLASSIC_CRM_FIELDS, type ClassicCrmBlock, type ClassicLetterAdvanced, type ClassicLetterSettings } from "@/server/src/oyama-create/classic-letter-contract";
import { CONDITION_FIELDS, DONOR_FIELDS } from "@/server/src/oyama-create/studio/design";
import { STUDIO_BLOCKS } from "@/server/src/oyama-create/studio/registry";
import { STUDIO_FONTS } from "@/server/src/oyama-create/studio/fonts";

const regions = [
  ["firstHeader", "First-page header"], ["header", "Continuation header"],
  ["firstFooter", "First-page footer"], ["footer", "Continuation footer"],
] as const;
const blockLabels: Record<string, string> = { signerId: "Signer", secondSignerId: "Second signer", field: "CRM field", statement: "Receipt statement" };

export default function ClassicLetterProperties({ settings, changeSettings, advanced, changeAdvanced, recipient, gifts, enableAdvanced, addBlock, signers }: {
  settings: ClassicLetterSettings; changeSettings: (settings: ClassicLetterSettings) => void;
  advanced: ClassicLetterAdvanced | null; changeAdvanced: (advanced: ClassicLetterAdvanced) => void;
  recipient: string; gifts: Array<{ id: string; date: string; amount: number }>;
  enableAdvanced: () => void; addBlock: (type: ClassicCrmBlock["type"]) => string; signers: Array<{ id: string; name: string }>;
}) {
  const [selectedBlock, setSelectedBlock] = useState(""), [blockType, setBlockType] = useState<ClassicCrmBlock["type"]>("studioField");
  if (!advanced) return <details className="classic-letter-settings" open>
    <summary>Letterhead & footer</summary>
    <div className="oc-form">
      <label>Header address<select value={settings.headerMode} onChange={event => changeSettings({ ...settings, headerMode: event.target.value as ClassicLetterSettings["headerMode"] })}>
        <option value="ORGANIZATION">Organization information</option><option value="RECIPIENT">Recipient name and address</option><option value="CUSTOM">Custom header copy</option>
      </select></label>
      {settings.headerMode === "CUSTOM" && <label>Header copy<textarea rows={4} value={settings.headerHtml} onChange={event => changeSettings({ ...settings, headerHtml: event.target.value })}/></label>}
      <label>Footer override<textarea rows={3} value={settings.footerHtml} onChange={event => changeSettings({ ...settings, footerHtml: event.target.value })}/></label>
      <p className="oc-help">Header and footer copy can use merge fields such as {"{{donor.fullName}}"}. Select a recipient to see the result in the PDF.</p>
      <button className="oc-button" type="button" onClick={enableAdvanced}>Set up advanced print layout</button>
    </div>
  </details>;
  const { page, styles, pack, data } = advanced;
  const crmBlock = advanced.blocks?.find(block => block.id === selectedBlock);
  const blockName = (type: string) => STUDIO_BLOCKS.find(block => block.type === type)?.name || type;
  const patchBlock = (values: Partial<ClassicCrmBlock>) => changeAdvanced({ ...advanced, blocks: advanced.blocks?.map(block => block.id === selectedBlock ? { ...block, ...values } : block) });
  const changeData = (values: Partial<ClassicLetterAdvanced["data"]>) => changeAdvanced({ ...advanced, data: { ...data, ...values } });
  return <div className="classic-letter-settings oc-form">
    <details><summary>Configured CRM blocks</summary><div className="oc-form">
      <label>Insert a CRM block<select value={blockType} onChange={event => setBlockType(event.target.value as ClassicCrmBlock["type"])}>
        {Object.keys(CLASSIC_CRM_FIELDS).map(type => <option key={type} value={type}>{blockName(type)}</option>)}
      </select></label><button type="button" className="oc-button" onClick={() => setSelectedBlock(addBlock(blockType))}>Insert in Letter</button>
      {!!advanced.blocks?.length && <label>Block to configure<select value={selectedBlock} onChange={event => setSelectedBlock(event.target.value)}>
        <option value="">Choose a block</option>{advanced.blocks.map((block, i) => <option key={block.id} value={block.id}>{i + 1}. {blockName(block.type)}</option>)}
      </select></label>}
      {crmBlock && <>
        {CLASSIC_CRM_FIELDS[crmBlock.type].map(key => {
          const value = crmBlock.attrs[key], patch = (next: unknown) => patchBlock({ attrs: { ...crmBlock.attrs, [key]: next } });
          const label = blockLabels[key] || key;
          const options = key === "basis" ? ["fixed", "lastGift", "largestGift"] : key === "mode" ? ["summary", "table"] :
            key === "operator" ? ["is", "isNot", "greaterThan", "lessThan"] : key === "field" ? (crmBlock.type === "studioCondition" ? CONDITION_FIELDS : DONOR_FIELDS) : undefined;
          if (key === "signerId" || key === "secondSignerId") return <label key={key}>{label}<select value={String(value || "")} onChange={event => patch(event.target.value)}>
            <option value="">{key === "signerId" ? "Organization default" : "None"}</option>{signers.map(signer => <option key={signer.id} value={signer.id}>{signer.name}</option>)}
          </select></label>;
          if (options) return <label key={key}>{label}<select value={String(value || options[0])} onChange={event => patch(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select></label>;
          if (["amounts", "multipliers", "fallback"].includes(key)) return <label key={key}>{label}<input key={crmBlock.id + key} defaultValue={Array.isArray(value) ? value.join(", ") : ""} placeholder="25, 50, 100" onBlur={event => patch(event.target.value.split(",").map(Number).filter(number => number > 0 && Number.isFinite(number)))}/></label>;
          if (typeof value === "number") return <label key={key}>{label}<input type="number" value={value} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) patch(event.target.valueAsNumber); }}/></label>;
          return <label key={key}>{label}<input value={String(value || "")} onChange={event => patch(event.target.value)}/></label>;
        })}
        {crmBlock.type === "studioCondition" && <label>Conditional copy HTML<textarea rows={4} value={crmBlock.contentHtml || ""} onChange={event => patchBlock({ contentHtml: event.target.value })}/></label>}
      </>}
    </div></details>
    <details><summary>Letterhead & repeating regions</summary><div className="oc-form">
      {regions.map(([key, label]) => <div key={key} className="oc-form">
        <label>{label}<select value={advanced.regions[key].mode} onChange={event => changeAdvanced({ ...advanced, regions: { ...advanced.regions,
          [key]: { ...advanced.regions[key], mode: event.target.value as "brand" | "custom" | "none" },
        } })}><option value="brand">Saved brand preset</option><option value="custom">Customize</option><option value="none">Hide</option></select></label>
        {advanced.regions[key].mode === "custom" && <label>{label} HTML<textarea rows={4} value={advanced.html[key]} onChange={event => changeAdvanced({ ...advanced, html: { ...advanced.html, [key]: event.target.value } })}/></label>}
      </div>)}
    </div></details>
    <details><summary>Print typography</summary><div className="oc-form">
      <label>Print font<select value={styles.font} onChange={event => changeAdvanced({ ...advanced, styles: { ...styles, font: event.target.value } })}>
        {!STUDIO_FONTS.some(font => font === styles.font) && <option>{styles.font}</option>}
        {STUDIO_FONTS.map(font => <option key={font}>{font}</option>)}
      </select></label>
      {([["fontSize", "Size (pt)", 8, 24, .5], ["lineHeight", "Line spacing", 1, 2.5, .05], ["paragraphSpacing", "Paragraph gap (pt)", 0, 36, 1]] as const).map(([key, label, min, max, step]) =>
        <label key={key}>{label}<input type="number" value={styles[key]} min={min} max={max} step={step} onChange={event => {
          if (Number.isFinite(event.target.valueAsNumber)) changeAdvanced({ ...advanced, styles: { ...styles, [key]: event.target.valueAsNumber } });
        }}/></label>)}
      {(["headerHeight", "footerHeight"] as const).map(key => <label key={key}>{key === "headerHeight" ? "Header" : "Footer"} target (in)<input type="number" value={page[key]} min={0} max={1.25} step={.05} onChange={event => {
        if (Number.isFinite(event.target.valueAsNumber)) changeAdvanced({ ...advanced, page: { ...page, [key]: event.target.valueAsNumber } });
      }}/></label>)}
    </div></details>
    <details><summary>Reply slip & envelopes</summary><div className="oc-form">
      <label className="oc-check"><input type="checkbox" checked={pack.replySlip.enabled} onChange={event => changeAdvanced({ ...advanced, pack: { ...pack, replySlip: { ...pack.replySlip, enabled: event.target.checked } } })}/>Include reply slip</label>
      {pack.replySlip.enabled && <>
        <label>Reply-slip placement<select value={pack.replySlip.placement} onChange={event => changeAdvanced({ ...advanced, pack: { ...pack, replySlip: { ...pack.replySlip, placement: event.target.value === "separate" ? "separate" : "attached" } } })}><option value="attached">After the letter</option><option value="separate">Separate sheet</option></select></label>
        <label>Reply-slip HTML<textarea rows={4} value={advanced.html.replySlip} onChange={event => changeAdvanced({ ...advanced, html: { ...advanced.html, replySlip: event.target.value } })}/></label>
      </>}
      {(["outerEnvelope", "returnEnvelope"] as const).map(key => {
        const envelope = pack[key];
        const edit = (values: Partial<typeof envelope>) => changeAdvanced({ ...advanced, pack: { ...pack, [key]: { ...envelope, ...values } } });
        return <details key={key}><summary>{key === "outerEnvelope" ? "Outer envelope" : "Return envelope"}</summary><div className="oc-form">
          <label className="oc-check"><input type="checkbox" checked={envelope.enabled} onChange={event => edit({ enabled: event.target.checked })}/>Include in pack</label>
          <label>Envelope size<select value={envelope.size} onChange={event => edit({ size: event.target.value as typeof envelope.size })}><option>#10</option><option>#9</option><option>DL</option></select></label>
          <label className="oc-check"><input type="checkbox" checked={envelope.window} onChange={event => edit({ window: event.target.checked })}/>Show address-window guide</label>
          {(["addressX", "addressY", "addressWidth", "offsetX", "offsetY"] as const).map(field => <label key={field}>{field} (in)<input type="number" value={envelope[field]} step={.05} onChange={event => {
            if (Number.isFinite(event.target.valueAsNumber)) edit({ [field]: event.target.valueAsNumber });
          }}/></label>)}
        </div></details>;
      })}
    </div></details>
    <details><summary>Giving & donor context</summary><div className="oc-form">
      <label>Giving destination<input value={data.givingUrl} onChange={event => changeData({ givingUrl: event.target.value })}/></label>
      <label>Frequency<select value={data.frequency} onChange={event => changeData({ frequency: event.target.value === "monthly" ? "monthly" : "one-time" })}><option value="one-time">One-time</option><option value="monthly">Monthly</option></select></label>
      <label>Designation<input value={data.designation} onChange={event => changeData({ designation: event.target.value })}/></label>
      <label>Giving period<select value={data.period} onChange={event => changeData({ period: event.target.value as typeof data.period })}>
        <option value="calendar">Calendar year</option><option value="fiscal">Fiscal year</option><option value="custom">Custom dates</option>
      </select></label>
      {data.period === "custom" ? <><label>From<input type="date" value={data.from} onChange={event => changeData({ from: event.target.value })}/></label>
        <label>Through<input type="date" value={data.to} onChange={event => changeData({ to: event.target.value })}/></label></> :
        <label>Year<input type="number" value={data.year} min={2000} max={3000} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) changeData({ year: event.target.valueAsNumber }); }}/></label>}
      <label>Gift context<select value={data.giftPolicy} onChange={event => changeData({ giftPolicy: event.target.value as typeof data.giftPolicy })}>
        <option value="latest-completed">Latest completed gift</option><option value="selected">Choose a gift per recipient</option>
      </select></label>
      {data.giftPolicy === "selected" && <label>Gift for this recipient<select disabled={!recipient} value={data.giftSelections[recipient] || ""}
        onChange={event => changeData({ giftSelections: { ...data.giftSelections, [recipient]: event.target.value } })}>
        <option value="">Choose a gift</option>{gifts.map(gift => <option key={gift.id} value={gift.id}>{new Date(gift.date).toLocaleDateString()} · {gift.amount}</option>)}
      </select></label>}
    </div></details>
  </div>;
}
