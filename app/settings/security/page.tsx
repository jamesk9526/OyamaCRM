/** Security settings page surfaces auth hardening work plus destructive recovery controls. */
import SettingsResetPanel from "@/app/components/settings/SettingsResetPanel";

/** SecuritySettingsPage defines the security tab backlog and the verified reset flow. */
export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Security</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Control authentication policies, destructive recovery behavior, and other high-risk settings.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-gray-900">Security backlog</h2>
          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
            Foundation Ready
          </span>
        </div>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>Manage password and session policies.</li>
          <li>Configure two-factor requirements.</li>
          <li>Set login lockout and domain restrictions.</li>
          <li>Review sensitive-data access rules and audit coverage.</li>
        </ul>
      </section>

      <SettingsResetPanel />
    </div>
  );
}

