/** useOGenticChat manages OGentic workspace prompt drafts and local chat-session metadata. */
"use client";

import { useMemo, useState } from "react";

/** useOGenticChat exposes lightweight workspace chat/session state for the OGentic shell. */
export function useOGenticChat(initialPrompt = "") {
  const [draft, setDraft] = useState(initialPrompt);
  const [chatTitle, setChatTitle] = useState("Workspace Chat 1");

  const canSubmit = useMemo(() => draft.trim().length > 0, [draft]);

  /** Resets the current prompt draft and generates a new chat title shell. */
  function startNewChat() {
    const nextLabel = `Workspace Chat ${Math.floor(Math.random() * 999) + 2}`;
    setChatTitle(nextLabel);
    setDraft("");
  }

  return {
    draft,
    setDraft,
    chatTitle,
    canSubmit,
    startNewChat,
  };
}
