import { redirect } from "next/navigation";

/** Legacy queue URL: generation, preview, and PDF download now live in one workspace. */
export default function OyamaLettersQueuePage() {
  redirect("/oyama-letters/generate");
}
