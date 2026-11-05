/** Shared Settings destinations for navigation and the searchable overview. */
type IconSlug = "donor-dashboard" | "documentation" | "constituents" | "fund-designation" | "users" | "system-status" | "field-mapping" | "event-fundraising" | "steward-ai" | "integrations" | "quickbooks-queue" | "communications" | "giving-trends" | "reports" | "help";

interface SettingsNavItem {
  label: string;
  href: string;
  description: string;
  iconSlug: IconSlug;
}

interface SettingsNavGroup {
  label: string;
  description: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: "Your account",
    description: "Personal details and workspace preferences",
    items: [
      { label: "Overview", href: "/settings", description: "Settings home", iconSlug: "donor-dashboard" },
      { label: "My Profile", href: "/settings/profile", description: "Professional profile, introduction and activity", iconSlug: "users" },
      { label: "My Appearance", href: "/settings/appearance", description: "Personal workspace display", iconSlug: "fund-designation" },
      { label: "Notification email", href: "/settings/notification-email", description: "Administrator personal email alerts and subject lines", iconSlug: "communications" },
    ],
  },
  {
    label: "Organization & team",
    description: "Identity, branding, staff and security",
    items: [
      { label: "Organization", href: "/settings/organization", description: "Identity, region, and email", iconSlug: "constituents" },
      { label: "Branding", href: "/oyama-create/library/brand", description: "Logos and public colors", iconSlug: "fund-designation" },
      { label: "Team users & access", href: "/settings/users", description: "Add users, staff accounts, passwords and roles", iconSlug: "users" },
      { label: "Roles & Scopes", href: "/settings/roles", description: "Permission reference", iconSlug: "system-status" },
      { label: "Security & Audit", href: "/settings/security", description: "Authentication and recovery", iconSlug: "system-status" },
    ],
  },
  {
    label: "AI & connections",
    description: "ChatGPT access, Steward and connected services",
    items: [
      { label: "AI access", href: "/settings/ai-access", description: "ChatGPT scopes, approvals and connections", iconSlug: "steward-ai" },
      { label: "AI Assistant", href: "/settings/ai", description: "Steward AI connections", iconSlug: "steward-ai" },
      { label: "Integrations", href: "/settings/integrations", description: "Connected services", iconSlug: "integrations" },
    ],
  },
  {
    label: "Workspaces & data",
    description: "Modules, layouts, fields and data tools",
    items: [
      { label: "CRM Modules", href: "/settings/modules", description: "Module access and readiness", iconSlug: "field-mapping" },
      { label: "Events CRM", href: "/settings/events", description: "Event workspace defaults", iconSlug: "event-fundraising" },
      { label: "Dashboard", href: "/settings/dashboard-appearance", description: "Shared dashboard layout", iconSlug: "donor-dashboard" },
      { label: "Custom Fields", href: "/settings/custom-fields", description: "Constituent and donation fields", iconSlug: "field-mapping" },
      { label: "Import & Export", href: "/settings/import-export", description: "Move and back up data", iconSlug: "documentation" },
    ],
  },
  {
    label: "Payments & website",
    description: "Giving providers and public forms",
    items: [
      { label: "Giving Payments", href: "/integrations/stripe", description: "Stripe and PayPal", iconSlug: "quickbooks-queue" },
      { label: "Site Embeds", href: "/settings/site-embeds", description: "Website forms and widgets", iconSlug: "communications" },
    ],
  },
  {
    label: "System & support",
    description: "Desktop app, updates and installation details",
    items: [
      { label: "Desktop App", href: "/settings/desktop-app", description: "Windows application", iconSlug: "documentation" },
      { label: "System Updates", href: "/settings/system-updates", description: "Release management", iconSlug: "giving-trends" },
      { label: "About", href: "/settings/about", description: "Version and support", iconSlug: "help" },
    ],
  },
];
