"use client";
import Link from "next/link";
import { taskLabel, taskLocalDate, taskOverdue, type Task } from "./task-types";
interface Props {
  tasks: Task[];
  loading?: boolean;
  highlightTaskId?: string | null;
  busyId?: string | null;
  canEdit?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string, checked: boolean) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void;
  onReopen?: (id: string) => void;
}
const badge = (s: string) =>
  s === "COMPLETED"
    ? "bg-emerald-50 text-emerald-800"
    : s === "IN_PROGRESS"
      ? "bg-sky-50 text-sky-800"
      : s === "CANCELLED"
        ? "bg-slate-100 text-slate-600"
        : "bg-amber-50 text-amber-800";
export default function TaskTable({
  tasks,
  loading,
  highlightTaskId,
  busyId,
  canEdit = true,
  selectedIds = [],
  onSelect,
  onComplete,
  onDelete,
  onEdit,
  onReopen,
}: Props) {
  if (loading)
    return (
      <p
        role="status"
        className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500"
      >
        Loading tasks...
      </p>
    );
  if (!tasks.length)
    return (
      <div className="rounded-xl border border-dashed bg-white p-10 text-center">
        <h2 className="font-semibold">No tasks in this view</h2>
        <p className="mt-2 text-sm text-slate-500">
          Adjust filters or create the next follow-up.
        </p>
      </div>
    );
  const actions = (task: Task) =>
    canEdit && (
      <div className="flex flex-wrap gap-1.5">
        {onEdit && (
          <button
            className="donor-button"
            disabled={Boolean(busyId)}
            onClick={() => onEdit(task)}
          >
            Edit
          </button>
        )}
        {["PENDING", "IN_PROGRESS"].includes(task.status) ? (
          <button
            className="donor-button"
            disabled={Boolean(busyId)}
            onClick={() => onComplete(task.id)}
          >
            {busyId === task.id ? "Saving..." : "Done"}
          </button>
        ) : (
          onReopen && (
            <button
              className="donor-button"
              disabled={Boolean(busyId)}
              onClick={() => onReopen(task.id)}
            >
              Reopen
            </button>
          )
        )}
        <button
          className="donor-button text-red-700"
          disabled={Boolean(busyId)}
          onClick={() => onDelete(task.id)}
          aria-label={`Delete task: ${task.title}`}
        >
          Delete
        </button>
      </div>
    );
  const title = (task: Task) => (
    <>
      <p className="font-semibold text-slate-900">{task.title}</p>
      {task.description && (
        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500 line-clamp-2">
          {task.description}
        </p>
      )}
      {task.sourceType === "donation-follow-up" && task.sourceId && <Link className="mt-1 inline-block text-xs text-emerald-800 hover:underline" href={`/donations/${encodeURIComponent(task.sourceId)}`}>Linked donation</Link>}
      {highlightTaskId === task.id && (
        <p className="text-xs text-emerald-800">Linked task</p>
      )}
      {task.generatedLetterId && (
        <Link
          className="text-xs text-emerald-800 hover:underline"
          href={`/oyama-letters?sourceTaskId=${encodeURIComponent(task.id)}`}
        >
          Linked letter
        </Link>
      )}
      {task.stewardPathEnrollmentId && (
        <Link
          className="ml-2 text-xs text-emerald-800 hover:underline"
          href={`/steward-paths?enrollmentId=${encodeURIComponent(task.stewardPathEnrollmentId)}`}
        >
          Steward path
        </Link>
      )}
    </>
  );
  const due = (task: Task) => (
    <span
      className={
        taskOverdue(task) ? "font-semibold text-red-700" : "text-slate-600"
      }
    >
      {task.dueDate
        ? new Date(
            `${taskLocalDate(task.dueDate)}T12:00:00`,
          ).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "No due date"}
      {taskOverdue(task) && <span className="block text-[11px]">Overdue</span>}
    </span>
  );
  const owner = (task: Task) =>
    task.assignee
      ? `${task.assignee.firstName} ${task.assignee.lastName}`
      : "Unassigned";
  const checkbox = (task: Task) =>
    canEdit &&
    onSelect && (
      <input
        type="checkbox"
        aria-label={`Select task: ${task.title}`}
        checked={selectedIds.includes(task.id)}
        onChange={(e) => onSelect(task.id, e.target.checked)}
      />
    );
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="divide-y md:hidden">
        {tasks.map((task) => (
          <article
            key={task.id}
            className={`space-y-3 p-4 ${highlightTaskId === task.id ? "bg-emerald-50/50" : ""}`}
          >
            <div className="flex items-start gap-3">
              {checkbox(task)}
              <div className="min-w-0 flex-1">{title(task)}</div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] ${badge(task.status)}`}
              >
                {taskLabel(task.status)}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {due(task)}
              <span>{taskLabel(task.priority)} priority</span>
              <span>{owner(task)}</span>
            </div>
            {task.constituent && (
              <Link
                className="block text-xs text-emerald-800"
                href={`/constituents/${encodeURIComponent(task.constituent.id)}`}
              >
                {task.constituent.firstName} {task.constituent.lastName}
              </Link>
            )}
            {actions(task)}
          </article>
        ))}
      </div>
      <div
        className="hidden overflow-x-auto md:block"
        role="region"
        aria-label="Task list"
        tabIndex={0}
      >
        <table className="w-full min-w-[950px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {[
                ...(canEdit && onSelect ? ["Select"] : []),
                "Task",
                "Assigned to",
                "Due",
                "Priority",
                "Status",
                "Actions",
              ].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={
                  highlightTaskId === task.id
                    ? "bg-emerald-50/60"
                    : "hover:bg-slate-50"
                }
              >
                {canEdit && onSelect && (
                  <td className="px-4 py-3">{checkbox(task)}</td>
                )}
                <td className="min-w-56 px-4 py-4">
                  {title(task)}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {taskLabel(task.type)}
                    {task.constituent && (
                      <>
                        {" "}
                        -{" "}
                        <Link
                          className="text-emerald-800 hover:underline"
                          href={`/constituents/${encodeURIComponent(task.constituent.id)}`}
                        >
                          {task.constituent.firstName}{" "}
                          {task.constituent.lastName}
                        </Link>
                      </>
                    )}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {owner(task)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {due(task)}
                </td>
                <td className="px-4 py-3 text-xs">
                  {taskLabel(task.priority)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] ${badge(task.status)}`}
                  >
                    {taskLabel(task.status)}
                  </span>
                </td>
                <td className="px-4 py-3">{actions(task)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
