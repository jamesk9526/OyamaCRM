import WebmasterWorkspacePlaceholder from "@/app/components/webmaster/WebmasterWorkspacePlaceholder";

const WORKSPACES = new Set(["templates", "cms", "assets", "forms", "settings", "sites", "theme", "publishing", "seo"]);

interface WebmasterWorkspacePageProps {
  params: Promise<{ workspace: string }>;
}

/** Dynamic workspace route for in-progress Webmaster feature areas. */
export default async function WebmasterWorkspacePage({ params }: WebmasterWorkspacePageProps) {
  const { workspace } = await params;

  if (!WORKSPACES.has(workspace)) {
    return <WebmasterWorkspacePlaceholder workspace="unknown" />;
  }

  return <WebmasterWorkspacePlaceholder workspace={workspace} />;
}
