/** FeatureStatusWarning renders a reusable in-development warning banner for partial features. */

interface FeatureStatusWarningProps {
  status: "Partially Implemented" | "In Development" | "Planned";
  title: string;
  description: string;
}

/** FeatureStatusWarning communicates incomplete behavior so UI does not look production-ready. */
export default function FeatureStatusWarning({ status, title, description }: FeatureStatusWarningProps) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{status}</p>
      <h2 className="text-sm font-semibold text-amber-900 mt-0.5">{title}</h2>
      <p className="text-xs text-amber-800 mt-1">{description}</p>
    </section>
  );
}
