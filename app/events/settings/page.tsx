/** Event settings workspace with admin integration import controls. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
  status?: string;
  type?: string;
}

interface PaymentGatewayPreview {
  currency: string;
  stripe: { enabled: boolean; mode: string; publishableKey: string; hasSecretKey: boolean; hasWebhookSecret: boolean };
  paypal: { enabled: boolean; mode: string; clientId: string; hasClientSecret: boolean; webhookId: string };
}

interface IntegrationSourcePreview {
  paymentGateway: PaymentGatewayPreview;
  emailProvider: {
    provider: "standard_smtp" | "microsoft_365_smtp" | "microsoft_graph";
    graphConnected: boolean;
    microsoftMailbox: string;
    microsoftTenantConfigured: boolean;
    microsoftClientConfigured: boolean;
    smtpHostOverride: string;
    smtpPortOverride: number;
    smtpSecureOverride: boolean;
  };
  smtp: {
    host: string;
    hostConfigured: boolean;
    port: number;
    secure: boolean;
    userConfigured: boolean;
    fromName: string;
    fromEmail: string;
  };
}

interface IntegrationSnapshot extends IntegrationSourcePreview {
  source: "donor_crm";
  importedAt: string;
  importedByUserId: string | null;
}

interface ManagerIntegrationsResponse {
  sourcePreview: IntegrationSourcePreview;
  importedSnapshot: IntegrationSnapshot | null;
  lastImportedAt: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function boolLabel(value: boolean, positive: string, negative: string): string {
  return value ? positive : negative;
}

/** EventSettingsPage provides event-level defaults plus admin integration import controls. */
export default function EventSettingsPage() {
  const { user } = useAuth();
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const workspaceEventId = params.eventId ?? searchParams.get("eventId") ?? "";
  const eventScoped = workspaceEventId.length > 0;
  const router = useRouter();

  // Legacy global route redirects to the event selector when no event is selected.
  useEffect(() => {
    if (!eventScoped) {
      router.replace("/events/events");
    }
  }, [eventScoped, router]);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [integrations, setIntegrations] = useState<ManagerIntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  const canManageIntegrations = user?.role === "admin";

  useEffect(() => {
    if (workspaceEventId) setSelectedEventId(workspaceEventId);
  }, [workspaceEventId]);

  async function loadWorkspace() {
    setLoading(true);
    setIntegrationError(null);
    try {
      const eventList = await apiFetch<EventItem[]>("/api/events");
      const activeEvents = (Array.isArray(eventList) ? eventList : []).filter((event) => event.active !== false);
      setEvents(activeEvents);
      if (!workspaceEventId && !selectedEventId && activeEvents.length > 0) {
        setSelectedEventId(activeEvents[0].id);
      }

      if (canManageIntegrations) {
        const integrationData = await apiFetch<ManagerIntegrationsResponse>("/api/events/manager-integrations");
        setIntegrations(integrationData);
      } else {
        setIntegrations(null);
      }
    } catch (error) {
      console.error("Failed to load Events settings workspace:", error);
      setIntegrationError("Could not load integration settings. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageIntegrations]);

  async function importFromDonorCrm() {
    if (!canManageIntegrations) return;
    setImporting(true);
    setIntegrationError(null);
    try {
      const imported = await apiFetch<{ importedSnapshot: IntegrationSnapshot }>("/api/events/manager-integrations/import", {
        method: "POST",
      });

      setIntegrations((previous) => {
        if (!previous) {
          return {
            sourcePreview: imported.importedSnapshot,
            importedSnapshot: imported.importedSnapshot,
            lastImportedAt: imported.importedSnapshot.importedAt,
          };
        }
        return {
          ...previous,
          sourcePreview: imported.importedSnapshot,
          importedSnapshot: imported.importedSnapshot,
          lastImportedAt: imported.importedSnapshot.importedAt,
        };
      });
    } catch (error) {
      console.error("Failed to import Donor CRM integrations:", error);
      setIntegrationError("Import failed. Confirm you have admin access and retry.");
    } finally {
      setImporting(false);
    }
  }

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const integrationsReady = Boolean(integrations?.sourcePreview.paymentGateway.stripe.enabled || integrations?.sourcePreview.paymentGateway.paypal.enabled)
    && Boolean(integrations?.sourcePreview.smtp.fromEmail || integrations?.sourcePreview.emailProvider.graphConnected);

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="event settings" />;
  }

  return (
    <div className="space-y-6 p-6">
      <FeatureStatusWarning
        status="Partially Implemented"
        title="Event settings is partially wired"
        description="Donor-CRM integration import (admin only) snapshots payment and email provider settings for event operations, but per-event branding, public-page defaults, and full settings persistence are not yet implemented. Removal: per-event settings model exists, save/load round-trip is wired, and a smoke test covers update + reload."
      />
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Settings" },
        ]}
        statusLabel={canManageIntegrations ? "Partially Working" : "Working"}
        metadata="Event defaults, manager integrations, and admin controls"
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Navigation">
          <WorkspaceRibbonButton label="Overview" href={selectedEventId ? `/events/${selectedEventId}/overview` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Emails" href={selectedEventId ? `/events/${selectedEventId}/emails` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Donations" href={selectedEventId ? `/events/${selectedEventId}/donations` : undefined} disabled={!selectedEventId} accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Admin">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadWorkspace()} accentTone="purple" />
          <WorkspaceRibbonButton label={importing ? "Importing..." : "Import Donor Settings"} onClick={() => void importFromDonorCrm()} disabled={!canManageIntegrations || importing} variant="primary" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Event context</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Events Manager Settings</h1>
            <p className="mt-1 text-sm text-slate-600">Manage event defaults and import payment/email configuration from Donor CRM for event operations.</p>
          </div>
          {!eventScoped ? (
            <label className="w-full max-w-sm space-y-1">
              <span className="text-xs font-semibold text-slate-600">Selected event</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                disabled={loading}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="">{loading ? "Loading events..." : "Select an event"}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} - {formatDate(event.startDate)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-violet-700">Event lock active. Switch from All Events.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Event</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{selectedEvent?.name ?? "No event selected"}</p>
          <p className="text-xs text-slate-500">{selectedEvent ? formatDate(selectedEvent.startDate) : "Choose an event to access event-scoped settings routes."}</p>
          <p className="mt-2 text-xs text-slate-500">Status: {selectedEvent?.status?.toLowerCase() ?? "n/a"}</p>
          {selectedEventId ? (
            <Link href={`/events/${selectedEventId}/settings`} className="mt-3 inline-flex text-xs font-semibold text-violet-700 hover:text-violet-900">
              Open event settings route
            </Link>
          ) : null}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manager Integrations</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{boolLabel(integrationsReady, "Ready", "Needs setup")}</p>
          <p className="text-xs text-slate-500">Last import: {formatDate(integrations?.lastImportedAt ?? null)}</p>
          <p className="mt-2 text-xs text-slate-500">This snapshot is admin-only and excludes secret values.</p>
          {!canManageIntegrations ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Admin access is required to import Donor CRM payment/email settings.
            </p>
          ) : null}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source Links</p>
          <div className="mt-2 space-y-2 text-xs">
            <Link href="/settings/payments" className="block font-semibold text-violet-700 hover:text-violet-900">Open Donor payment settings</Link>
            <Link href="/settings/email" className="block font-semibold text-violet-700 hover:text-violet-900">Open Donor email settings</Link>
            <Link href="/events/reports" className="block font-semibold text-violet-700 hover:text-violet-900">Open Events reports</Link>
          </div>
        </article>
      </section>

      {integrationError ? (
        <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {integrationError}
        </section>
      ) : null}

      {canManageIntegrations && integrations ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-violet-900">Payment gateway preview</h2>
            <p className="mt-1 text-xs text-violet-800">Currency: {integrations.sourcePreview.paymentGateway.currency}</p>
            <ul className="mt-3 space-y-1 text-xs text-slate-700">
              <li>Stripe: {boolLabel(integrations.sourcePreview.paymentGateway.stripe.enabled, "Enabled", "Disabled")} ({integrations.sourcePreview.paymentGateway.stripe.mode})</li>
              <li>Stripe secret configured: {boolLabel(integrations.sourcePreview.paymentGateway.stripe.hasSecretKey, "Yes", "No")}</li>
              <li>PayPal: {boolLabel(integrations.sourcePreview.paymentGateway.paypal.enabled, "Enabled", "Disabled")} ({integrations.sourcePreview.paymentGateway.paypal.mode})</li>
              <li>PayPal secret configured: {boolLabel(integrations.sourcePreview.paymentGateway.paypal.hasClientSecret, "Yes", "No")}</li>
            </ul>
          </article>

          <article className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-violet-900">Email + SMTP preview</h2>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              <li>Provider: {integrations.sourcePreview.emailProvider.provider}</li>
              <li>Graph connected: {boolLabel(integrations.sourcePreview.emailProvider.graphConnected, "Yes", "No")}</li>
              <li>SMTP host configured: {boolLabel(integrations.sourcePreview.smtp.hostConfigured, "Yes", "No")}</li>
              <li>SMTP user configured: {boolLabel(integrations.sourcePreview.smtp.userConfigured, "Yes", "No")}</li>
              <li>From email: {integrations.sourcePreview.smtp.fromEmail || "Not set"}</li>
            </ul>
          </article>
        </section>
      ) : null}
    </div>
  );
}

