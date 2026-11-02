"use client";

import { useEffect } from "react";
import { Extension, Node, mergeAttributes, type JSONContent, type Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";

export const MergeField = Node.create({
  name: "mergeField", group: "inline", inline: true, atom: true,
  addAttributes: () => ({ token: { default: "", parseHTML: element => element.getAttribute("data-token") }, label: { default: "" } }),
  parseHTML: () => [{ tag: "span[data-merge-field]" }],
  renderHTML: ({ node }) => ["span", { "data-merge-field": "", "data-token": node.attrs.token, class: "letter-merge-field", contenteditable: "false" }, `{{${node.attrs.token}}}`],
  renderText: ({ node }) => `{{${node.attrs.token}}}`,
});
const PageBreak = Node.create({
  name: "letterPageBreak", group: "block", atom: true,
  parseHTML: () => [{ tag: "div[data-letter-page-break]" }],
  renderHTML: () => ["div", { "data-letter-page-break": "true", class: "letter-page-break" }, "Page break"],
});
const Spacer = Node.create({
  name: "letterSpacer", group: "block", atom: true,
  addAttributes: () => ({ height: { default: "12pt", parseHTML: element => element.style.height || "12pt" } }),
  parseHTML: () => [{ tag: "div[data-letter-spacer]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-letter-spacer": "true", style: `height:${HTMLAttributes.height}` })],
});
const ParagraphLayout = Extension.create({
  name: "letterParagraphLayout",
  addGlobalAttributes: () => [{ types: ["paragraph", "heading", "blockquote", "image"], attributes: {
    spacing: { default: null, parseHTML: element => element.style.marginBottom || null, renderHTML: attributes => attributes.spacing ? { style: `margin-bottom:${attributes.spacing}` } : {} },
    keepTogether: { default: false, parseHTML: element => element.hasAttribute("data-keep-together"), renderHTML: attributes => attributes.keepTogether ? { "data-keep-together": "true" } : {} },
  } }],
});
const LetterImage = Image.extend({
  addAttributes() { return { ...this.parent?.(), width: { default: null, parseHTML: element => element.style.width || element.getAttribute("width"), renderHTML: attributes => attributes.width ? { style: `width:${attributes.width}` } : {} } }; },
});

export function tokenizeMergeFields(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: globalThis.Node[] = [];
  while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest("[data-merge-field]")) continue;
    const value = node.textContent || "";
    const pattern = /\{\{\s*([\w.]+)\s*\}\}/g;
    if (!pattern.test(value)) continue;
    pattern.lastIndex = 0;
    const fragment = document.createDocumentFragment(); let offset = 0;
    for (const match of value.matchAll(pattern)) {
      fragment.append(value.slice(offset, match.index));
      const span = document.createElement("span"); span.setAttribute("data-merge-field", ""); span.setAttribute("data-token", match[1]); span.textContent = `{{${match[1]}}}`; fragment.append(span);
      offset = (match.index ?? 0) + match[0].length;
    }
    fragment.append(value.slice(offset)); node.parentNode?.replaceChild(fragment, node);
  }
  return document.body.innerHTML;
}

export function conversionWarnings(html: string): string[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const warnings: string[] = [];
  if (document.querySelector("iframe,script,style,video,svg,input,form")) warnings.push("Embedded scripts, forms, stylesheets, and unsupported media are removed.");
  if (/position\s*:|display\s*:\s*(flex|grid)|float\s*:/i.test(html)) warnings.push("Positioned or floating layouts become normal document flow.");
  if (/Calibri|Arial|Helvetica|Times New Roman|Georgia/i.test(html)) warnings.push("Legacy fonts map to packaged Inter or Noto Serif for consistent output.");
  if (/data-letter-signature/i.test(html)) warnings.push("Review the imported signature and its grouping in the PDF proof.");
  return warnings;
}

export default function LetterEditor({ initialContent, onChange, onReady }: {
  initialContent: JSONContent | string;
  onChange: (html: string, document: JSONContent) => void;
  onReady: (editor: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), TextStyleKit, TextAlign.configure({ types: ["heading", "paragraph"] }), LetterImage.configure({ allowBase64: true }), TableKit.configure({ table: { resizable: true } }), MergeField, PageBreak, Spacer, ParagraphLayout],
    content: typeof initialContent === "string" ? tokenizeMergeFields(initialContent) : initialContent,
    editorProps: { attributes: { role: "textbox", "aria-label": "Letter content", "aria-multiline": "true", class: "letter-rich-editor min-h-[550px] outline-none" }, transformPastedHTML: tokenizeMergeFields },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getJSON()),
  });
  useEffect(() => { if (editor) onReady(editor); }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}
