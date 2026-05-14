"use client";

interface TemplateCampaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  updatedAt: string;
  fromName: string;
  fromEmail: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  templateJson?: string | null;
}

interface CommunicationsTemplatesPanelProps {
  campaigns: TemplateCampaign[];
  creatingFromTemplateId: string | null;
  onOpenTemplate: (campaignId: string) => void;
  onCreateFromTemplate: (campaignId: string) => void;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CommunicationsTemplatesPanel({
  campaigns,
  creatingFromTemplateId,
  onOpenTemplate,
  onCreateFromTemplate,
}: CommunicationsTemplatesPanelProps) {
  const templateCandidates = campaigns
    .filter((campaign) => Boolean(campaign.subject || campaign.bodyHtml || campaign.bodyText || campaign.templateJson))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Email Templates</h2>
        <p className="mt-1 text-sm text-gray-600">
          Templates are reusable campaign drafts with real content. Open any template in Email Builder or clone it into a new draft campaign.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Reusable Campaign Templates</h3>
          <span className="text-xs text-gray-500">{templateCandidates.length} available</span>
        </div>

        <div className="space-y-2">
          {templateCandidates.map((campaign) => (
            <div key={campaign.id} className="rounded-lg border border-gray-200 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{campaign.name}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-600">{campaign.subject || "No subject"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    From {campaign.fromName} ({campaign.fromEmail}) · Updated {formatDateTime(campaign.updatedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenTemplate(campaign.id)}
                    className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Open in Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateFromTemplate(campaign.id)}
                    disabled={creatingFromTemplateId === campaign.id}
                    className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {creatingFromTemplateId === campaign.id ? "Creating..." : "Create From Template"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {templateCandidates.length === 0 && (
            <p className="text-sm text-gray-500">
              No template-ready campaigns yet. Create a campaign draft in Email Builder and add content to make it reusable.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
