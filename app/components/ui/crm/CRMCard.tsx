/** Shared soft card primitive for Donor CRM visual refresh pages. */
import type { ReactNode } from "react";

interface CRMCardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClassName = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/** CRMCard standardizes the calm white-card surface used by refreshed CRM pages. */
export default function CRMCard({ children, className = "", padding = "md" }: CRMCardProps) {
  return (
    <section className={`crm-card-surface rounded-xl border ${paddingClassName[padding]} ${className}`}>
      {children}
    </section>
  );
}
