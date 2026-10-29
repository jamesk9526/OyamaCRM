import PublicCareWorkspace from "@/app/components/compassion/PublicCareWorkspace";
export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <PublicCareWorkspace mode="portal" token={token} />; }
