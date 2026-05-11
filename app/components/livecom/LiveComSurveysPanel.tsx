// Survey operations panel for LiveCom donor feedback programs.
"use client";

import type { LiveComSurvey, LiveComSurveyStatus } from "@/app/components/livecom/livecom-types";

interface LiveComSurveysPanelProps {
  surveys: LiveComSurvey[];
}

/**
 * LiveComSurveysPanel displays survey flow status and response performance.
 */
export default function LiveComSurveysPanel({ surveys }: LiveComSurveysPanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Surveys</h2>
        <p className="mt-0.5 text-xs text-gray-500">Measure donor experience from chat follow-ups and campaign loops.</p>
      </div>

      <div className="space-y-3 px-5 py-4">
        {surveys.map((survey) => (
          <div key={survey.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{survey.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Channel: {channelLabel(survey.channel)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(survey.status)}`}>
                {survey.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <span>{survey.responses.toLocaleString()} responses</span>
              <span>{survey.responseRate}% response rate</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function statusTone(status: LiveComSurveyStatus): string {
  if (status === "LIVE") return "bg-green-100 text-green-700";
  if (status === "PAUSED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function channelLabel(channel: LiveComSurvey["channel"]): string {
  if (channel === "POST_CHAT") return "Post Chat";
  if (channel === "CAMPAIGN_FOLLOW_UP") return "Campaign Follow-up";
  return "Website Form";
}
