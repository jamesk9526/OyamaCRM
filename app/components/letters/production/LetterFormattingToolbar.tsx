"use client";

import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Underline, List, ListOrdered, Undo2, Redo2, Link2 } from "lucide-react";
import type { ReactNode } from "react";

const controlClass = "min-h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-40";
const groupClass = "flex flex-wrap items-center gap-1 border-r border-slate-200 pr-2 last:border-0";

/** Formatting lives here. Structural insertion lives exclusively in Document blocks. */
export default function LetterFormattingToolbar({ editor }: { editor: Editor | null }) {
  const selected = useEditorState({ editor, selector: ({ editor }) => {
    if (!editor) return null;
    const text = editor.getAttributes("textStyle");
    const blockType = editor.isActive("heading") ? "heading" : "paragraph";
    const block = editor.getAttributes(blockType);
    return {
      bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"),
      bullets: editor.isActive("bulletList"), numbering: editor.isActive("orderedList"), table: editor.isActive("table"),
      font: String(text.fontFamily || "Inter"), size: String(text.fontSize || "11pt").replace(/pt$/, ""),
      heading: editor.isActive("heading") ? editor.getAttributes("heading").level : 0,
      align: block.textAlign || "left", lineHeight: String(text.lineHeight || "1.5"), spacing: String(block.spacing || "9pt"),
      keepTogether: !!block.keepTogether, blockType,
      undo: editor.can().undo(), redo: editor.can().redo(), link: editor.isActive("link"),
    };
  } });
  const tool = (label: string, icon: ReactNode, run: (editor: Editor) => void, options: { active?: boolean; disabled?: boolean; text?: boolean } = {}) => (
    <button type="button" key={label} title={label} aria-label={label} aria-pressed={options.active}
      className={`${controlClass} inline-flex items-center justify-center gap-1.5 ${options.active ? "border-teal-400 bg-teal-50 text-teal-800" : ""}`}
      disabled={!editor || options.disabled} onMouseDown={event => event.preventDefault()} onClick={() => { if (editor) run(editor); }}>
      {icon}{options.text ? <span>{label}</span> : null}
    </button>
  );
  const fontSizes = [...new Set(["8", "9", "10", "11", "12", "14", "16", "18", "24", "32", selected?.size || "11"])];
  const fonts = [...new Set(["Inter", "Noto Serif", selected?.font || "Inter"])];
  const lineHeights = [...new Set(["1", "1.15", "1.5", "2", selected?.lineHeight || "1.5"])];
  const spacings = [...new Set(["0pt", "6pt", "9pt", "12pt", "18pt", "24pt", selected?.spacing || "9pt"])];
  return <div role="toolbar" aria-label="Letter formatting" className="flex flex-wrap items-center gap-2 border-y border-slate-200 bg-white p-2">
    <div role="group" aria-label="History" className={groupClass}>
      {tool("Undo", <Undo2 size={16}/>, e => e.chain().focus().undo().run(), { disabled: !selected?.undo })}
      {tool("Redo", <Redo2 size={16}/>, e => e.chain().focus().redo().run(), { disabled: !selected?.redo })}
    </div>
    <div role="group" aria-label="Text style" className={groupClass}>
      <select aria-label="Paragraph style" disabled={!editor} className={controlClass} value={selected?.heading ?? 0} onChange={event => {
        const level = Number(event.target.value);
        if (level) editor?.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
        else editor?.chain().focus().setParagraph().run();
      }}><option value="0">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
      <select aria-label="Font family" disabled={!editor} className={controlClass} value={selected?.font || "Inter"} onChange={event => editor?.chain().focus().setFontFamily(event.target.value).run()}>{fonts.map(font => <option key={font}>{font}</option>)}</select>
      <select aria-label="Font size" disabled={!editor} className={controlClass} value={selected?.size || "11"} onChange={event => editor?.chain().focus().setFontSize(`${event.target.value}pt`).run()}>{fontSizes.map(size => <option key={size} value={size}>{size} pt</option>)}</select>
      {tool("Bold", <Bold size={16}/>, e => e.chain().focus().toggleBold().run(), { active: selected?.bold })}
      {tool("Italic", <Italic size={16}/>, e => e.chain().focus().toggleItalic().run(), { active: selected?.italic })}
      {tool("Underline", <Underline size={16}/>, e => e.chain().focus().toggleUnderline().run(), { active: selected?.underline })}
    </div>
    <div role="group" aria-label="Alignment and lists" className={groupClass}>
      {([ ["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight], ["justify", AlignJustify] ] as const).map(([align, Icon]) => tool(align[0].toUpperCase() + align.slice(1), <Icon size={16}/>, e => e.chain().focus().setTextAlign(align).run(), { active: selected?.align === align }))}
      {tool("Bullets", <List size={16}/>, e => e.chain().focus().toggleBulletList().run(), { active: selected?.bullets })}
      {tool("Numbering", <ListOrdered size={16}/>, e => e.chain().focus().toggleOrderedList().run(), { active: selected?.numbering })}
    </div>
    <div role="group" aria-label="Paragraph spacing" className={groupClass}>
      <select aria-label="Line spacing" title="Line spacing" disabled={!editor} className={controlClass} value={selected?.lineHeight || "1.5"} onChange={event => editor?.chain().focus().setLineHeight(event.target.value).run()}>{lineHeights.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Paragraph spacing after" disabled={!editor} className={controlClass} value={selected?.spacing || "9pt"} onChange={event => editor?.chain().focus().updateAttributes(selected?.blockType || "paragraph", { spacing: event.target.value }).run()}>{spacings.map(value => <option value={value} key={value}>{value.replace("pt", "")} pt after</option>)}</select>
      {tool("Keep together", null, e => e.chain().focus().updateAttributes(selected?.blockType || "paragraph", { keepTogether: !selected?.keepTogether }).run(), { active: selected?.keepTogether, text: true })}
    </div>
    {tool("Link", <Link2 size={16}/>, e => {
      const value = window.prompt("Link URL (https:// or mailto:). Leave blank to remove the link.", e.getAttributes("link").href || "https://");
      if (value === null) return;
      if (!value.trim()) e.chain().focus().extendMarkRange("link").unsetLink().run();
      else if (/^(https?:\/\/|mailto:)/i.test(value.trim())) e.chain().focus().extendMarkRange("link").setLink({ href: value.trim() }).run();
    }, { active: selected?.link })}
    {selected?.table ? <div role="group" aria-label="Selected table" className="flex flex-wrap items-center gap-1 rounded-md bg-teal-50 p-1">
      <span className="px-1 text-xs font-semibold text-teal-800">Table</span>
      {tool("Add row", null, e => e.chain().focus().addRowAfter().run(), { text: true })}
      {tool("Add column", null, e => e.chain().focus().addColumnAfter().run(), { text: true })}
      {tool("Delete table", null, e => e.chain().focus().deleteTable().run(), { text: true })}
    </div> : null}
  </div>;
}
