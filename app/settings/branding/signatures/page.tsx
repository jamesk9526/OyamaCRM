/** Signature block management — lives in Branding Settings as the source of truth. */
import LetterSignaturesManager from "@/app/components/letters/LetterSignaturesManager";

/** Renders reusable signer block management within the centralized Branding Settings workspace. */
export default function BrandingSignaturesPage() {
  return <LetterSignaturesManager />;
}
