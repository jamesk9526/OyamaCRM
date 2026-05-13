/** Public unsubscribe page route for tokenized donor email unsubscribe links. */
import PublicUnsubscribePage from "@/app/components/email-preferences/PublicUnsubscribePage";

/** Renders one-click unsubscribe controls for one public token. */
export default async function UnsubscribeTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const resolved = await params;
  return <PublicUnsubscribePage token={resolved.token} />;
}
