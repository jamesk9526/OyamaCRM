/**
 * Shared types for the reusable workspace frame and right-side control rail.
 */
import type { ReactNode } from "react";

export type WorkspaceControlStatus = "Working" | "Partially Working" | "Demo Only" | "Broken" | "Not Implemented";

export interface WorkspaceControlItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  external?: boolean;
  icon?: ReactNode;
  badge?: string | number;
  status?: WorkspaceControlStatus;
  disabled?: boolean;
  disabledReason?: string;
}

export interface WorkspaceControlGroup {
  id: string;
  label: string;
  items: WorkspaceControlItem[];
}
