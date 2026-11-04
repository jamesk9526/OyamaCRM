"use client";
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Search } from "lucide-react";
export type NativeEditorState = { dirty: boolean; save: () => Promise<boolean> };
/** Builder chrome never styles authored email HTML. */
export function EmailCanvas({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <main {...props} className={`order-2 flex min-h-[60dvh] min-w-0 flex-1 flex-col overflow-auto border-r border-slate-200 bg-[#edf4fc] lg:order-none lg:min-h-0 ${className}`}/>;
}
export function EmailInspector({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <aside {...props} className={`order-3 flex max-h-[55dvh] w-full flex-none flex-col overflow-hidden bg-white lg:order-none lg:max-h-none lg:w-[350px] xl:w-[380px] ${className}`}/>;
}
export function EmailBlockLibrary({ children, search, onSearch }: { children: ReactNode; search: string; onSearch: (value: string) => void }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-5"><label className="mb-5 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Search email blocks" value={search} onChange={event => onSearch(event.target.value)} placeholder="Search blocks and layouts…" className="h-10 w-full border-0 bg-transparent text-sm outline-none"/></label>{children}</div>;
}
export function useEmailDocumentHistory<T>(document: T, dirty: boolean, apply: (value: T) => void) {
  const previous = useRef(document), travelling = useRef(false);
  const [past, setPast] = useState<T[]>([]), [future, setFuture] = useState<T[]>([]);
  useEffect(() => {
    if (previous.current === document) return;
    if (travelling.current) { travelling.current = false; previous.current = document; return; }
    if (dirty) { const old = previous.current; setPast(items => [...items.slice(-49), old]); setFuture([]); }
    previous.current = document;
  }, [document, dirty]);
  function move(undo: boolean) {
    const stack = undo ? past : future, next = stack.at(-1); if (!next) return;
    travelling.current = true;
    if (undo) { setPast(stack.slice(0, -1)); setFuture(items => [...items, document]); }
    else { setFuture(stack.slice(0, -1)); setPast(items => [...items, document]); }
    apply(next);
  }
  return { canUndo: !!past.length, canRedo: !!future.length, undo: () => move(true), redo: () => move(false) };
}
