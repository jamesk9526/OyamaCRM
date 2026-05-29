/** OyamaEmail new campaign wizard route. */
import OyamaEmailWorkspace from "@/app/components/oyama-email/OyamaEmailWorkspace";

/** Renders the dedicated campaign wizard page with visual one-direction workflow. */
export default function OyamaEmailCampaignNewPage() {
  return <OyamaEmailWorkspace view="campaigns" />;
}
