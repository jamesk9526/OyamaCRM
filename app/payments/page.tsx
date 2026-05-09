/**
 * Payment Portal page — /payments
 * Central hub for connecting and configuring payment processors.
 * Tabs: Connected Processors | Transaction Log | Payout Settings | Webhook Events
 */
"use client";

import { useState } from "react";
import ProcessorsTab from "@/app/components/payments/ProcessorsTab";
import TransactionLogTab from "@/app/components/payments/TransactionLogTab";
import PayoutSettingsTab from "@/app/components/payments/PayoutSettingsTab";
import WebhookEventsTab from "@/app/components/payments/WebhookEventsTab";

type Tab = "processors" | "transactions" | "payouts" | "webhooks";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "processors", label: "Payment Processors", icon: "💳" },
  { id: "transactions", label: "Transaction Log", icon: "📋" },
  { id: "payouts", label: "Payout Settings", icon: "🏦" },
  { id: "webhooks", label: "Webhook Events", icon: "🔔" },
];

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("processors");

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payment Portal</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect payment processors, manage transactions, and configure payout settings.
          </p>
        </div>
        {/* Status pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs font-medium text-amber-700">No processor active</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === "processors" && <ProcessorsTab />}
        {activeTab === "transactions" && <TransactionLogTab />}
        {activeTab === "payouts" && <PayoutSettingsTab />}
        {activeTab === "webhooks" && <WebhookEventsTab />}
      </div>
    </div>
  );
}
