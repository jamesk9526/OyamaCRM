"use client";

import { useState } from "react";
import type { StewardTaskListArtifact } from "@/app/components/ai/steward-artifact-types";

interface TaskListArtifactCardProps {
  artifact: StewardTaskListArtifact;
}

function formatTasks(artifact: StewardTaskListArtifact): string {
  return (artifact.tasks || []).map((task, index) => {
    const parts = [
      `${index + 1}. ${task.title}`,
      task.donorName ? `donor ${task.donorName}` : "",
      task.priority ? `priority ${task.priority}` : "",
      task.dueDate ? `due ${task.dueDate}` : "",
    ].filter(Boolean);
    return parts.join(" | ");
  }).join("\n");
}

export default function TaskListArtifactCard({ artifact }: TaskListArtifactCardProps) {
  const [notice, setNotice] = useState("");

  async function copyTasks() {
    try {
      await navigator.clipboard.writeText(formatTasks(artifact));
      setNotice("Task list copied.");
    } catch {
      setNotice("Could not copy task list.");
    }
  }

  return (
    <article className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-orange-900">{artifact.title || "Follow-up Task List"}</h4>
        <span className="rounded-full border border-orange-200 bg-white px-2 py-0.5 text-[11px] text-orange-700">Tasks</span>
      </header>

      <ul className="space-y-1">
        {(artifact.tasks || []).map((task, index) => (
          <li key={`${task.title}-${index}`} className="rounded-lg border border-orange-200 bg-white px-2 py-1">
            <p className="text-sm font-medium text-slate-800">{task.title}</p>
            <p className="text-xs text-slate-500">
              {task.donorName ? `Donor: ${task.donorName}` : "General follow-up"}
              {task.priority ? ` | Priority: ${task.priority}` : ""}
              {task.dueDate ? ` | Due: ${task.dueDate}` : ""}
            </p>
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => void copyTasks()} className="rounded-md border border-orange-300 bg-white px-2 py-1 text-[11px] font-medium text-orange-800 hover:bg-orange-100">Copy All Tasks</button>
      {notice && <p className="text-[11px] text-orange-700">{notice}</p>}
    </article>
  );
}
