/** Server wrapper for the OyamaLetters generation workspace. */
import LettersGenerateWorkspace from "@/components/letters/generation/LettersGenerateWorkspace";

/** Renders the standalone OyamaLetters Generate Center without legacy workspace chrome. */
export default function LetterGenerateCenter() {
  return <LettersGenerateWorkspace />;
}
