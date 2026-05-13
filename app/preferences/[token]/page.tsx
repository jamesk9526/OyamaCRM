/** Public preferences page route for tokenized donor email preference links. */
import PublicPreferencesPage from "@/app/components/email-preferences/PublicPreferencesPage";

/** Renders the email preference manager for one public token. */
export default async function PreferencesTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const resolved = await params;
  return <PublicPreferencesPage token={resolved.token} />;
}
