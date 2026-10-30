/** Stable list placeholder with one spoken status and decorative row skeletons. */
export default function CRMTableLoading({ label }: { label: string }) {
  return <div className="crm-table-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="donor-loading-indicator">{label}</span>
    <div aria-hidden="true" className="crm-table-loading-rows">
      {Array.from({ length: 5 }, (_, index) => <div className="crm-table-loading-row" key={index}>
        <span className="donor-loading-skeleton" /><span className="donor-loading-skeleton" /><span className="donor-loading-skeleton" />
      </div>)}
    </div>
  </div>;
}
