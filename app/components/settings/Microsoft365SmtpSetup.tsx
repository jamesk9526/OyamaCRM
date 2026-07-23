/**
 * Microsoft 365 SMTP Email Provider Configuration Component
 * Provides guided setup for Microsoft 365 email in OyamaCRM
 */
"use client";

import { useState } from "react";

interface Microsoft365SmtpSetupProps {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  smtpFromEmail: string;
  onUpdate: (key: string, value: unknown) => void;
  onTestSend: (email: string) => Promise<void>;
  testLoading?: boolean;
  testMessage?: string | null;
  testError?: string | null;
}

export function Microsoft365SmtpSetupComponent({
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  smtpFromName,
  smtpFromEmail,
  onUpdate,
  onTestSend,
  testLoading,
  testMessage,
  testError,
}: Microsoft365SmtpSetupProps) {
  const [testEmail, setTestEmail] = useState("");
  const [expandedSection, setExpandedSection] = useState<"credentials" | "advanced" | "help">("credentials");

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      alert("Please enter a test email address");
      return;
    }
    await onTestSend(testEmail);
  };

  return (
    <div className="space-y-4">
      {/* Microsoft 365 Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1 text-sm text-blue-800">
            <p className="font-semibold mb-1">Microsoft 365 SMTP Configuration</p>
            <p className="mb-2">
              OyamaCRM v1.3 uses smtp.office365.com with port 587 and STARTTLS for secure, production-ready email delivery.
            </p>
            <p className="text-xs text-blue-700 mb-2">
              ⚠️ Before configuring: Enable Authenticated SMTP for your mailbox in Microsoft 365 Admin Center.{" "}
              <a
                href="https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                Learn how →
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Credentials Section */}
      <div
        className="rounded-lg border border-gray-200 p-4 space-y-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpandedSection(expandedSection === "credentials" ? "help" : "credentials")}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between font-semibold text-gray-900"
        >
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" />
            </svg>
            Microsoft 365 Mailbox & Credentials
          </span>
          <svg
            className={`h-5 w-5 transition-transform ${expandedSection === "credentials" ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {expandedSection === "credentials" && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Microsoft 365 Mailbox Email
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => onUpdate("smtpUser", e.target.value)}
                  placeholder="no-reply@yourdomain.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your Microsoft 365 licensed mailbox (UPN format). This mailbox must have Authenticated SMTP enabled.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  SMTP Password or App Password
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => onUpdate("smtpPass", e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If MFA is enabled on your account, use an App Password instead of your account password.{" "}
                  <a
                    href="https://support.microsoft.com/en-us/account-billing/set-up-an-app-password-for-your-work-or-school-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Generate one →
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  From Email Address
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={smtpFromEmail}
                  onChange={(e) => onUpdate("smtpFromEmail", e.target.value)}
                  placeholder="no-reply@yourdomain.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email address campaigns will be sent from. Usually matches your Microsoft 365 mailbox.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From Name (Organization)</label>
                <input
                  type="text"
                  value={smtpFromName}
                  onChange={(e) => onUpdate("smtpFromName", e.target.value)}
                  placeholder="Hope Community Foundation"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Friendly name shown in recipient's email client, e.g., "Hope Community Foundation &lt;no-reply@yourdomain.com&gt;"
                </p>
              </div>
            </div>

            {/* Test Send */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Test Email Configuration</p>
              <div className="flex gap-2 flex-col sm:flex-row">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@organization.org"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  disabled={testLoading || !testEmail.trim()}
                  onClick={handleTestSend}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {testLoading ? "Sending..." : "Send Test Email"}
                </button>
              </div>
              {testMessage && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded">{testMessage}</p>}
              {testError && <p className="text-xs text-red-700 bg-red-50 px-3 py-2 rounded">{testError}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Section */}
      <div
        className="rounded-lg border border-gray-200 p-4 space-y-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpandedSection(expandedSection === "advanced" ? "help" : "advanced")}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between font-semibold text-gray-900"
        >
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.286c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.286c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zm-7.698 12.999a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Advanced Settings
          </span>
          <svg
            className={`h-5 w-5 transition-transform ${expandedSection === "advanced" ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {expandedSection === "advanced" && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-600">
              Only override these settings if your organization requires a custom mail server or uses a mail relay.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Host Override</label>
                <input
                  value={smtpHost}
                  onChange={(e) => onUpdate("smtpHost", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="smtp.office365.com"
                />
                <p className="text-xs text-gray-500 mt-1">Default: smtp.office365.com</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Port Override</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => onUpdate("smtpPort", Number(e.target.value) || 587)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Default: 587 (STARTTLS), Alt: 465 (SMTPS)</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 mt-6">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => onUpdate("smtpSecure", e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs">Force SMTPS (port 465)</span>
              </label>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
              ⚠️ Microsoft recommends port 587 with STARTTLS. Only change if your network requires port 465.
            </div>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div
        className="rounded-lg border border-gray-200 p-4 space-y-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpandedSection(expandedSection === "help" ? "credentials" : "help")}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between font-semibold text-gray-900"
        >
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Troubleshooting & Common Issues
          </span>
          <svg
            className={`h-5 w-5 transition-transform ${expandedSection === "help" ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {expandedSection === "help" && (
          <div className="space-y-3 border-t border-gray-100 pt-3 text-sm">
            <div>
              <p className="font-semibold text-gray-900 mb-1">❌ "Authentication unsuccessful" (Error 535)</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs ml-2">
                <li>Check that Authenticated SMTP is enabled for the mailbox in Microsoft 365 Admin Center</li>
                <li>If using MFA, generate an App Password and use that instead of your account password</li>
                <li>Verify the mailbox email is in the format: name@yourdomain.com</li>
                <li>Wait 10-15 minutes for SMTP AUTH changes to propagate</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1">❌ "TLS Negotiation Failed"</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs ml-2">
                <li>Verify port 587 is not blocked by your firewall</li>
                <li>If port 587 is blocked, try port 465 with "Force SMTPS" enabled</li>
                <li>Contact your IT administrator if both ports are blocked</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1">❌ Test email arrives in Spam</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs ml-2">
                <li>Check that your domain has SPF, DKIM, and DMARC records configured</li>
                <li>Mark the test email as "Not Spam" in the recipient's inbox</li>
                <li>For production, consider using a reputable email service (SendGrid, Mailgun) to improve deliverability</li>
              </ul>
            </div>

            <a
              href="https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-600 hover:underline text-xs font-semibold mt-2"
            >
              📖 Read Full Microsoft 365 Setup Guide →
            </a>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="rounded-lg border-l-4 border-l-green-500 bg-green-50 p-3">
        <p className="text-xs text-green-800">
          ✅ <strong>Provider</strong>: Microsoft 365 SMTP | <strong>Port</strong>: 587 (STARTTLS) | <strong>TLS</strong>: 1.2+ required
        </p>
      </div>
    </div>
  );
}
