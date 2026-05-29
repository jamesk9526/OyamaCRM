/** OyamaEmail new template builder route. */
import OyamaEmailWorkspace from "@/app/components/oyama-email/OyamaEmailWorkspace";

/** Opens the new redesigned email builder for creating a template from scratch. */
export default function OyamaEmailNewTemplatePage() {
  return <OyamaEmailWorkspace view="builder" />;
}
