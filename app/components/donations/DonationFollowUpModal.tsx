"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import NewTaskModal from "@/app/components/tasks/NewTaskModal";
import type { Task } from "@/app/components/tasks/task-types";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import { formatCurrency, formatDonationDate } from "./donation-utils";

interface Gift { id: string; amount: string; date: string; constituent: { id: string; firstName: string; lastName: string } }
export default function DonationFollowUpModal({ donationId, newlyRecorded = false, onClose }: { donationId: string; newlyRecorded?: boolean; onClose: () => void }) {
  const [gift, setGift] = useState<Gift | null>(null); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(!newlyRecorded); const [task, setTask] = useState<Task | null>(null);
  useEffect(() => { let active = true; setError(""); apiFetch<Gift>(`/api/donations/${encodeURIComponent(donationId)}`).then((result) => { if (active) setGift(result); }, (reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load the saved gift."); }); return () => { active = false; }; }, [donationId, attempt]);
  if (creating && gift && !task) return <NewTaskModal donation={gift} onClose={() => { if (newlyRecorded) setCreating(false); else onClose(); }} onCreated={(saved) => { if (saved) setTask(saved); window.dispatchEvent(new Event("tasks:updated")); }} />;
  return <WorkspaceSetupModal title={task ? "Follow-up task created" : newlyRecorded ? "Gift recorded" : "Donation follow-up"} subtitle={task ? "Your next step is saved in Tasks with this gift's context." : "Choose a useful next step for this donor."} onClose={onClose} maxWidthClassName="max-w-lg" contentClassName="donor-daily-workspace"><div className="space-y-4 p-6"><CheckCircle2 className="h-10 w-10 text-emerald-600" />{newlyRecorded && <p className="text-sm text-slate-600">The donation is saved. Creating a follow-up is optional and will not record another gift.</p>}{gift && <div className="rounded-xl border bg-slate-50 p-4"><strong>{gift.constituent.firstName} {gift.constituent.lastName}</strong><p className="mt-1 text-sm text-slate-600">{formatCurrency(gift.amount)} · {formatDonationDate(gift.date)}</p></div>}{error && <div role="alert" className="text-sm text-red-700">{error}<button type="button" className="donor-button mt-3" onClick={() => setAttempt((value) => value + 1)}>Retry gift details</button></div>}{!gift && !error && <p role="status" className="text-sm text-slate-500">Loading saved gift details…</p>}{task?.notificationWarning && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{task.notificationWarning}</p>}<div className="flex flex-wrap gap-2">{task ? <Link className="donor-button donor-button-primary" href={`/tasks?taskId=${encodeURIComponent(task.id)}`}>Open follow-up task</Link> : <button type="button" className="donor-button donor-button-primary" disabled={!gift} onClick={() => setCreating(true)}>Set up follow-up task</button>}<Link className="donor-button" href={`/donations/${encodeURIComponent(donationId)}`}>View donation</Link><button className="donor-button" type="button" onClick={onClose}>{task ? "Done" : "Done for now"}</button></div></div></WorkspaceSetupModal>;
}
