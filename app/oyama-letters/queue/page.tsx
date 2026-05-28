/** OyamaLetters queue route. */
import OyamaLettersWorkspace from "@/app/components/letters/OyamaLettersWorkspace";

/** Opens generated-letter activity and queue review inside the dedicated workspace. */
export default function OyamaLettersQueuePage() {
  return <OyamaLettersWorkspace view="queue" />;
}
