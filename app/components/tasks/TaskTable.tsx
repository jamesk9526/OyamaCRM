/**
 * TaskTable component.
 * Renders a task workspace table with quick-complete and delete actions.
 * Highlights overdue and notification-targeted tasks for faster triage.
 */
"use client";

import Link from "next/link";
import { Task } from "@/app/tasks/page";

/** Format a date string as a short locale date */
function fmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Return Tailwind classes for a task status badge */
function statusColor(status: string) {
  switch (status) {
    case "COMPLETED": return "bg-green-50 text-green-700";
    case "IN_PROGRESS": return "bg-blue-50 text-blue-700";
    case "CANCELLED": return "bg-gray-100 text-gray-500";
    default: return "bg-amber-50 text-amber-700";
  }
}

/** Return human-readable label for task type */
function typeLabel(type: string) {
  return type.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/** Return Tailwind classes for task priority badges. */
function priorityColor(priority: string) {
  switch (priority) {
    case "URGENT": return "bg-red-100 text-red-700";
    case "HIGH": return "bg-orange-100 text-orange-700";
    case "LOW": return "bg-gray-100 text-gray-600";
    default: return "bg-blue-100 text-blue-700";
  }
}

interface Props {
  tasks: Task[];
  loading?: boolean;
  highlightTaskId?: string | null;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Skeleton row for loading state */
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/** TaskTable: displays tasks in a table with complete/delete actions */
export default function TaskTable({ tasks, loading, highlightTaskId, onComplete, onDelete }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Title", "Type", "Assignee", "Constituent", "Due Date", "Priority", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
        </table>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm">No tasks found. Try adjusting your filters or create a new task.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="md:hidden divide-y divide-gray-100">
        {tasks.map((task) => {
          const isOverdue = task.status === "PENDING" && task.dueDate && new Date(task.dueDate) < new Date();
          const isHighlighted = Boolean(highlightTaskId && task.id === highlightTaskId);
          return (
            <article
              id={`task-row-${task.id}`}
              key={task.id}
              className={`p-3 ${isOverdue ? "bg-red-50" : ""} ${isHighlighted ? "bg-green-50 ring-1 ring-inset ring-green-300" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-medium ${isOverdue ? "text-red-700" : "text-gray-900"}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>}
                  {task.constituent ? (
                    <Link href={`/constituents/${task.constituent.id}`} className="text-xs text-green-700 hover:underline">
                      {task.constituent.firstName} {task.constituent.lastName}
                    </Link>
                  ) : null}
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(task.status)}`}>
                  {task.status.replace("_", " ")}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-gray-50 px-2 py-1.5">
                  <p className="text-gray-500">Due</p>
                  <p className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-800"}`}>{fmt(task.dueDate)}</p>
                </div>
                <div className="rounded-md bg-gray-50 px-2 py-1.5">
                  <p className="text-gray-500">Priority</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 px-2 py-1.5 col-span-2">
                  <p className="text-gray-500">Type</p>
                  <p className="font-medium text-gray-800">{typeLabel(task.type)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {(task.status === "PENDING" || task.status === "IN_PROGRESS") ? (
                  <button
                    onClick={() => onComplete(task.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                  >
                    Done
                  </button>
                ) : null}
                <button
                  onClick={() => onDelete(task.id)}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                  title="Delete task"
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {["Title", "Type", "Assignee", "Constituent", "Due Date", "Priority", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => {
            const isOverdue = task.status === "PENDING" && task.dueDate && new Date(task.dueDate) < new Date();
            const isHighlighted = Boolean(highlightTaskId && task.id === highlightTaskId);
            return (
              <tr
                id={`task-row-${task.id}`}
                key={task.id}
                className={`hover:bg-gray-50 transition-colors ${isOverdue ? "bg-red-50" : ""} ${isHighlighted ? "bg-green-50 ring-1 ring-inset ring-green-300" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className={`font-medium ${isOverdue ? "text-red-700" : "text-gray-900"}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{task.description}</p>}
                  {isOverdue && <span className="text-xs text-red-500 font-medium">Overdue</span>}
                  {isHighlighted && <span className="text-xs text-green-700 font-medium">From notification</span>}
                  {(task.generatedLetterId || task.stewardPathEnrollmentId) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {task.generatedLetterId && (
                        <Link
                          href={`/letters-printables/queues?view=production&sourceTaskId=${task.id}`}
                          className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100"
                        >
                          Linked Letter
                        </Link>
                      )}
                      {task.stewardPathEnrollmentId && (
                        <Link
                          href={`/letters-printables/queues?view=production&stewardPathEnrollmentId=${task.stewardPathEnrollmentId}`}
                          className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100"
                        >
                          Steward Step
                        </Link>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{typeLabel(task.type)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {task.constituent ? (
                    <Link href={`/constituents/${task.constituent.id}`} className="text-green-700 hover:underline">
                      {task.constituent.firstName} {task.constituent.lastName}
                    </Link>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap ${isOverdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                  {fmt(task.dueDate)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {(task.status === "PENDING" || task.status === "IN_PROGRESS") ? (
                      <button
                        onClick={() => onComplete(task.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Done
                      </button>
                    ) : null}
                    <button
                      onClick={() => onDelete(task.id)}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete task"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
