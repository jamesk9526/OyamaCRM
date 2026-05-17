/** TipTap-based form letter editor with merge-token insertion, print-safe controls, and optional raw HTML mode. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
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

interface FormLetterRichEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  minHeight?: number;
  htmlLabel?: string;
  onRegisterInsert?: (handler: (token: string) => void) => void;
  mergeFields?: string[];
  studioMode?: boolean;
  onUploadImage?: (file: File) => Promise<string>;
}

/** Icon-only toolbar button with native title tooltip. */
function IconBtn({
  title,
  active = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={[
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-green-100 text-green-700 ring-1 ring-inset ring-green-300"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Visual separator between toolbar groups. */
function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-gray-200" />;
}

/** Renders a letters-focused rich editor with merge insertion and print-oriented actions. */
export default function FormLetterRichEditor({
  value,
  onChange,
  placeholder = "Write your letter body...",
  minHeight = 260,
  htmlLabel = "Edit raw HTML",
  onRegisterInsert,
  mergeFields = [],
  studioMode = false,
  onUploadImage,
}: FormLetterRichEditorProps) {
  const [promptMode, setPromptMode] = useState<"link" | "image" | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [htmlMode, setHtmlMode] = useState(false);
  const [mergeQuery, setMergeQuery] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
      updateMergeSuggestion(nextEditor);
    },
    onSelectionUpdate: ({ editor: nextEditor }) => updateMergeSuggestion(nextEditor),
  });

  const editorRef = useRef(editor);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Keep editor content synchronized when parent state updates externally.
  useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  // Register token insertion callback so parent merge-field panels can insert at cursor.
  useEffect(() => {
    if (!onRegisterInsert) return;

    // Insert tokens as inline code to make merge placeholders visually distinct in authoring mode.
    onRegisterInsert((token) => {
      const currentEditor = editorRef.current;
      if (!currentEditor || currentEditor.isDestroyed) return;

      currentEditor
        .chain()
        .focus()
        .insertContent([{ type: "text", text: token, marks: [{ type: "code" }] }])
        .run();
    });
  }, [onRegisterInsert]);

  /** Opens modal prompt for link URL and supports clearing links with an empty value. */
  function handleSetLink() {
    if (!editor) return;
    const previousHref = editor.getAttributes("link").href as string | undefined;
    setPromptMode("link");
    setPromptValue(previousHref ?? "https://");
  }

  /** Reads the text immediately before the cursor so typing "{{" can surface merge tokens inline. */
  function updateMergeSuggestion(nextEditor = editor) {
    if (!nextEditor || mergeFields.length === 0) {
      setMergeQuery(null);
      return;
    }

    const selectionFrom = nextEditor.state.selection.from;
    const textBeforeCursor = nextEditor.state.doc.textBetween(Math.max(0, selectionFrom - 60), selectionFrom, "\n", "\n");
    const match = textBeforeCursor.match(/\{\{[a-zA-Z0-9_.-]*$/);
    setMergeQuery(match ? match[0] : null);
  }

  /** Replaces the in-progress "{{" query with the chosen full merge token. */
  function applyMergeSuggestion(token: string) {
    if (!editor || !mergeQuery) return;
    const to = editor.state.selection.from;
    const from = Math.max(0, to - mergeQuery.length);
    editor.chain().focus().deleteRange({ from, to }).insertContent([{ type: "text", text: token, marks: [{ type: "code" }] }]).run();
    setMergeQuery(null);
  }

  /** Adds common content structures so users can build a printable without knowing HTML. */
  function insertContentBlock(kind: "address" | "receipt" | "callout" | "signature") {
    if (!editor) return;

    if (kind === "address") {
      editor.chain().focus().insertContent("<p>{{donor.fullName}}<br />{{donor.addressLine1}}<br />{{donor.city}}, {{donor.state}} {{donor.zip}}</p>").run();
      return;
    }
    if (kind === "receipt") {
      editor
        .chain()
        .focus()
        .insertContent("<table><tbody><tr><th>Gift Date</th><th>Amount</th><th>Fund</th></tr><tr><td>{{gift.date}}</td><td>{{gift.amount}}</td><td>{{gift.fund}}</td></tr></tbody></table>")
        .run();
      return;
    }
    if (kind === "callout") {
      editor.chain().focus().insertContent('<blockquote><p>Add an impact highlight or donor-specific note here.</p></blockquote>').run();
      return;
    }
    editor.chain().focus().insertContent("<p>Sincerely,</p><p>{{staff.fullName}}<br />{{staff.title}}</p>").run();
  }

  const suggestedFields = useMemo(() => {
    if (!mergeQuery) return [];
    const normalizedQuery = mergeQuery.replace("{{", "").toLowerCase();
    return mergeFields
      .filter((field) => field.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [mergeFields, mergeQuery]);

  /** Inserts a print page-break marker as a semantic horizontal separator for letter layout. */
  function insertPageBreakMarker() {
    if (!editor) return;
    editor.chain().focus().insertContent('<hr data-page-break="true" />').run();
  }

  /** Opens modal prompt to insert an image URL into the letter body. */
  function insertImageFromUrl() {
    if (!editor) return;
    setPromptMode("image");
    setPromptValue("https://");
  }

  /** Uploads a local image and inserts the returned public URL into the document. */
  async function uploadImageFile(file: File | undefined) {
    if (!file || !editor || !onUploadImage) return;
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } finally {
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  }

  /** Applies the active link/image prompt action and closes the dialog. */
  function applyPrompt() {
    if (!editor || !promptMode) return;
    const nextValue = promptValue.trim();

    if (promptMode === "image" && !nextValue) {
      return;
    }

    if (promptMode === "link") {
      if (!nextValue) {
        editor.chain().focus().unsetLink().run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: nextValue }).run();
      }
    }

    if (promptMode === "image") {
      editor.chain().focus().setImage({ src: nextValue }).run();
    }

    setPromptMode(null);
    setPromptValue("");
  }

  return (
    <>
      {/* Editor container: header bar + locked icon ribbon + content area */}
      <div className="overflow-hidden rounded-lg border border-gray-300">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Form Letter Editor</p>
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
            rows={12}
            className="w-full rounded-none border-0 bg-white px-3 py-2 font-mono text-xs outline-none"
          />
        ) : (
          <>
            {/* Home Ribbon — compact icon toolbar locked above the editor */}
            <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50 px-2 py-1.5">
              {/* Text format */}
              <IconBtn title="Bold" active={!!editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
                <span className="font-sans text-[13px] font-black leading-none">B</span>
              </IconBtn>
              <IconBtn title="Italic" active={!!editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                <span className="font-serif text-[13px] font-bold italic leading-none">I</span>
              </IconBtn>
              <IconBtn title="Underline" active={!!editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                <span className="text-[12px] font-bold leading-none underline">U</span>
              </IconBtn>
              <IconBtn title="Clear Formatting" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}>
                {/* Eraser */}
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828zm2.121.707a1 1 0 0 0-1.414 0L9.793 3.914 12.086 6.207l1-1a1 1 0 0 0 0-1.414zM11.379 7.414 9.086 5.121l-5.5 5.5-.043.043 2.828 2.828.043-.043 5.5-5.5z"/>
                </svg>
              </IconBtn>

              <Sep />

              {/* Headings */}
              <IconBtn title="Heading 1" active={!!editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                <span className="text-[10px] font-black leading-none tracking-tight">H1</span>
              </IconBtn>
              <IconBtn title="Heading 2" active={!!editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                <span className="text-[10px] font-black leading-none tracking-tight">H2</span>
              </IconBtn>
              <IconBtn title="Heading 3" active={!!editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
                <span className="text-[10px] font-black leading-none tracking-tight">H3</span>
              </IconBtn>

              <Sep />

              {/* Lists */}
              <IconBtn title="Bullet List" active={!!editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M5 3.5h7V5H5V3.5zm0 4h7V9H5V7.5zm0 4h7V13H5v-1.5zM2 4.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm0 4a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm0 4a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Numbered List" active={!!editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M2 2h1v3H2V3.5h-.5v-1H2V2zm3.5 1.5h7V5h-7V3.5zm0 4h7V9h-7V7.5zm0 4h7V13h-7v-1.5zM2 7.5a1 1 0 0 1 1 1H2v.5h1.5V10H2v.5h1.5V11H2v.5h1.5V13H2v.5H3.5V14H2a1 1 0 0 1-1-1v-4.5a1 1 0 0 1 1-1z"/>
                </svg>
              </IconBtn>

              <Sep />

              {/* Alignment */}
              <IconBtn title="Align Left" active={!!editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M2 3.5h12V5H2V3.5zm0 4h8V9H2V7.5zm0 4h12V13H2v-1.5z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Align Center" active={!!editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M2 3.5h12V5H2V3.5zm2 4h8V9H4V7.5zm-2 4h12V13H2v-1.5z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Align Right" active={!!editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M2 3.5h12V5H2V3.5zm4 4h8V9H6V7.5zm-4 4h12V13H2v-1.5z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Blockquote" active={!!editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M12 12a1 1 0 0 0 1-1V8.558a1 1 0 0 0-1-1h-1.388c0-.351.021-.703.062-1.054.062-.372.166-.703.31-.992s.358-.54.599-.712a1.56 1.56 0 0 1 .866-.27V3c-.61 0-1.148.164-1.618.491a3.4 3.4 0 0 0-1.086.979 4.4 4.4 0 0 0-.617 1.401A6.5 6.5 0 0 0 9 7.558V11a1 1 0 0 0 1 1zm-6 0a1 1 0 0 0 1-1V8.558a1 1 0 0 0-1-1H4.612c0-.351.021-.703.062-1.054.062-.372.166-.703.31-.992s.358-.54.599-.712a1.56 1.56 0 0 1 .866-.27V3c-.61 0-1.148.164-1.618.491a3.4 3.4 0 0 0-1.086.979 4.4 4.4 0 0 0-.617 1.401A6.5 6.5 0 0 0 3 7.558V11a1 1 0 0 0 1 1z"/>
                </svg>
              </IconBtn>

              <Sep />

              {/* Link & Media */}
              <IconBtn title="Link" active={!!editor?.isActive("link")} onClick={handleSetLink}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z"/>
                  <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Insert Image (URL)" onClick={insertImageFromUrl}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
                  <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1z"/>
                </svg>
              </IconBtn>
              {onUploadImage && (
                <IconBtn title="Upload Image" onClick={() => imageFileInputRef.current?.click()}>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
                  </svg>
                </IconBtn>
              )}

              <Sep />

              {/* Table */}
              <IconBtn title="Insert Table" onClick={() => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm15 2h-4v3h4zm0 4h-4v3h4zm0 4h-4v3h3a1 1 0 0 0 1-1zm-5 3v-3H6v3zm-5 0v-3H1v2a1 1 0 0 0 1 1zm-4-4h4V8H1zm0-4h4V4H1zm5-3v3h4V4zm4 4H6v3h4z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Add Row After" onClick={() => editor?.chain().focus().addRowAfter().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9v1h.5a.5.5 0 0 1 0 1H9v1H8v-1H6.5a.5.5 0 0 1 0-1H8v-1H2a2 2 0 0 1-2-2zm8 6v-2H1v2zm1 0h6V6H9zm6-3V2a1 1 0 0 0-1-1H9V5zm-7 0V1H2a1 1 0 0 0-1 1v3zm-1 6v1.5H9.5v1H8.5v-1H7v-1.5h-1V13h1v1h1.5v1H9.5v-1H11v-1.5z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Add Column After" onClick={() => editor?.chain().focus().addColumnAfter().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm1 1v4h4V3zm5 0v4h4V3zm4 5H6v4h4zm0 5H6v2h3a1 1 0 0 0 1-1zm-5 2v-2H1v1a1 1 0 0 0 1 1zm-4-3h4V8H1zm0-5h4V3H1zm12.5 0a.5.5 0 0 1 .5.5v2h2a.5.5 0 0 1 0 1h-2v2a.5.5 0 0 1-1 0v-2h-2a.5.5 0 0 1 0-1h2v-2a.5.5 0 0 1 .5-.5z"/>
                </svg>
              </IconBtn>

              <Sep />

              {/* Page structure */}
              <IconBtn title="Page Break" onClick={insertPageBreakMarker}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path opacity=".4" d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3H1zm0 4h14v2H1zm0 3h14v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/>
                  <path d="M0 7.5h16v1H0z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Horizontal Rule" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M0 7.5h16v1H0z"/>
                  <path opacity=".3" d="M0 4.5h16v1H0zm0 6h16v1H0z"/>
                </svg>
              </IconBtn>

              {studioMode && (
                <>
                  <Sep />
                  {/* Content blocks */}
                  <IconBtn title="Insert Address Block" onClick={() => insertContentBlock("address")}>
                    {/* Envelope */}
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                      <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586zm3.436-.586L16 11.801V4.697z"/>
                    </svg>
                  </IconBtn>
                  <IconBtn title="Insert Gift Table" onClick={() => insertContentBlock("receipt")}>
                    {/* Gift box */}
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                      <path d="M3 2.5a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 5 0v.006c0 .07 0 .27-.038.494H15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 14.5V7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2.038A3 3 0 0 1 3 2.506zm1.068.5H7v-.5a1.5 1.5 0 1 0-2.932.5zM8 3h2.932A1.5 1.5 0 1 0 9 2.5V3zM1 4v2h6V4zm8 0v2h6V4zm5 3H9v8h4.5a.5.5 0 0 0 .5-.5V7zm-7 8V7H2v6.5a.5.5 0 0 0 .5.5z"/>
                    </svg>
                  </IconBtn>
                  <IconBtn title="Insert Callout Block" onClick={() => insertContentBlock("callout")}>
                    {/* Chat bubble */}
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                      <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1zm-2.5 5h-7v1h7V6zm0-3h-7v1h7V3zm0 6h-5v1h5V9z"/>
                    </svg>
                  </IconBtn>
                  <IconBtn title="Insert Signature Block" onClick={() => insertContentBlock("signature")}>
                    {/* Pen */}
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                      <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"/>
                    </svg>
                  </IconBtn>
                </>
              )}

              <Sep />

              {/* History */}
              <IconBtn title="Undo" onClick={() => editor?.chain().focus().undo().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
                  <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
                </svg>
              </IconBtn>
              <IconBtn title="Redo" onClick={() => editor?.chain().focus().redo().run()}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                </svg>
              </IconBtn>

              {/* Text color: A glyph with color swatch underline + hidden color input */}
              <label
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                title="Text Color"
              >
                <div className="flex flex-col items-center gap-px">
                  <span className="text-[12px] font-bold leading-none">A</span>
                  <div className="h-[3px] w-4 rounded-sm bg-current" />
                </div>
                <input
                  type="color"
                  onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
                  className="sr-only"
                  aria-label="Text Color"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <span>Font</span>
              <span>Headings</span>
              <span>Lists</span>
              <span>Paragraph</span>
              <span>Insert</span>
              <span>Table</span>
              <span>Page</span>
              {studioMode && <span>Form Blocks</span>}
              <span>History</span>
            </div>

            {onUploadImage && (
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="sr-only"
                onChange={(event) => void uploadImageFile(event.target.files?.[0])}
              />
            )}

            {/* Editor content area */}
            <div className="relative">
              {suggestedFields.length > 0 && (
                <div className="absolute left-8 top-4 z-20 w-72 rounded-lg border border-green-200 bg-white p-2 shadow-lg">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-green-700">Merge Fields</p>
                  <div className="max-h-56 overflow-auto">
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
                  </div>
                </div>
              )}
              <div
                className="bg-white px-3 py-3 text-sm text-gray-800 [&_.ProseMirror]:min-h-[220px] [&_.ProseMirror]:outline-none [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-green-200 [&_.ProseMirror_blockquote]:bg-green-50 [&_.ProseMirror_blockquote]:px-4 [&_.ProseMirror_blockquote]:py-2 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-green-50 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:text-green-700 [&_.ProseMirror_hr[data-page-break='true']]:my-6 [&_.ProseMirror_hr[data-page-break='true']]:border-t-2 [&_.ProseMirror_hr[data-page-break='true']]:border-dashed [&_.ProseMirror_hr[data-page-break='true']]:border-gray-400 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:bg-gray-50 [&_.ProseMirror_th]:p-2"
                style={{ minHeight }}
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          </>
        )}
      </div>

      {promptMode && (
        <WorkspaceSetupModal
          title={promptMode === "link" ? "Insert Link" : "Insert Image"}
          subtitle={promptMode === "link"
            ? "Add or update the selected link. Leave the field blank to remove an existing link."
            : "Add an image URL for logos, signatures, or supporting visuals in this letter."}
          onClose={() => {
            setPromptMode(null);
            setPromptValue("");
          }}
          maxWidthClassName="max-w-lg"
        >
          <div className="px-6 pb-6 pt-14 space-y-4">
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
