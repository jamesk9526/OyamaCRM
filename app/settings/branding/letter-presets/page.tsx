/** Compatibility route for legacy letter preset links. */
import { redirect } from "next/navigation";

/** Header and footer settings now live on the canonical Branding Defaults page. */
export default function BrandingLetterPresetsPage() {
  redirect("/settings/branding#communication-header-footer");
}
