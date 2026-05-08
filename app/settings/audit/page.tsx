/**
 * Audit logs settings page — paginated, filterable view of org-wide audit trail.
 * Renders the AuditLogViewer component. Admin-only.
 */
import AuditLogViewer from "@/app/components/settings/AuditLogViewer";

/** AuditSettingsPage renders the audit log viewer. Admin-only access is enforced by the API. */
export default function AuditSettingsPage() {
  return (
    <div className="max-w-6xl">
      <AuditLogViewer />
    </div>
  );
}

