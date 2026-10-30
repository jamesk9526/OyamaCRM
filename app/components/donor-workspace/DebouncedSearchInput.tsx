"use client";

import { useEffect, useRef, useState } from "react";

/** Keep typing local; only settled searches change the URL and trigger API reads. */
export default function DebouncedSearchInput({ value, onSearch, placeholder, id }: {
  value: string;
  onSearch: (value: string) => void;
  placeholder: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const latestSearch = useRef(onSearch);
  useEffect(() => { latestSearch.current = onSearch; }, [onSearch]);

  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }
  function schedule(next: string) {
    cancel();
    if (composing.current) return;
    if (!next) latestSearch.current("");
    else timer.current = setTimeout(() => latestSearch.current(next), 300);
  }
  useEffect(() => {
    cancel();
    setDraft(value);
  }, [value]);
  useEffect(() => () => cancel(), []);

  return <input id={id} type="search" value={draft} placeholder={placeholder}
    onChange={(event) => { setDraft(event.target.value); schedule(event.target.value); }}
    onCompositionStart={() => { composing.current = true; cancel(); }}
    onCompositionEnd={(event) => { composing.current = false; schedule(event.currentTarget.value); }}
    onKeyDown={(event) => {
      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
        event.preventDefault();
        cancel();
        latestSearch.current(draft);
      }
    }} />;
}
