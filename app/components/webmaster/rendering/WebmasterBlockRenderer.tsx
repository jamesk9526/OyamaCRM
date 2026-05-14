/** Renders one webmaster block in edit, preview, or published modes. */
"use client";

import { useMemo } from "react";
import type { BlockInstance } from "@/app/modules/webmaster/schema";

interface WebmasterBlockRendererProps {
  block: BlockInstance;
  mode: "edit" | "preview" | "published";
  selected: boolean;
  onSelect?: () => void;
  onUpdateContent?: (patch: Record<string, unknown>) => void;
}

function toDisplayText(block: BlockInstance): string {
  if (typeof block.content.text === "string") return block.content.text;
  if (typeof block.content.question === "string") return block.content.question;
  return block.type;
}

/** Block renderer prioritizes visitor-like output while preserving edit affordances on selection. */
export default function WebmasterBlockRenderer({
  block,
  mode,
  selected,
  onSelect,
  onUpdateContent,
}: WebmasterBlockRendererProps) {
  const level = useMemo(() => String(block.content.level ?? "p").toLowerCase(), [block.content.level]);
  const editable = mode === "edit" && selected;

  const shellClass = [
    "rounded-md transition outline-none",
    mode === "edit" ? "cursor-pointer" : "cursor-default",
    mode === "edit" && selected ? "ring-2 ring-emerald-400 ring-offset-2 bg-white/90" : "",
  ].join(" ");

  if (block.type === "image") {
    const src = String(block.content.src ?? "").trim();
    const alt = String(block.content.alt ?? "Website image");

    return (
      <div className={shellClass} onClick={onSelect}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="w-full rounded-lg border border-slate-200" />
        ) : (
          <div className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-100 px-4 py-10 text-center text-sm text-slate-500">
            Image placeholder
          </div>
        )}
      </div>
    );
  }

  if (block.type === "button") {
    const text = String(block.content.text ?? "Button");
    const href = String(block.content.href ?? "#");

    return (
      <div className={shellClass} onClick={onSelect}>
        <a
          href={href || "#"}
          onClick={(event) => {
            if (mode === "edit") event.preventDefault();
          }}
          className="inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          contentEditable={editable}
          suppressContentEditableWarning
          onBlur={(event) => {
            if (!onUpdateContent) return;
            onUpdateContent({ text: event.currentTarget.textContent ?? text });
          }}
        >
          {text}
        </a>
      </div>
    );
  }

  if (block.type === "faq-item") {
    const question = String(block.content.question ?? "Question");
    const answer = String(block.content.answer ?? "Answer");

    return (
      <div className={shellClass} onClick={onSelect}>
        <p className="text-base font-semibold text-slate-900">{question}</p>
        <p className="mt-1 text-sm text-slate-600">{answer}</p>
      </div>
    );
  }

  const text = toDisplayText(block);
  const commonProps = {
    className: shellClass,
    onClick: onSelect,
    contentEditable: editable,
    suppressContentEditableWarning: true,
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      if (!onUpdateContent) return;
      onUpdateContent({ text: event.currentTarget.textContent ?? text });
    },
  };

  if (level === "h1") return <h1 {...commonProps} className={`${shellClass} text-4xl font-bold text-slate-900`}>{text}</h1>;
  if (level === "h2") return <h2 {...commonProps} className={`${shellClass} text-3xl font-bold text-slate-900`}>{text}</h2>;
  if (level === "h3") return <h3 {...commonProps} className={`${shellClass} text-2xl font-semibold text-slate-900`}>{text}</h3>;
  if (level === "h4") return <h4 {...commonProps} className={`${shellClass} text-xl font-semibold text-slate-900`}>{text}</h4>;

  return <p {...commonProps} className={`${shellClass} text-base leading-7 text-slate-700`}>{text}</p>;
}
