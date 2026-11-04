import type { ReactNode } from "react";
import CreateShell from "@/app/components/oyama-create/CreateShell";
export default function CreateLayout({ children }: { children: ReactNode }) { return <CreateShell>{children}</CreateShell>; }
