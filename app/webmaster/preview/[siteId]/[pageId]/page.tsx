import WebmasterDraftPreviewPage from "@/app/components/webmaster/WebmasterDraftPreviewPage";

interface WebmasterPreviewRouteProps {
  params: Promise<{ siteId: string; pageId: string }>;
  searchParams: Promise<{ draft?: string }>;
}

/** Preview route that renders draft website output without editor controls. */
export default async function WebmasterPreviewRoute({ params, searchParams }: WebmasterPreviewRouteProps) {
  const { siteId, pageId } = await params;
  const query = await searchParams;
  const draftMode = query?.draft === "1";

  return <WebmasterDraftPreviewPage siteId={siteId} pageId={pageId} draftMode={draftMode} />;
}
