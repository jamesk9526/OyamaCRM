// Module communication settings skeleton page for DonorCRM, Compassion CRM, and Events CRM.

interface ModuleCommunicationCard {
  moduleName: string;
  accent: string;
  title: string;
  checklist: string[];
}

const MODULE_CARDS: ModuleCommunicationCard[] = [
  {
    moduleName: "DonorCRM",
    accent: "bg-green-50 border-green-200 text-green-800",
    title: "Fundraising Communications",
    checklist: [
      "Email sender identity and reply mailbox",
      "SMS sender and opt-out language",
      "Appeal, receipt, and stewardship templates",
      "Notification defaults for donation workflows",
    ],
  },
  {
    moduleName: "Compassion CRM",
    accent: "bg-blue-50 border-blue-200 text-blue-800",
    title: "Client Care Communications",
    checklist: [
      "Email and SMS sender settings for care teams",
      "Consent and privacy-safe communication rules",
      "Appointment and follow-up message templates",
      "Client communication log visibility defaults",
    ],
  },
  {
    moduleName: "Events CRM",
    accent: "bg-amber-50 border-amber-200 text-amber-800",
    title: "Event Operations Communications",
    checklist: [
      "Event-specific sender profile and domains",
      "Guest reminders and check-in notifications",
      "Sponsor and volunteer message templates",
      "Post-event follow-up automation defaults",
    ],
  },
];

/**
 * EmailSettingsPage defines module-specific communication scaffolding.
 * TODO: backend API needed for module-level sender profiles and consent policy persistence.
 */
export default function EmailSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Email and SMS by CRM Module</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Communication settings are module-specific. Donor, Compassion, and Events workflows have separate defaults,
          templates, and privacy expectations.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        This is a skeleton settings surface. Configuration persistence, delivery providers, and audit-backed message
        logs are planned and not fully implemented yet.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {MODULE_CARDS.map((card) => (
          <section key={card.moduleName} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className={`inline-flex text-xs font-semibold px-2 py-1 rounded-full border ${card.accent}`}>
              {card.moduleName}
            </p>
            <h2 className="text-sm font-semibold text-gray-900 mt-3">{card.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {card.checklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

