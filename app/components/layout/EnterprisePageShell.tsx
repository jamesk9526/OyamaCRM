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
  maxWidthClassName = "max-w-[1600px]",
}: EnterprisePageShellProps) {
  return (
    <div className={`mx-auto flex w-full ${maxWidthClassName} flex-col gap-5 ${className}`}>
      {ribbon ? <div className="min-w-0">{ribbon}</div> : null}
      <div className={`min-w-0 ${contentClassName}`}>{children}</div>
    </div>
  );
}
