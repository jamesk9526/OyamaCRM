/**
 * Custom Fields page — server component wrapper.
 * Renders the CustomFieldsManager client component inside AppShell.
 * Route: /custom-fields
 * Accessible to: manager and admin roles (enforced client-side + API-side).
 */
import AppShell from "@/app/components/layout/AppShell";
import CustomFieldsManager from "@/app/components/settings/CustomFieldsManager";

/** Page metadata for the browser tab. */
export const metadata = {
  title: "Custom Fields — OyamaCRM",
};

/** /custom-fields page — custom field management UI. */
export default function CustomFieldsPage() {
  return (
    <AppShell>
      <CustomFieldsManager />
    </AppShell>
  );
}
