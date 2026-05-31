import StewardPathsAppShell from "@/app/components/steward-paths/StewardPathsAppShell";

interface StewardPathsLayoutProps {
  children: React.ReactNode;
}

export default function StewardPathsLayout({ children }: StewardPathsLayoutProps) {
  return <StewardPathsAppShell>{children}</StewardPathsAppShell>;
}
