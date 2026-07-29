import { redirect } from "next/navigation";

/** Compatibility route for early Stripe integration links. */
export default function StripeIntegrationPage() {
  redirect("/integrations/stripe");
}
