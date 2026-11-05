"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function SurveyDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); trigger?.focus(); };
  }, []);
  return <dialog className="survey-dialog" ref={dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="survey-stack">
      <div className="survey-heading"><h2 id={heading}>{title}</h2><button type="button" className="survey-btn" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div>
      {children}
    </div>
  </dialog>;
}
