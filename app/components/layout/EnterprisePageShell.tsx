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
  maxWidthClassName = "max-w-none",
}: EnterprisePageShellProps) {
  return (
    <div className={`mx-auto flex w-full ${maxWidthClassName} flex-col gap-3 bg-gradient-to-b from-white/35 via-emerald-50/20 to-transparent p-0 min-[1360px]:gap-4 ${className}`}>
      {ribbon ? (
        <div className="sticky top-0 z-40 -mx-3 min-w-0 border-b border-slate-200 bg-white px-3 pb-0 pt-0 sm:-mx-4 sm:px-4 xl:-mx-7 xl:px-7 min-[1440px]:-mx-8 min-[1440px]:px-8 2xl:-mx-9 2xl:px-9">
          <div className="w-full min-w-0">
            {ribbon}
          </div>
        </div>
      ) : null}
      <div className={`min-w-0 ${contentClassName}`}>{children}</div>
    </div>
  );
}
