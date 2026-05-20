/** Focused TipTap letter editor with slash commands, merge-token insertion, and external formatting controls. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Color from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-text-style/font-family";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import Image from "@tiptap/extension-image";
import { LineHeight } from "@tiptap/extension-text-style/line-height";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import LetterBuilderIcon, { type LetterBuilderIconName } from "@/app/components/letters/LetterBuilderIcon";

export interface LetterEditorCommands {
  setParagraph: () => void;
  setHeading: () => void;
  toggleList: () => void;
  toggleQuote: () => void;
  insertImage: () => void;
  insertTable: () => void;
  insertDivider: () => void;
  insertVariable: (token: string) => void;
  insertBlock: (kind: LetterInsertBlockKind) => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrike: () => void;
  toggleCode: () => void;
  setColor: (color: string) => void;
  setAlignment: (alignment: "left" | "center" | "right" | "justify") => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: string) => void;
  setLineHeight: (lineHeight: string) => void;
  clearFormatting: () => void;
}

export type LetterInsertBlockKind =
  | "heading"
  | "text"
  | "list"
  | "quote"
  | "image"
  | "table"
  | "divider"
  | "variable"
  | "header"
  | "footer"
  | "signature"
  | "social"
  | "callout"
  | "donationSummary"
  | "receipt"
  | "organization"
  | "campaign"
  | "event";

interface FormLetterRichEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  minHeight?: number;
  htmlLabel?: string;
  onRegisterInsert?: (handler: (token: string) => void) => void;
  onRegisterCommands?: (commands: LetterEditorCommands | null) => void;
  mergeFields?: string[];
  onUploadImage?: (file: File) => Promise<string>;
  floatingToolbarTopClassName?: string;
}

const SLASH_COMMANDS: Array<{ command: string; label: string; action: LetterInsertBlockKind | "ai" | "donorName" | "giftAmount" | "giftDate" | "organizationName" }> = [
  { command: "/heading", label: "Heading", action: "heading" },
  { command: "/text", label: "Text", action: "text" },
  { command: "/list", label: "List", action: "list" },
  { command: "/quote", label: "Quote", action: "quote" },
  { command: "/image", label: "Image", action: "image" },
  { command: "/table", label: "Table", action: "table" },
  { command: "/divider", label: "Divider", action: "divider" },
  { command: "/variable", label: "Variable", action: "variable" },
  { command: "/donor-name", label: "Donor first name", action: "donorName" },
  { command: "/gift-amount", label: "Gift amount", action: "giftAmount" },
  { command: "/gift-date", label: "Gift date", action: "giftDate" },
  { command: "/organization-name", label: "Organization name", action: "organizationName" },
  { command: "/signature", label: "Signature", action: "signature" },
  { command: "/header", label: "Header", action: "header" },
  { command: "/footer", label: "Footer", action: "footer" },
  { command: "/ai-write", label: "AI write prompt", action: "ai" },
];

/** Renders a calm document editor while exposing command hooks to the surrounding builder panels. */
export default function FormLetterRichEditor({
  value,
  onChange,
  placeholder = "Write your letter body...",
  minHeight = 560,
  htmlLabel = "Edit raw HTML",
  onRegisterInsert,
  onRegisterCommands,
  mergeFields = [],
  onUploadImage,
  floatingToolbarTopClassName = "top-2",
}: FormLetterRichEditorProps) {
  const [promptMode, setPromptMode] = useState<"link" | "image" | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [htmlMode, setHtmlMode] = useState(false);
  const [mergeQuery, setMergeQuery] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      LineHeight,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "data-testid": "letter-editor-canvas",
        class:
          "min-h-[520px] outline-none text-[12pt] leading-[1.6] text-gray-900 focus:outline-none [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-green-200 [&_blockquote]:bg-green-50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_code]:rounded [&_code]:bg-green-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-green-700 [&_h1]:my-3 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h2]:my-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h3]:my-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-tight [&_hr[data-page-break='true']]:my-6 [&_hr[data-page-break='true']]:border-t-2 [&_hr[data-page-break='true']]:border-dashed [&_hr[data-page-break='true']]:border-gray-400 [&_img]:h-auto [&_img]:max-w-full [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
      updateInlineMenus(nextEditor);
    },
    onSelectionUpdate: ({ editor: nextEditor }) => updateInlineMenus(nextEditor),
  });

  const editorRef = useRef(editor);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!onRegisterInsert) return;
    onRegisterInsert((token) => insertVariableToken(token));
  }, [onRegisterInsert]);

  useEffect(() => {
    if (!onRegisterCommands || !editor) {
      onRegisterCommands?.(null);
      return;
    }

    const commands: LetterEditorCommands = {
      setParagraph: () => editor.chain().focus().setParagraph().run(),
      setHeading: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      toggleList: () => editor.chain().focus().toggleBulletList().run(),
      toggleQuote: () => editor.chain().focus().toggleBlockquote().run(),
      insertImage: () => insertImageFromUrl(),
      insertTable: () => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(),
      insertDivider: () => editor.chain().focus().setHorizontalRule().run(),
      insertVariable: (token: string) => insertVariableToken(token),
      insertBlock: (kind: LetterInsertBlockKind) => insertContentBlock(kind),
      toggleBold: () => editor.chain().focus().toggleBold().run(),
      toggleItalic: () => editor.chain().focus().toggleItalic().run(),
      toggleUnderline: () => editor.chain().focus().toggleUnderline().run(),
      toggleStrike: () => editor.chain().focus().toggleStrike().run(),
      toggleCode: () => editor.chain().focus().toggleCode().run(),
      setColor: (color: string) => editor.chain().focus().setColor(color).run(),
      setAlignment: (alignment: "left" | "center" | "right" | "justify") => editor.chain().focus().setTextAlign(alignment).run(),
      setFontFamily: (fontFamily: string) => editor.chain().focus().setFontFamily(fontFamily).run(),
      setFontSize: (fontSize: string) => editor.chain().focus().setFontSize(fontSize).run(),
      setLineHeight: (lineHeight: string) => editor.chain().focus().setLineHeight(lineHeight).run(),
      clearFormatting: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    };

    onRegisterCommands(commands);
    return () => onRegisterCommands(null);
  }, [editor, onRegisterCommands]);

  const suggestedFields = useMemo(() => {
    if (!mergeQuery) return [];
    const normalizedQuery = mergeQuery.replace("{{", "").toLowerCase();
    return mergeFields.filter((field) => field.toLowerCase().includes(normalizedQuery)).slice(0, 8);
  }, [mergeFields, mergeQuery]);

  const suggestedSlashCommands = useMemo(() => {
    if (!slashQuery) return [];
    const normalizedQuery = slashQuery.toLowerCase();
    return SLASH_COMMANDS.filter((item) => item.command.startsWith(normalizedQuery)).slice(0, 8);
  }, [slashQuery]);

  /** Tracks lightweight command menus without forcing permanent toolbar rows into the document. */
  function updateInlineMenus(nextEditor = editor) {
    if (!nextEditor) {
      setMergeQuery(null);
      setSlashQuery(null);
      return;
    }

    const selectionFrom = nextEditor.state.selection.from;
    const textBeforeCursor = nextEditor.state.doc.textBetween(Math.max(0, selectionFrom - 80), selectionFrom, "\n", "\n");
    const mergeMatch = textBeforeCursor.match(/\{\{[a-zA-Z0-9_.-]*$/);
    const slashMatch = textBeforeCursor.match(/(^|\s)(\/[a-zA-Z-]*)$/);
    setMergeQuery(mergeMatch ? mergeMatch[0] : null);
    setSlashQuery(slashMatch ? slashMatch[2] : null);
  }

  /** Inserts merge fields as inline code tokens so authors can distinguish variables from static copy. */
  function insertVariableToken(token: string) {
    const currentEditor = editorRef.current;
    if (!currentEditor || currentEditor.isDestroyed) return;

    currentEditor.chain().focus().insertContent([{ type: "text", text: token, marks: [{ type: "code" }] }]).run();
  }

  /** Replaces an in-progress merge query with the selected full token. */
  function applyMergeSuggestion(token: string) {
    if (!editor || !mergeQuery) return;
    const to = editor.state.selection.from;
    const from = Math.max(0, to - mergeQuery.length);
    editor.chain().focus().deleteRange({ from, to }).insertContent([{ type: "text", text: token, marks: [{ type: "code" }] }]).run();
    setMergeQuery(null);
  }

  /** Deletes the slash trigger and applies the selected command at the cursor. */
  function applySlashCommand(item: (typeof SLASH_COMMANDS)[number]) {
    if (!editor || !slashQuery) return;
    const to = editor.state.selection.from;
    const from = Math.max(0, to - slashQuery.length);
    editor.chain().focus().deleteRange({ from, to }).run();

    if (item.action === "ai") {
      setShowAiPrompt(true);
      setSlashQuery(null);
      return;
    }
    if (item.action === "donorName") insertVariableToken("{{donor.firstName}}");
    else if (item.action === "giftAmount") insertVariableToken("{{gift.amount}}");
    else if (item.action === "giftDate") insertVariableToken("{{gift.date}}");
    else if (item.action === "organizationName") insertVariableToken("{{organization.name}}");
    else insertContentBlock(item.action);

    setSlashQuery(null);
  }

  /** Adds common printable content structures through the same command surface used by the side panels. */
  function insertContentBlock(kind: LetterInsertBlockKind) {
    if (!editor) return;

    if (kind === "heading") {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      return;
    }
    if (kind === "text") {
      editor.chain().focus().setParagraph().insertContent("<p>Start writing here.</p>").run();
      return;
    }
    if (kind === "list") {
      editor.chain().focus().toggleBulletList().run();
      return;
    }
    if (kind === "quote") {
      editor.chain().focus().toggleBlockquote().insertContent("<p>Add a meaningful quote or impact note here.</p>").run();
      return;
    }
    if (kind === "image") {
      insertImageFromUrl();
      return;
    }
    if (kind === "table") {
      editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
      return;
    }
    if (kind === "divider") {
      editor.chain().focus().setHorizontalRule().run();
      return;
    }
    if (kind === "variable") {
      insertVariableToken("{{donor.firstName}}");
      return;
    }
    if (kind === "header") {
      editor.chain().focus().insertContent("<h2>{{organization.name}}</h2><p>{{organization.website}}</p>").run();
      return;
    }
    if (kind === "footer") {
      editor.chain().focus().insertContent("<p>{{organization.name}} | {{organization.website}}</p>").run();
      return;
    }
    if (kind === "signature") {
      editor.chain().focus().insertContent("<p>Warm regards,</p><p>{{staff.fullName}}<br />{{staff.title}}</p>").run();
      return;
    }
    if (kind === "social") {
      editor.chain().focus().insertContent("<p>Connect with us: {{organization.website}}</p>").run();
      return;
    }
    if (kind === "callout") {
      editor.chain().focus().insertContent("<blockquote><p>Add an impact highlight or donor-specific note here.</p></blockquote>").run();
      return;
    }
    if (kind === "donationSummary" || kind === "receipt") {
      editor
        .chain()
        .focus()
        .insertContent("<table><tbody><tr><th>Gift Date</th><th>Amount</th><th>Fund</th></tr><tr><td>{{gift.date}}</td><td>{{gift.amount}}</td><td>{{gift.fund}}</td></tr></tbody></table>")
        .run();
      return;
    }
    if (kind === "organization") {
      editor.chain().focus().insertContent("<p>{{organization.name}}<br />{{organization.mission}}</p>").run();
      return;
    }
    if (kind === "campaign") {
      editor.chain().focus().insertContent("<p>Your support for {{gift.campaign}} advances this important work.</p>").run();
      return;
    }
    editor.chain().focus().insertContent("<p>Event: {{event.name}}</p>").run();
  }

  function handleSetLink() {
    if (!editor) return;
    const previousHref = editor.getAttributes("link").href as string | undefined;
    setPromptMode("link");
    setPromptValue(previousHref ?? "https://");
  }

  function insertImageFromUrl() {
    if (!editor) return;
    setPromptMode("image");
    setPromptValue("https://");
  }

  async function uploadImageFile(file: File | undefined) {
    if (!file || !editor || !onUploadImage) return;
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } finally {
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  }

  function applyPrompt() {
    if (!editor || !promptMode) return;
    const nextValue = promptValue.trim();

    if (promptMode === "image" && !nextValue) return;

    if (promptMode === "link") {
      if (!nextValue) editor.chain().focus().unsetLink().run();
      else editor.chain().focus().extendMarkRange("link").setLink({ href: nextValue }).run();
    }

    if (promptMode === "image") {
      editor.chain().focus().setImage({ src: nextValue }).run();
    }

    setPromptMode(null);
    setPromptValue("");
  }

  function insertAiDraft() {
    const prompt = aiPrompt.trim();
    if (!editor || !prompt) return;
    editor
      .chain()
      .focus()
      .insertContent(`<blockquote><p><strong>AI draft request:</strong> ${escapeHtml(prompt)}</p><p>Review and replace this note with approved AI-generated copy before publishing.</p></blockquote>`)
      .run();
    setAiPrompt("");
    setShowAiPrompt(false);
  }

  return (
    <>
      <div className="relative">
        {!htmlMode && (
          <div
            data-testid="letter-floating-command-bar"
            className={`sticky ${floatingToolbarTopClassName} z-20 mx-auto mb-4 flex w-fit flex-wrap items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-lg shadow-gray-200/70 backdrop-blur`}
          >
            <CommandButton icon="text" label="Text" onClick={() => editor?.chain().focus().setParagraph().run()} />
            <CommandButton icon="heading" label="Heading" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
            <CommandButton icon="list" label="List" onClick={() => editor?.chain().focus().toggleBulletList().run()} />
            <CommandButton icon="quote" label="Quote" onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
            <CommandButton icon="image" label="Image" onClick={insertImageFromUrl} />
            <CommandButton icon="table" label="Table" onClick={() => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()} />
            <CommandButton icon="divider" label="Divider" onClick={() => editor?.chain().focus().setHorizontalRule().run()} />
            <CommandButton icon="variable" label="Variable" onClick={() => insertVariableToken("{{donor.firstName}}")} />
            <CommandButton icon="ai" label="AI Write" onClick={() => setShowAiPrompt(true)} accent />
          </div>
        )}

        <div className="mb-3 flex justify-end">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={htmlMode}
              onChange={(event) => setHtmlMode(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-green-600"
            />
            {htmlLabel}
          </label>
        </div>

        {htmlMode ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={18}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-green-400"
          />
        ) : (
          <div className="relative">
            {suggestedFields.length > 0 && (
              <InlineMenu title="Merge Fields" className="left-6 top-4">
                {suggestedFields.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyMergeSuggestion(field);
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left font-mono text-xs text-gray-700 hover:bg-green-50"
                  >
                    {field}
                  </button>
                ))}
              </InlineMenu>
            )}

            {suggestedSlashCommands.length > 0 && (
              <InlineMenu title="Commands" className="left-6 top-4">
                {suggestedSlashCommands.map((item) => (
                  <button
                    key={item.command}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applySlashCommand(item);
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-green-50"
                  >
                    <span className="font-mono text-green-700">{item.command}</span>
                    <span className="ml-2 text-gray-500">{item.label}</span>
                  </button>
                ))}
              </InlineMenu>
            )}

            {onUploadImage && (
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="sr-only"
                onChange={(event) => void uploadImageFile(event.target.files?.[0])}
              />
            )}

            <div className="bg-white" style={{ minHeight }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        )}

        {showAiPrompt && (
          <div className="sticky bottom-4 z-30 mx-auto mt-4 flex max-w-xl items-center gap-2 rounded-xl bg-gray-950 p-2 text-white shadow-xl">
            <input
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertAiDraft();
                }
              }}
              autoFocus
              placeholder="Ask AI to edit or write..."
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-gray-300"
            />
            <button type="button" onClick={insertAiDraft} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-950 hover:bg-gray-100">
              Insert
            </button>
            <button type="button" onClick={() => setShowAiPrompt(false)} className="rounded-lg px-2 py-2 text-xs text-gray-300 hover:bg-white/10">
              Close
            </button>
          </div>
        )}
      </div>

      {promptMode && (
        <WorkspaceSetupModal
          title={promptMode === "link" ? "Insert Link" : "Insert Image"}
          subtitle={promptMode === "link" ? "Add or update the selected link. Leave the field blank to remove an existing link." : "Add an image URL for logos, signatures, or supporting visuals in this letter."}
          onClose={() => {
            setPromptMode(null);
            setPromptValue("");
          }}
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-4 px-6 pb-6 pt-14">
            <label className="block text-sm font-medium text-gray-700">
              {promptMode === "link" ? "URL" : "Image URL"}
              <input
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyPrompt();
                  }
                }}
                autoFocus
                placeholder="https://"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPromptMode(null);
                  setPromptValue("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyPrompt}
                disabled={promptMode === "image" && !promptValue.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {promptMode === "link" ? "Apply Link" : "Insert Image"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </>
  );
}

function CommandButton({ icon, label, onClick, accent = false }: { icon: LetterBuilderIconName; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium ${accent ? "text-green-700 hover:bg-green-50" : "text-gray-700 hover:bg-gray-100"}`}
    >
      <LetterBuilderIcon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function InlineMenu({ title, className, children }: { title: string; className: string; children: React.ReactNode }) {
  return (
    <div className={`absolute z-30 w-80 rounded-xl border border-green-200 bg-white p-2 shadow-lg ${className}`}>
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase text-green-700">{title}</p>
      <div className="max-h-60 overflow-auto">{children}</div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
