import SurveyStudio from "@/app/components/surveys/SurveyStudio";

export default async function SurveyPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; response?: string; revision?: string; audience?: string }>;
}) {
  const [{ id }, { view, response, revision, audience }] = await Promise.all([params, searchParams]);
  return <SurveyStudio key={`${audience}:${id}`} id={id} audience={audience === "CLIENT" ? "CLIENT" : "DONOR"}
    initialStep={view} initialResponse={response} initialRevision={revision} />;
}
