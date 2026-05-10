"use client";

interface FeatureDevelopmentDialogProps {
  open: boolean;
  title: string;
  detail: string;
  onClose: () => void;
}

/** Explains when a visible Webmaster feature is still under active development. */
export default function FeatureDevelopmentDialog({ open, title, detail, onClose }: FeatureDevelopmentDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white shadow-xl">
        <div className="px-5 py-4 border-b border-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Feature In Progress</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-slate-700">
          <p>
            This feature is still being built. You can preview the interface, but advanced workflows for this area are not fully implemented yet.
          </p>
          <p>{detail}</p>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
