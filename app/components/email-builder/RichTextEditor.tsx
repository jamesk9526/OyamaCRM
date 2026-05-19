/**
 * RichTextEditor provides email-friendly rich text editing with optional raw HTML mode.
 */
'use client';

import { useEffect } from 'react';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';

interface RichTextEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  minHeight?: number;
  htmlEnabled?: boolean;
  onToggleHtmlEnabled?: (enabled: boolean) => void;
  htmlLabel?: string;
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
}

/**
 * ToolbarButton standardizes icon-like formatting controls for the rich editor toolbar.
 */
function ToolbarButton({ label, onClick, active = false }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded border px-2 py-1 text-xs font-semibold transition-colors',
        active
          ? 'border-green-600 bg-green-50 text-green-700'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

/**
 * Renders a Tiptap WYSIWYG editor for block content and optionally exposes raw HTML editing.
 */
export default function RichTextEditor({
  value,
  onChange,
  minHeight = 160,
  htmlEnabled = false,
  onToggleHtmlEnabled,
  htmlLabel = 'Enable raw HTML editor',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const setLink = () => {
    if (!editor) return;
    const previousHref = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Enter URL', previousHref ?? 'https://');
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };

  if (htmlEnabled) {
    return (
      <div className="space-y-2">
        {onToggleHtmlEnabled && (
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              checked={htmlEnabled}
              onChange={(event) => onToggleHtmlEnabled(event.target.checked)}
            />
            {htmlLabel}
          </label>
        )}
        <textarea
          className="block w-full rounded border border-gray-200 px-2.5 py-2 font-mono text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {onToggleHtmlEnabled && (
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            checked={htmlEnabled}
            onChange={(event) => onToggleHtmlEnabled(event.target.checked)}
          />
          {htmlLabel}
        </label>
      )}
      <div className="flex flex-wrap gap-1 rounded border border-gray-200 bg-gray-50 p-2">
        <ToolbarButton
          label="B"
          active={!!editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          active={!!editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="U"
          active={!!editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="H1"
          active={!!editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label="H2"
          active={!!editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="H3"
          active={!!editor?.isActive('heading', { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="P"
          active={!!editor?.isActive('paragraph')}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        />
        <ToolbarButton
          label="Bullets"
          active={!!editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbered"
          active={!!editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Quote"
          active={!!editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Link"
          active={!!editor?.isActive('link')}
          onClick={setLink}
        />
        <ToolbarButton
          label="Clear"
          onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
        />
      </div>
      <div
        className="rounded border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
