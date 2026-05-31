import { redirect } from "next/navigation";

/** Steward Paths-native LiveCom entry route. */
export default function StewardPathsLiveComPage() {
  redirect("/livecom/inbox?source=steward-paths");
}
