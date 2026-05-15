/** TipTap-based form letter editor with merge-token insertion, print-safe controls, and optional raw HTML mode. */
"use client";

import { useEffect, useRef, useState } from "react";
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
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
}

/** Reusable toolbar button for grouped editor actions. */
function ToolbarButton({ label, active = false, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
        active
          ? "border-green-600 bg-green-50 text-green-700"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/** Renders a letters-focused rich editor with merge insertion and print-oriented actions. */
export default function FormLetterRichEditor({
  value,
  onChange,
  placeholder = "Write your letter body...",
  minHeight = 260,
  htmlLabel = "Edit raw HTML",
  onRegisterInsert,
}: FormLetterRichEditorProps) {
  const [promptMode, setPromptMode] = useState<"link" | "image" | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [htmlMode, setHtmlMode] = useState(false);

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
    },
  });

  const editorRef = useRef(editor);

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
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Form Letter Editor</p>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={htmlMode}
            onChange={(event) => setHtmlMode(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-green-600"
          />
          {htmlLabel}
        </label>
      </div>

      {htmlMode ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={12}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-xs"
        />
      ) : (
        <>
          <div className="sticky top-2 z-10 rounded border border-gray-300 bg-gradient-to-b from-white to-gray-50 p-2 shadow-sm">
            <div className="mb-2 border-b border-gray-200 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Home Ribbon</p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1">
                <ToolbarButton label="Bold" active={!!editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} />
                <ToolbarButton label="Italic" active={!!editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} />
                <ToolbarButton label="Underline" active={!!editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
                <ToolbarButton label="Clear" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} />
              </div>

              <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1">
                <ToolbarButton label="H1" active={!!editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} />
                <ToolbarButton label="H2" active={!!editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
                <ToolbarButton label="H3" active={!!editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
                <ToolbarButton label="Bullets" active={!!editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
                <ToolbarButton label="Numbered" active={!!editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
              </div>

              <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1">
                <ToolbarButton label="Left" active={!!editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
                <ToolbarButton label="Center" active={!!editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
                <ToolbarButton label="Right" active={!!editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()} />
                <ToolbarButton label="Quote" active={!!editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
              </div>

              <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1">
                <ToolbarButton label="Link" active={!!editor?.isActive("link")} onClick={handleSetLink} />
                <ToolbarButton label="Image" onClick={insertImageFromUrl} />
                <ToolbarButton label="Table" onClick={() => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()} />
                <ToolbarButton label="Add Row" onClick={() => editor?.chain().focus().addRowAfter().run()} />
                <ToolbarButton label="Add Col" onClick={() => editor?.chain().focus().addColumnAfter().run()} />
                <ToolbarButton label="Page Break" onClick={insertPageBreakMarker} />
                <ToolbarButton label="HR" onClick={() => editor?.chain().focus().setHorizontalRule().run()} />
              </div>

              <div className="ml-auto flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1">
                <ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} />
                <ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} />
                <label className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
                  Text Color
                  <input
                    type="color"
                    onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
                    className="h-5 w-7 rounded border border-gray-300"
                  />
                </label>
              </div>
            </div>
          </div>

          <div
            className="rounded border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800 [&_.ProseMirror]:min-h-[220px] [&_.ProseMirror]:outline-none [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-green-50 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:text-green-700 [&_.ProseMirror_hr[data-page-break='true']]:my-6 [&_.ProseMirror_hr[data-page-break='true']]:border-t-2 [&_.ProseMirror_hr[data-page-break='true']]:border-dashed [&_.ProseMirror_hr[data-page-break='true']]:border-gray-400"
            style={{ minHeight }}
          >
            <EditorContent editor={editor} />
          </div>
        </>
      )}

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
    </div>
  );
}
