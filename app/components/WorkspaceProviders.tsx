"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
const DefaultProviders = dynamic(()=>import("./DefaultWorkspaceProviders"));
const CompassionProviders = dynamic(()=>import("./compassion/CompassionProviders"));
/** Clinical review never initializes shared account, AI, plugin, or offline providers. */
export default function WorkspaceProviders({children}:{children:React.ReactNode}) {
  const path = usePathname();
  if(path.startsWith("/compassion/physician")) return children;
  if(path === "/compassion" || path.startsWith("/compassion/")) return <CompassionProviders>{children}</CompassionProviders>;
  return <DefaultProviders>{children}</DefaultProviders>;
}
