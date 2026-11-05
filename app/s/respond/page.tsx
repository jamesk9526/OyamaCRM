import PublicSurvey from "@/app/components/surveys/PublicSurvey";
import "@/app/components/surveys/surveys.css";

export const metadata = {
  title: "Survey",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicSurveyPage() { return <PublicSurvey />; }
