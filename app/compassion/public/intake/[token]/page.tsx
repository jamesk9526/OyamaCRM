import PublicCareWorkspace from "@/app/components/compassion/PublicCareWorkspace";
export default async function IntakeFormPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <PublicCareWorkspace mode="intake" token={token} />; }
