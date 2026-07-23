/**
 * Custom Fields page — server component wrapper.
 * Renders the CustomFieldsManager client component.
 * AppShell is provided by the root layout — do NOT wrap here.
 * Route: /custom-fields
 * Accessible to: manager and admin roles (enforced client-side + API-side).
 */
import CustomFieldsManager from "@/app/components/settings/CustomFieldsManager";

/** Page metadata for the browser tab. */
export const metadata = {
  title: "Custom Fields — OyamaCRM v1.3",
};

/** /custom-fields page — custom field management UI. */
export default function CustomFieldsPage() {
  return <CustomFieldsManager />;
}
