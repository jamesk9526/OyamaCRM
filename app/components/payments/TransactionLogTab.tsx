"use client";
/**
 * TransactionLogTab — shows a mock/placeholder transaction history table.
 * In production this would fetch from /api/payments/transactions with pagination.
 * Columns: date, donor, amount, processor, status, receipt.
 */

import { useState } from "react";

interface Transaction {
  id: string;
  date: string;
  donorName: string;
  amount: number;
  processor: string;
  method: string;
  status: "completed" | "pending" | "failed" | "refunded";
  receiptId: string;
}

/** Sample data — will be replaced by live API */
const MOCK: Transaction[] = [
  { id: "txn_001", date: "2026-05-08", donorName: "James K.", amount: 500, processor: "Stripe", method: "Credit Card", status: "completed", receiptId: "RC-0041" },
  { id: "txn_002", date: "2026-05-07", donorName: "Mary Johnson", amount: 100, processor: "PayPal", method: "PayPal Wallet", status: "completed", receiptId: "RC-0040" },
  { id: "txn_003", date: "2026-05-06", donorName: "Aurora Community", amount: 2500, processor: "ACH", method: "Bank Transfer", status: "pending", receiptId: "RC-0039" },
  { id: "txn_004", date: "2026-05-05", donorName: "Robert Davis", amount: 50, processor: "Venmo", method: "Venmo", status: "completed", receiptId: "RC-0038" },
  { id: "txn_005", date: "2026-05-03", donorName: "Anonymous", amount: 250, processor: "Stripe", method: "Credit Card", status: "refunded", receiptId: "RC-0037" },
];

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-600",
};

export default function TransactionLogTab() {
  const [search, setSearch] = useState("");
  const filtered = MOCK.filter((t) =>
    t.donorName.toLowerCase().includes(search.toLowerCase()) ||
    t.processor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by donor or processor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button className="px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          ↓ Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Donor</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Processor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-600 text-xs">{t.date}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{t.donorName}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">${t.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600">{t.processor}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t.method}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[t.status]}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-green-600 hover:underline cursor-pointer">{t.receiptId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No transactions found.</div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        // TODO: Connect to live transaction data from active payment processors
      </p>
    </div>
  );
}
