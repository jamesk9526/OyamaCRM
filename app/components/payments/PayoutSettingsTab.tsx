"use client";
/**
 * PayoutSettingsTab — configure how collected funds are deposited.
 * Settings: bank account details, payout schedule, minimum threshold, currency.
 * In production, saving would POST to /api/payments/payout-settings.
 */

import { useState } from "react";

export default function PayoutSettingsTab() {
  const [schedule, setSchedule] = useState("weekly");
  const [minAmount, setMinAmount] = useState("100");
  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaved(true);
    // TODO: POST /api/payments/payout-settings
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Bank account */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Deposit Bank Account</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. First National Bank"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account (last 4)</label>
            <input
              value={accountLast4}
              onChange={(e) => setAccountLast4(e.target.value)}
              placeholder="••••  1234"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <span>⚠</span>
          Full bank details are stored by your payment processor, not OyamaCRM.
        </p>
      </div>

      {/* Payout schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Payout Schedule</h3>
        <div className="grid grid-cols-3 gap-3">
          {["daily", "weekly", "monthly"].map((s) => (
            <button
              key={s}
              onClick={() => setSchedule(s)}
              className={`py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors
                ${schedule === s
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Minimum payout threshold ($)</label>
          <input
            type="number"
            min="1"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-32 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">Payouts only trigger when balance exceeds this amount.</p>
        </div>
      </div>

      {/* Currency */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Currency</h3>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
          <option>USD — US Dollar</option>
          <option>CAD — Canadian Dollar</option>
          <option>GBP — British Pound</option>
          <option>EUR — Euro</option>
          <option>AUD — Australian Dollar</option>
        </select>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
      >
        {saved ? "✓ Saved!" : "Save Payout Settings"}
      </button>
    </div>
  );
}
