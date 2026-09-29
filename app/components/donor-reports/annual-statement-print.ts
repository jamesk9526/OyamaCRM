export interface AnnualGivingStatement {
  organizationName: string;
  organizationAddress: string;
  organizationPhone: string;
  organizationTaxId: string;
  constituent: { id: string; name: string; addressLines: string[]; email: string | null };
  calendarYear: number;
  gifts: Array<{
    date: string;
    giftId: string;
    receiptNumber: string | null;
    event: string | null;
    comment: string | null;
    checkNumber: string | null;
    paymentMethod: string;
    amount: number;
    taxDeductibleAmount: number;
    taxDeductibleNotes: string | null;
  }>;
  totalAmount: number;
  taxDeductibleAmount: number;
  generatedAt: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function giftDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
}

function organizationAddressLines(value: string): string[] {
  const parts = value.split(", ").filter(Boolean);
  if (parts.length >= 3 && /^[A-Za-z]{2}$/.test(parts[parts.length - 2]) && /^\d{5}(?:-\d{4})?$/.test(parts[parts.length - 1])) {
    return [...parts.slice(0, -3), `${parts[parts.length - 3]}, ${parts[parts.length - 2]} ${parts[parts.length - 1]}`];
  }
  if (parts.length >= 2 && /^[A-Za-z]{2}\s+\d{5}(?:-\d{4})?$/.test(parts[parts.length - 1])) {
    return [...parts.slice(0, -2), `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`];
  }
  return parts;
}

export function renderAnnualStatements(statements: AnnualGivingStatement[]): string {
  const pages = statements.map((statement) => {
    const organizationAddress = organizationAddressLines(statement.organizationAddress).map((line) => `<div>${escapeHtml(line)}</div>`).join("");
    const constituentAddress = statement.constituent.addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
    const gifts = statement.gifts.map((gift) => {
      const comment = [gift.comment, gift.taxDeductibleNotes].filter(Boolean).join(" | ");
      return `<tr><td>${escapeHtml(giftDate(gift.date))}</td><td class="gift-id">${escapeHtml(gift.giftId)}${gift.receiptNumber ? `<small>Receipt # ${escapeHtml(gift.receiptNumber)}</small>` : ""}</td><td>${escapeHtml(gift.event ?? "")}</td><td>${escapeHtml(comment)}</td><td>${escapeHtml(gift.checkNumber ?? "")}</td><td>${escapeHtml(gift.paymentMethod)}</td><td class="number">${escapeHtml(money(gift.amount))}</td><td class="number">${escapeHtml(money(gift.taxDeductibleAmount))}</td></tr>`;
    }).join("");
    return `<section class="statement"><header><div class="organization"><strong>${escapeHtml(statement.organizationName)}</strong>${organizationAddress}${statement.organizationPhone ? `<div>${escapeHtml(statement.organizationPhone)}</div>` : ""}</div><h1>Donation Statement</h1></header><div class="recipient"><strong>${escapeHtml(statement.constituent.name)}</strong>${constituentAddress}</div><div class="year">Calendar year ${statement.calendarYear}</div><table><thead><tr><th>Date</th><th>Gift ID</th><th>Event</th><th>Comment</th><th>Check #</th><th>Type</th><th class="number">Amount<br>Received</th><th class="number">Tax-deductible<br>Amount</th></tr></thead><tbody>${gifts || `<tr><td colspan="8">No completed gifts recorded for this calendar year.</td></tr>`}</tbody><tfoot><tr><th colspan="6">Annual total</th><th class="number">${escapeHtml(money(statement.totalAmount))}</th><th class="number">${escapeHtml(money(statement.taxDeductibleAmount))}</th></tr></tfoot></table><footer>${statement.organizationTaxId ? `<div>Tax ID: ${escapeHtml(statement.organizationTaxId)}</div>` : ""}<div>Amounts reflect completed gifts and tax-deductible values recorded in the CRM. Review gift details before issuing as an official tax receipt.</div></footer></section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Annual Donation Statements</title><style>@page{size:letter;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#333;font:12px Arial,Helvetica,sans-serif}.statement{break-after:page;page-break-after:always}.statement:last-child{break-after:auto;page-break-after:auto}header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;min-height:115px}.organization{line-height:1.32}.organization strong,.recipient strong{display:block}h1{margin:16px 0 0;font-size:20px;font-weight:400;color:#444;white-space:nowrap}.recipient{min-height:66px;line-height:1.35}.year{margin:0 0 12px;color:#555;font-weight:600}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}th,td{padding:5px 4px;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}thead th{background:#888;color:white;font-size:11px;font-weight:500;text-align:left;vertical-align:middle}tbody td{border-bottom:1px solid #d0d0d0}tbody tr{break-inside:avoid;page-break-inside:avoid}tfoot th{border-top:2px solid #888;text-align:left;font-weight:700}th:nth-child(1){width:10%}th:nth-child(2){width:13%}th:nth-child(3){width:16%}th:nth-child(4){width:18%}th:nth-child(5){width:10%}th:nth-child(6){width:10%}th:nth-child(7){width:11%}th:nth-child(8){width:12%}.number{text-align:right;white-space:nowrap}.gift-id{font-size:10px}.gift-id small{display:block;color:#666;font-size:9px}footer{margin-top:28px;border-top:1px solid #ddd;padding-top:8px;color:#666;font-size:10px;line-height:1.4}@media screen{body{padding:24px;background:#eef0f2}.statement{width:8.5in;min-height:11in;margin:0 auto 24px;padding:14mm;background:#fff;box-shadow:0 2px 12px #0002}}@media print{.statement{min-height:0}}</style></head><body>${pages}</body></html>`;
}
