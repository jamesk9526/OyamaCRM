export type ImplementationStatus =
  | "Not Started"
  | "UI Shell Only"
  | "Partially Working"
  | "Working"
  | "Tested"
  | "Production Ready";

export interface WebmasterModuleStatus {
  key: string;
  name: string;
  status: ImplementationStatus;
  note: string;
}

export const WEBMASTER_MODULE_STATUSES: WebmasterModuleStatus[] = [
  {
    key: "sites",
    name: "Sites",
    status: "Partially Working",
    note: "Site and page records are persisted and editable through API-backed UI.",
  },
  {
    key: "builder",
    name: "Visual Builder",
    status: "Partially Working",
    note: "Builder shell, section registry, and save/load flow are wired; advanced inline editing and responsive controls are still being expanded.",
  },
  {
    key: "templates",
    name: "Templates",
    status: "UI Shell Only",
    note: "Template entry points and guidance are visible, but full template CRUD is still being built.",
  },
  {
    key: "sections",
    name: "Section Registry",
    status: "Partially Working",
    note: "Starter section manifests are registered and insertable in the builder.",
  },
  {
    key: "blocks",
    name: "Blocks",
    status: "UI Shell Only",
    note: "Basic text/image/button rendering exists; full block editing matrix is pending.",
  },
  {
    key: "theme",
    name: "Theme",
    status: "Not Started",
    note: "Brand kit and token management UI are not yet implemented.",
  },
  {
    key: "cms",
    name: "CMS Collections",
    status: "UI Shell Only",
    note: "Collection workflows are planned but not yet persisted.",
  },
  {
    key: "forms",
    name: "Forms",
    status: "UI Shell Only",
    note: "Form builder and submission flows are not yet implemented.",
  },
  {
    key: "assets",
    name: "Assets",
    status: "UI Shell Only",
    note: "Asset library workflows are scaffolded conceptually and still under development.",
  },
  {
    key: "seo",
    name: "SEO",
    status: "Not Started",
    note: "SEO panel, checks, and schema generation are planned.",
  },
  {
    key: "publishing",
    name: "Publishing",
    status: "Not Started",
    note: "Publish targets, history, and rollback are not yet implemented.",
  },
  {
    key: "integrations",
    name: "Integrations",
    status: "Not Started",
    note: "Donation, analytics, and embed integrations are still in planning.",
  },
  {
    key: "preflight",
    name: "Preflight",
    status: "Not Started",
    note: "Preflight checks for export/publish readiness are planned.",
  },
];

export function findWebmasterModuleStatus(key: string): WebmasterModuleStatus | null {
  return WEBMASTER_MODULE_STATUSES.find((entry) => entry.key === key) ?? null;
}
