// Deep link route for the guided Report Builder Lite flow.

import ReportsApp from "@/app/components/reports-app/ReportsApp";

export const metadata = { title: "Report Builder Lite - Oyama Reports" };

/** Opens Oyama Reports directly in the custom report builder flow. */
export default function ReportsBuilderPage() {
  return <ReportsApp initialMode="builder" />;
}
