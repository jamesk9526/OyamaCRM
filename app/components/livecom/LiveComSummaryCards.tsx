// Summary KPI cards for the LiveCom donor interaction workspace.
"use client";

interface LiveComSummaryCardsProps {
  openConversations: number;
  newConversations: number;
  waitingOnDonor: number;
  liveSurveys: number;
  pendingFormSubmissions: number;
}

/**
 * LiveComSummaryCards renders top-line inbound interaction health metrics.
 */
export default function LiveComSummaryCards({
  openConversations,
  newConversations,
  waitingOnDonor,
  liveSurveys,
  pendingFormSubmissions,
}: LiveComSummaryCardsProps) {
  const cards = [
    {
      label: "Open Conversations",
      value: openConversations.toLocaleString(),
      helper: "Web chat and form threads not resolved",
    },
    {
      label: "New This Hour",
      value: newConversations.toLocaleString(),
      helper: "Fresh donor messages waiting triage",
    },
    {
      label: "Waiting On Donor",
      value: waitingOnDonor.toLocaleString(),
      helper: "Follow-up prompts sent, waiting reply",
    },
    {
      label: "Live Surveys",
      value: liveSurveys.toLocaleString(),
      helper: "Active donor feedback flows",
    },
    {
      label: "New Form Submissions",
      value: pendingFormSubmissions.toLocaleString(),
      helper: "Unread website contact form entries",
    },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
          <p className="mt-1 text-xs text-gray-500">{card.helper}</p>
        </div>
      ))}
    </section>
  );
}
