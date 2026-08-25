"use client";

import { usePathname } from "next/navigation";
import LegacyTriviaRouteRedirect from "@/app/components/trivia/LegacyTriviaRouteRedirect";

/** Trivia administration moved under Events. Temporary remote links remain shell-free. */
export default function TriviaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/apps/trivia/remote" || pathname.startsWith("/apps/trivia/remote/")) return <>{children}</>;
  return <LegacyTriviaRouteRedirect />;
}
