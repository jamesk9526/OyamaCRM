/**
 * Section wrapper for workspace control rail groups.
 */
import type { ReactNode } from "react";

interface WorkspaceControlRailGroupProps {
  label: string;
  children: ReactNode;
}

/** Renders one labeled group with compact enterprise-style spacing. */
export default function WorkspaceControlRailGroup({ label, children }: WorkspaceControlRailGroupProps) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
