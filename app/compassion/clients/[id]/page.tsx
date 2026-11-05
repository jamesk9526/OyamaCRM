import { Suspense } from "react";
import ClientRecordWorkspace from "@/app/components/compassion/ClientRecordWorkspace";
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Suspense fallback={<p role="status">Opening client file…</p>}><ClientRecordWorkspace id={id} /></Suspense>; }
