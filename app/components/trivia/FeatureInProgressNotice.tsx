// FeatureInProgressNotice shows explicit messaging for known in-progress capabilities.

interface FeatureInProgressNoticeProps {
  /** Human-readable label describing what is in progress. */
  label: string;
  /** Optional contextual note for host/admin users. */
  detail?: string;
}

/**
 * FeatureInProgressNotice ensures unfinished surfaces never appear as dead buttons.
 * Use this component wherever functionality is intentionally deferred.
 */
export default function FeatureInProgressNotice({ label, detail }: FeatureInProgressNoticeProps) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Feature in progress</p>
      <p className="text-sm text-amber-100 mt-0.5">{label}</p>
      {detail && <p className="text-xs text-amber-200/80 mt-1">{detail}</p>}
    </div>
  );
}
