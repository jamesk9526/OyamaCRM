import SurveyShell from "@/app/components/surveys/SurveyShell";
import "@/app/components/surveys/surveys.css";

export const metadata = { title: "Surveys | OyamaCRM", robots: { index: false, follow: false } };

export default function SurveysLayout({ children }: { children: React.ReactNode }) {
  return <SurveyShell>{children}</SurveyShell>;
}
