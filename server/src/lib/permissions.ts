/** Central permission key registry and role-default policy for fine-grained access control. */
import { ROLE_HIERARCHY, type UserRole } from "../middleware/requireRole.js";

/** All supported fine-grained permission keys. */
export const PERMISSION_KEYS = [
  "view:constituents",
  "edit:constituents",
  "delete:constituents",
  "view:donations",
  "edit:donations",
  "delete:donations",
  "view:campaigns",
  "edit:campaigns",
  "view:reports",
  "view:communications",
  "edit:communications",
  "view:events",
  "edit:events",
  "view:tasks",
  "edit:tasks",
  "import:data",
  "export:data",
  "view:custom_fields",
  "edit:custom_fields",
  "view:audit_logs",
  "watchdog:view_dashboard",
  "watchdog:view_logs",
  "watchdog:vault:read",
  "watchdog:vault:read_secret",
  "watchdog:vault:write",
  "watchdog:vault:delete",
  "watchdog:incident:acknowledge",
  "watchdog:incident:escalate",
  "watchdog:incident:resolve",
  "watchdog:manage",
] as const;

/** Union type for one permission key. */
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Runtime guard to validate one unknown permission key. */
export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Default role gate for one permission key when no explicit override exists. */
interface PermissionDefault {
  minRole: UserRole;
}

/** Default fallback policy used when a user has no explicit UserPermission row. */
const PERMISSION_DEFAULTS: Record<PermissionKey, PermissionDefault> = {
  "view:constituents": { minRole: "readonly" },
  "edit:constituents": { minRole: "staff" },
  "delete:constituents": { minRole: "admin" },
  "view:donations": { minRole: "readonly" },
  "edit:donations": { minRole: "staff" },
  "delete:donations": { minRole: "admin" },
  "view:campaigns": { minRole: "readonly" },
  "edit:campaigns": { minRole: "staff" },
  "view:reports": { minRole: "report_viewer" },
  "view:communications": { minRole: "readonly" },
  "edit:communications": { minRole: "staff" },
  "view:events": { minRole: "readonly" },
  "edit:events": { minRole: "staff" },
  "view:tasks": { minRole: "readonly" },
  "edit:tasks": { minRole: "staff" },
  "import:data": { minRole: "manager" },
  "export:data": { minRole: "manager" },
  "view:custom_fields": { minRole: "readonly" },
  "edit:custom_fields": { minRole: "manager" },
  "view:audit_logs": { minRole: "manager" },
  "watchdog:view_dashboard": { minRole: "admin" },
  "watchdog:view_logs": { minRole: "admin" },
  "watchdog:vault:read": { minRole: "admin" },
  "watchdog:vault:read_secret": { minRole: "admin" },
  "watchdog:vault:write": { minRole: "admin" },
  "watchdog:vault:delete": { minRole: "admin" },
  "watchdog:incident:acknowledge": { minRole: "admin" },
  "watchdog:incident:escalate": { minRole: "admin" },
  "watchdog:incident:resolve": { minRole: "admin" },
  "watchdog:manage": { minRole: "admin" },
};

/**
 * Returns true when a role satisfies or exceeds a minimum role in hierarchy.
 * Lower index in ROLE_HIERARCHY means more privilege.
 */
export function roleMeetsMinimum(role: string, minRole: UserRole): boolean {
  const roleIndex = ROLE_HIERARCHY.indexOf(role as UserRole);
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);
  if (roleIndex === -1 || minIndex === -1) return false;
  return roleIndex <= minIndex;
}

/**
 * Evaluates the default role-based permission policy for a key.
 * Explicit grants/denials are handled separately by middleware using UserPermission rows.
 */
export function hasDefaultPermission(role: string, permission: PermissionKey): boolean {
  const policy = PERMISSION_DEFAULTS[permission];
  return roleMeetsMinimum(role, policy.minRole);
}
