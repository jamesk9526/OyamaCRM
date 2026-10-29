/** Preserve existing bookmarks after moving configuration into Settings. */
import { redirect } from "next/navigation";
export default function CustomFieldsPage() {
  redirect("/settings/custom-fields");
}
