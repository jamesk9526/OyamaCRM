import MessagesWorkspace from "@/app/components/compassion/MessagesWorkspace";
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) { const query = await searchParams; return <MessagesWorkspace initialClientId={query.clientId} />; }
