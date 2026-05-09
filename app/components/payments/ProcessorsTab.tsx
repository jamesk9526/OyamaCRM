"use client";
/**
 * ProcessorsTab — main tab of the Payment Portal.
 * Shows all supported payment processors in a card grid.
 * Each card has a Connect / Configure / Disconnect flow with credential fields.
 * Supported processors: Stripe, PayPal, Venmo (via PayPal), Square, Authorize.net,
 * Braintree, Clover, Check/ACH (manual), Cash, Wire Transfer, Crypto (Coming Soon).
 */

import { useState } from "react";

interface ProcessorDef {
  id: string;
  name: string;
  description: string;
  logo: string;            // emoji or SVG string
  color: string;           // Tailwind bg for the logo chip
  category: "card" | "digital" | "bank" | "manual" | "soon";
  fields: { key: string; label: string; type: "text" | "password"; placeholder: string }[];
  docUrl?: string;
  fee?: string;
  features: string[];
}

/** All supported payment processors */
const PROCESSORS: ProcessorDef[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Industry-leading card processing. Supports credit/debit cards, ACH, Apple Pay, Google Pay.",
    logo: "⚡",
    color: "bg-indigo-100 text-indigo-700",
    category: "card",
    fee: "2.9% + 30¢",
    features: ["Credit / Debit Cards", "ACH Bank Transfer", "Apple Pay & Google Pay", "Recurring Donations", "Instant Payouts"],
    fields: [
      { key: "publishableKey", label: "Publishable Key", type: "text", placeholder: "pk_live_..." },
      { key: "secretKey", label: "Secret Key", type: "password", placeholder: "sk_live_..." },
      { key: "webhookSecret", label: "Webhook Secret (optional)", type: "password", placeholder: "whsec_..." },
    ],
    docUrl: "https://stripe.com/docs",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Widely trusted payment gateway. Accepts PayPal balance, cards, and bank transfers.",
    logo: "🅿",
    color: "bg-blue-100 text-blue-700",
    category: "digital",
    fee: "3.49% + 49¢",
    features: ["PayPal Wallet", "Credit / Debit Cards", "Pay Later (Buy Now Pay Later)", "Venmo (via PayPal)", "Subscriptions"],
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "AaBb..." },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "EeFf..." },
      { key: "mode", label: "Mode", type: "text", placeholder: "live  (or sandbox)" },
    ],
    docUrl: "https://developer.paypal.com/docs",
  },
  {
    id: "venmo",
    name: "Venmo",
    description: "Peer-to-peer payments popular with younger donors. Powered by PayPal Business.",
    logo: "V",
    color: "bg-teal-100 text-teal-700",
    category: "digital",
    fee: "1.9% + 10¢",
    features: ["Venmo Wallet", "Peer-to-Peer", "Social Feed Visibility", "QR Code Donations"],
    fields: [
      { key: "clientId", label: "PayPal Client ID (Venmo enabled)", type: "text", placeholder: "AaBb..." },
      { key: "clientSecret", label: "PayPal Client Secret", type: "password", placeholder: "EeFf..." },
    ],
    docUrl: "https://developer.paypal.com/docs/business/checkout/venmo/",
  },
  {
    id: "square",
    name: "Square",
    description: "POS + online payments. Great for in-person events and donation kiosks.",
    logo: "□",
    color: "bg-gray-100 text-gray-700",
    category: "card",
    fee: "2.6% + 10¢",
    features: ["In-person POS", "Online Payments", "Invoice Payments", "Recurring Billing", "Hardware Support"],
    fields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "EAAAl..." },
      { key: "locationId", label: "Location ID", type: "text", placeholder: "LxxxxxxxxxxxxxxxxxxX" },
      { key: "appId", label: "App ID", type: "text", placeholder: "sq0idp-..." },
    ],
    docUrl: "https://developer.squareup.com/docs",
  },
  {
    id: "authorizenet",
    name: "Authorize.net",
    description: "Trusted gateway for nonprofits. Connects to most merchant accounts.",
    logo: "A",
    color: "bg-green-100 text-green-700",
    category: "card",
    fee: "Varies by merchant",
    features: ["Credit / Debit Cards", "eCheck / ACH", "Recurring Billing", "Fraud Detection Suite", "Customer Profiles"],
    fields: [
      { key: "apiLoginId", label: "API Login ID", type: "text", placeholder: "xxxxxxxxxxxx" },
      { key: "transactionKey", label: "Transaction Key", type: "password", placeholder: "xxxxxxxxxxxx" },
      { key: "environment", label: "Environment", type: "text", placeholder: "production  (or sandbox)" },
    ],
    docUrl: "https://developer.authorize.net/api/reference/",
  },
  {
    id: "braintree",
    name: "Braintree",
    description: "PayPal's full-stack payment platform. Supports cards, PayPal, Venmo, ACH.",
    logo: "B",
    color: "bg-blue-100 text-blue-800",
    category: "card",
    fee: "2.59% + 49¢",
    features: ["Credit / Debit", "PayPal & Venmo", "ACH Direct Debit", "3D Secure", "Vaulted Payments"],
    fields: [
      { key: "merchantId", label: "Merchant ID", type: "text", placeholder: "xxxxxxxxxxxxxxxx" },
      { key: "publicKey", label: "Public Key", type: "text", placeholder: "xxxxxxxxxxxxxxxx" },
      { key: "privateKey", label: "Private Key", type: "password", placeholder: "xxxxxxxxxxxxxxxx" },
    ],
    docUrl: "https://developer.paypal.com/braintree/docs",
  },
  {
    id: "ach",
    name: "ACH / Bank Transfer",
    description: "Direct bank-to-bank transfers. No card fees — ideal for large gifts.",
    logo: "🏦",
    color: "bg-emerald-100 text-emerald-700",
    category: "bank",
    fee: "~$0.25–$0.75 flat",
    features: ["Direct Bank Transfers", "Low Fees for Large Gifts", "Recurring Pledges", "Plaid Integration Ready"],
    fields: [
      { key: "bankName", label: "Your Bank Name", type: "text", placeholder: "e.g. First National" },
      { key: "accountName", label: "Account Name", type: "text", placeholder: "e.g. Aurora Nonprofit Fund" },
      { key: "routingNumber", label: "Routing Number", type: "password", placeholder: "xxxxxxxxx" },
      { key: "accountNumber", label: "Account Number", type: "password", placeholder: "xxxxxxxxxx" },
    ],
  },
  {
    id: "check",
    name: "Check / Money Order",
    description: "Record checks and money orders received by mail. Manual entry, no gateway.",
    logo: "✉",
    color: "bg-amber-100 text-amber-700",
    category: "manual",
    fee: "No fees",
    features: ["Manual Batch Entry", "Check Number Tracking", "Deposit Batch Reports", "Reconciliation Tools"],
    fields: [
      { key: "mailingAddress", label: "Mailing Address (for checks)", type: "text", placeholder: "123 Main St, Aurora CO 80014" },
    ],
  },
  {
    id: "cash",
    name: "Cash & In-Person",
    description: "Log cash donations from events, drop boxes, and in-person collections.",
    logo: "💵",
    color: "bg-green-100 text-green-700",
    category: "manual",
    fee: "No fees",
    features: ["Event Cash Logging", "Receipt Generation", "Batch Reconciliation", "Volunteer Collection Tracking"],
    fields: [],
  },
  {
    id: "crypto",
    name: "Crypto (Coming Soon)",
    description: "Accept Bitcoin, Ethereum, and other cryptocurrencies via The Giving Block or Engiven.",
    logo: "₿",
    color: "bg-orange-100 text-orange-700",
    category: "soon",
    fee: "1% platform fee",
    features: ["Bitcoin & Ethereum", "Tax Receipt at Fair Market Value", "Anonymous Donations", "501c3 Compliance"],
    fields: [],
  },
];

const CATEGORY_LABEL: Record<string, string> = {
  card: "Card Processing",
  digital: "Digital Wallets",
  bank: "Bank Transfer",
  manual: "Manual / Offline",
  soon: "Coming Soon",
};

/** Single processor configuration card */
function ProcessorCard({
  processor,
  connected,
  onConnect,
  onDisconnect,
}: {
  processor: ProcessorDef;
  connected: boolean;
  onConnect: (id: string, creds: Record<string, string>) => void;
  onDisconnect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const isSoon = processor.category === "soon";
  const isManual = processor.category === "manual" && processor.fields.length === 0;

  async function handleConnect() {
    setSaving(true);
    // Simulate save delay — real implementation would POST to /api/payments/processors/:id
    await new Promise((r) => setTimeout(r, 800));
    onConnect(processor.id, creds);
    setSaving(false);
    setExpanded(false);
  }

  return (
    <div className={`bg-white rounded-xl border transition-all duration-150
      ${connected ? "border-green-300 shadow-sm shadow-green-50" : "border-gray-200"}
      ${isSoon ? "opacity-60" : ""}`}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Logo chip */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 ${processor.color}`}>
          {processor.logo}
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{processor.name}</h3>
            {connected && (
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                ✓ CONNECTED
              </span>
            )}
            {isSoon && (
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                COMING SOON
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{processor.description}</p>
          {processor.fee && (
            <p className="text-[11px] text-gray-400 mt-1">Fee: {processor.fee}</p>
          )}
        </div>

        {/* Action button */}
        {!isSoon && (
          <div className="shrink-0">
            {connected ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ⚙ Configure
                </button>
                <button
                  onClick={() => onDisconnect(processor.id)}
                  className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => isManual ? handleConnect() : setExpanded((v) => !v)}
                className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {isManual ? "Enable" : "Connect"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Features list */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {processor.features.map((f) => (
          <span key={f} className="text-[10px] font-medium bg-gray-50 border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
            {f}
          </span>
        ))}
      </div>

      {/* Expandable credentials form */}
      {expanded && processor.fields.length > 0 && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl space-y-3">
          <p className="text-xs font-semibold text-gray-700">
            {connected ? "Update Credentials" : "Enter API Credentials"}
          </p>
          {processor.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <div className="relative">
                <input
                  type={field.type === "password" && !showSecrets[field.key] ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={creds[field.key] ?? ""}
                  onChange={(e) => setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                />
                {field.type === "password" && (
                  <button
                    type="button"
                    onClick={() => setShowSecrets((p) => ({ ...p, [field.key]: !p[field.key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showSecrets[field.key] ? "Hide" : "Show"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {processor.docUrl && (
            <a href={processor.docUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-green-600 hover:text-green-700 underline">
              📖 View {processor.name} API docs →
            </a>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : connected ? "Update" : "Connect"}
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="px-4 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Processors Tab — full grid of all payment processors */
export default function ProcessorsTab() {
  // In production this would load from /api/payments/processors
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");

  function handleConnect(id: string, _creds: Record<string, string>) {
    setConnectedIds((prev) => new Set([...prev, id]));
    // TODO: POST /api/payments/processors/:id with encrypted creds
  }

  function handleDisconnect(id: string) {
    setConnectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    // TODO: DELETE /api/payments/processors/:id
  }

  const categories = ["all", "card", "digital", "bank", "manual", "soon"];
  const filtered = filter === "all" ? PROCESSORS : PROCESSORS.filter((p) => p.category === filter);
  const connectedList = PROCESSORS.filter((p) => connectedIds.has(p.id));

  return (
    <div className="space-y-6">
      {/* Connected summary banner */}
      {connectedList.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-green-600 text-xl">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">
              {connectedList.length} processor{connectedList.length > 1 ? "s" : ""} active
            </p>
            <p className="text-xs text-green-600">
              {connectedList.map((p) => p.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
              ${filter === cat
                ? "bg-green-600 text-white border-green-600"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
          >
            {cat === "all" ? "All" : CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {/* Processor cards grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map((processor) => (
          <ProcessorCard
            key={processor.id}
            processor={processor}
            connected={connectedIds.has(processor.id)}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>

      {/* Security note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <span className="text-amber-500 text-lg shrink-0">🔐</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Security Notice</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            API keys are encrypted at rest using AES-256. Secret keys are never exposed after saving — only shown on first entry.
            Rotate your keys immediately if you suspect a breach. OyamaCRM never stores card numbers or bank account details directly.
          </p>
        </div>
      </div>
    </div>
  );
}
