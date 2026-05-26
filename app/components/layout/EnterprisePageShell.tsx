/** EnterprisePageShell standardizes page width, spacing, and workspace surface rhythm. */
import type { ReactNode } from "react";

interface EnterprisePageShellProps {
  children: ReactNode;
  ribbon?: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
}

/**
 * Provides the canonical CRM page frame: optional ribbon/header, spacious content,
 * and a predictable maximum width for dense enterprise workspaces.
 */
export default function EnterprisePageShell({
  children,
  ribbon,
  className = "",
  contentClassName = "",
  maxWidthClassName = "max-w-[1480px]",
}: EnterprisePageShellProps) {
  return (
    <div className={`mx-auto flex w-full ${maxWidthClassName} flex-col gap-4 rounded-[1.75rem] bg-gradient-to-b from-white/35 via-emerald-50/20 to-transparent p-0 min-[1360px]:gap-5 ${className}`}>
      {ribbon ? <div className="min-w-0">{ribbon}</div> : null}
      <div className={`min-w-0 ${contentClassName}`}>{children}</div>
    </div>
  );
}
