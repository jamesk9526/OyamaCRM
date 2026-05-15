/** Letter header and footer preset management — lives in Branding Settings as the source of truth. */
import LetterBrandingManager from "@/app/components/letters/LetterBrandingManager";

/** Renders letter header/footer branding presets within the centralized Branding Settings workspace. */
export default function BrandingLetterPresetsPage() {
  return <LetterBrandingManager />;
}
