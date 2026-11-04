import CreateWorkspace from "@/app/components/oyama-create/CreateWorkspace";
export default async function CreatePage({ params }: { params: Promise<{ segments?: string[] }> }) { const { segments = [] } = await params; return <CreateWorkspace segments={segments}/>; }
