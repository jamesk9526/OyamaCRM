import { redirect } from "next/navigation";

/** Compatibility route retained while Stripe setup moves into its dedicated integration app. */
export default function SettingsPaymentsPage() {
  redirect("/integrations/stripe");
}
