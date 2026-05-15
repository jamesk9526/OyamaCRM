/** /settings/audit compatibility route redirects to merged security and audit workspace. */
import { redirect } from "next/navigation";

export default function AuditSettingsPage() {
  redirect("/settings/security#audit-logs");
}

