/** Canonical calendar alias route for OyamaEmail schedule manager. */
import { redirect } from "next/navigation";

/** Keeps /calendar discoverable while legacy /callender routes stay compatible. */
export default function OyamaEmailCalendarAliasPage() {
  redirect("/oyama-email/callender");
}
