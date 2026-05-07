/**
 * TaskTable component.
 * Renders a sortable table of tasks with quick-complete and delete actions.
 * Highlights overdue tasks in red.
 */
"use client";

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

interface Props {
  tasks: Task[];
  loading?: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Skeleton row for loading state */
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/** TaskTable: displays tasks in a table with complete/delete actions */
export default function TaskTable({ tasks, loading, onComplete, onDelete }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Title", "Type", "Assignee", "Constituent", "Due Date", "Status", "Actions"].map((h) => (
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
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {["Title", "Type", "Assignee", "Constituent", "Due Date", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => {
            const isOverdue = task.status === "PENDING" && task.dueDate && new Date(task.dueDate) < new Date();
            return (
              <tr key={task.id} className={`hover:bg-gray-50 transition-colors ${isOverdue ? "bg-red-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className={`font-medium ${isOverdue ? "text-red-700" : "text-gray-900"}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{task.description}</p>}
                  {isOverdue && <span className="text-xs text-red-500 font-medium">Overdue</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{typeLabel(task.type)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {task.constituent ? `${task.constituent.firstName} ${task.constituent.lastName}` : <span className="text-gray-400">—</span>}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap ${isOverdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                  {fmt(task.dueDate)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {(task.status === "PENDING" || task.status === "IN_PROGRESS") ? (
                      <button
                        onClick={() => onComplete(task.id)}
                        className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors font-medium"
                      >
                        Complete
                      </button>
                    ) : null}
                    <button
                      onClick={() => onDelete(task.id)}
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
