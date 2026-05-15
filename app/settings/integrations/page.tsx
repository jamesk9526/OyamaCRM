/** Unified integrations page combines integration readiness and plugin management. */
import IntegrationsSettingsPage from "@/app/components/settings/integrations/IntegrationsSettingsPage";
import PluginsSettingsPage from "@/app/components/settings/plugins/PluginsSettingsPage";

/** IntegrationsSettingsRoute renders one combined workspace for integrations and plugins. */
export default function IntegrationsSettingsRoute() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Unified workspace for integration readiness, plugin controls, and third-party connection management.
        </p>
      </div>

      <section id="readiness" className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Integration Readiness</h2>
        <IntegrationsSettingsPage embedded />
      </section>

      <section id="plugins" className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Plugin Controls</h2>
        <PluginsSettingsPage embedded />
      </section>
    </div>
  );
}

