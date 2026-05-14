/**
 * WorkflowConnector renders map connector lines and plus-buttons between steps.
 */
"use client";

interface WorkflowConnectorProps {
  showLine?: boolean;
  onAdd?: () => void;
  addLabel?: string;
}

/** Vertical connector with optional add-step button. */
export default function WorkflowConnector({ showLine = true, onAdd, addLabel = "Add step" }: WorkflowConnectorProps) {
  return (
    <div className="flex flex-col items-center py-2">
      {showLine && <span className="h-6 w-px bg-emerald-200" />}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300 bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-50"
          aria-label={addLabel}
          title={addLabel}
        >
          +
        </button>
      )}
    </div>
  );
}
