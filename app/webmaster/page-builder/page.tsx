import { redirect } from "next/navigation";

/** Legacy route shim that keeps old page-builder links working after the builder route rename. */
export default function WebmasterLegacyPageBuilderRoute() {
  redirect("/webmaster/editor");
}
