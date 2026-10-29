import ClientRecordWorkspace from "@/app/components/compassion/ClientRecordWorkspace";
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ClientRecordWorkspace id={id} />; }
