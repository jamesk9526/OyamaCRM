/** OyamaLetters batches route. */
import OyamaLettersWorkspace from "@/app/components/letters/OyamaLettersWorkspace";

/** Opens batch generation and generated-letter history inside the dedicated workspace. */
export default function OyamaLettersBatchesPage() {
  return <OyamaLettersWorkspace view="generate" />;
}
