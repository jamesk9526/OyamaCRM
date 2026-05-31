import type { ReactNode } from "react";

export interface CrmRibbonContext {
  selectionCount?: number;
  permissions?: string[];
  flags?: Record<string, boolean | number | string | null | undefined>;
}

export interface CrmRibbonCommand {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  requiredSelectionMin?: number;
  requiredPermission?: string;
  disabledReason?: string;
  hidden?: (context: CrmRibbonContext) => boolean;
  enabled?: (context: CrmRibbonContext) => boolean;
  active?: (context: CrmRibbonContext) => boolean;
}

export interface CrmRibbonCommandGroup {
  id: string;
  label: string;
  commands: CrmRibbonCommand[];
}

export interface CrmRibbonTab {
  id: string;
  label: string;
  groups: CrmRibbonCommandGroup[];
}

export interface CrmRibbonPageConfig {
  id: string;
  pageLabel: string;
  tabs: CrmRibbonTab[];
  defaultTabId: string;
}

export type CrmRibbonCommandHandlers = Partial<Record<string, () => void>>;
