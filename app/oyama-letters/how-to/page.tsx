/** Compatibility route for the canonical OyamaLetters docs workspace. */
import { redirect } from "next/navigation";

/** Keeps older bookmarks working while the sidebar uses the Docs route. */
export default function OyamaLettersHowToPage() {
  redirect("/oyama-letters/docs");
}
