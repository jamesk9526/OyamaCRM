import PublicCampaign from "@/app/components/oyama-create/PublicCampaign";
export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PublicCampaign slug={slug}/>; }
