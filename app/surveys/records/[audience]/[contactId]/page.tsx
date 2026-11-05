import { notFound } from "next/navigation";
import SurveyRecordHistory from "@/app/components/surveys/SurveyRecordHistory";

export default async function SurveyRecordPage({ params }: { params: Promise<{ audience: string; contactId: string }> }) {
  const { audience, contactId } = await params;
  if (audience !== "CLIENT" && audience !== "DONOR") notFound();
  return <SurveyRecordHistory audience={audience} id={contactId} />;
}
