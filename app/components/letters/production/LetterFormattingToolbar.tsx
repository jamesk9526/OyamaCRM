"use client";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";

const buttonClass = "min-h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40";
export default function LetterFormattingToolbar({ editor, onImage }: { editor: Editor | null; onImage: () => void }) {
  const selected = useEditorState({ editor, selector: ({ editor }) => editor ? {
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"),
    table: editor.isActive("table"), font: editor.getAttributes("textStyle").fontFamily || "Inter",
    size: String(editor.getAttributes("textStyle").fontSize || "11pt").replace(/pt$/, ""),
    heading: editor.getAttributes("heading").level || 0,
    align: editor.getAttributes("paragraph").textAlign || editor.getAttributes("heading").textAlign || "left",
  } : null });
  const tool = (label: string, run: (editor: Editor) => void, active = false) => <button type="button" key={label} className={`${buttonClass} ${active ? "border-blue-400 bg-blue-50 text-blue-800" : ""}`} disabled={!editor} aria-pressed={active} onMouseDown={event => event.preventDefault()} onClick={() => { if (editor) run(editor);  }}>{label}</button>;
  return <div role="toolbar" aria-label="Letter formatting" className="flex flex-wrap items-center gap-1.5 border-y border-slate-200 bg-white p-2">
    {tool("Undo", e => e.chain().focus().undo().run())}{tool("Redo", e => e.chain().focus().redo().run())}
    <select aria-label="Paragraph style" className={buttonClass} onChange={event => { const level = Number(event.target.value); if (level) editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run(); else editor?.chain().focus().setParagraph().run(); }} value={selected?.heading ?? 0}><option value="0">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
    <select aria-label="Font family" value={selected?.font || "Inter"} className={buttonClass} onChange={event => editor?.chain().focus().setFontFamily(event.target.value).run()}><option value="Inter">Inter</option><option value="Noto Serif">Noto Serif</option></select>
    <select aria-label="Font size" className={buttonClass} value={selected?.size || "11"} onChange={event => editor?.chain().focus().setFontSize(`${event.target.value}pt`).run()}>{[8,9,10,11,12,14,16,18,24,32].map(size => <option key={size}>{size}</option>)}</select>
    {tool("Bold", e => e.chain().focus().toggleBold().run(), selected?.bold)}{tool("Italic", e => e.chain().focus().toggleItalic().run(), selected?.italic)}{tool("Underline", e => e.chain().focus().toggleUnderline().run(), selected?.underline)}
    {(["left", "center", "right", "justify"] as const).map(align => tool(align[0].toUpperCase() + align.slice(1), e => e.chain().focus().setTextAlign(align).run(), selected?.align === align))}
    {tool("Bullets", e => e.chain().focus().toggleBulletList().run())}{tool("Numbering", e => e.chain().focus().toggleOrderedList().run())}
    <select aria-label="Line spacing" className={buttonClass} defaultValue="1.5" onChange={event => editor?.chain().focus().setLineHeight(event.target.value).run()}>{[1,1.15,1.5,2].map(value => <option key={value}>{value}</option>)}</select>
    <select aria-label="Paragraph spacing after" className={buttonClass} defaultValue="9pt" onChange={event => editor?.chain().focus().updateAttributes("paragraph", { spacing: event.target.value }).run()}>{[0,6,9,12,18,24].map(value => <option value={`${value}pt`} key={value}>{value} pt after</option>)}</select>
    {tool("Keep together", e => e.chain().focus().updateAttributes("paragraph", { keepTogether: !e.getAttributes("paragraph").keepTogether }).run())}
    {tool("Page break", e => e.chain().focus().insertContent({ type: "letterPageBreak" }).run())}
    {tool("Table", e => e.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run())}
    {selected?.table ? <>{tool("Add row", e => e.chain().focus().addRowAfter().run())}{tool("Add column", e => e.chain().focus().addColumnAfter().run())}{tool("Delete table", e => e.chain().focus().deleteTable().run())}</> : null}
    <button className={buttonClass} type="button" onClick={onImage} disabled={!editor}>Image</button>
    {tool("Link", e => { const value = window.prompt("Link URL (https:// or mailto:)", e.getAttributes("link").href || "https://"); if (value && /^(https?:\/\/|mailto:)/i.test(value)) e.chain().focus().extendMarkRange("link").setLink({ href: value }).run(); })}
  </div>;
}
