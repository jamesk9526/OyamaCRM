import { Suspense } from "react";
import FormEditor from "@/app/components/compassion/forms/FormEditor";
export default async function PaperFormPage({ params }: { params: Promise<{ id: string; formId: string }> }) {
  const { id, formId } = await params;
  return <Suspense fallback={<p role="status">Opening form…</p>}><FormEditor clientId={id} recordId={formId} /></Suspense>;
}
