import SurveyLibrary from "@/app/components/surveys/SurveyLibrary";

export default async function SurveysPage({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const { audience } = await searchParams;
  return <SurveyLibrary initialAudience={audience} />;
}
