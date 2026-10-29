import CompassionShell from "@/app/components/compassion/CompassionShell";
import "./compassion.css";
export const metadata = { title: { default: "Compassion CRM", template: "%s | Compassion CRM" }, robots: { index: false, follow: false } };
export default function CompassionLayout({ children }: { children: React.ReactNode }) { return <CompassionShell>{children}</CompassionShell>; }
