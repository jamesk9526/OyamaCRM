/** Formatting and browser PDF helpers for OyamaLetters generation. */
import type { BatchResult, ConstituentLookup, DonationLookup } from "./letters-generation-types";

export function formatConstituentName(row: ConstituentLookup | null | undefined): string {
  if (!row) return "";
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email || row.id;
}

export function formatDonationLabel(row: DonationLookup | null | undefined): string {
  if (!row) return "";
  const amount = Number(row.amount);
  const formatted = Number.isFinite(amount) ? amount.toLocaleString(undefined, { style: "currency", currency: "USD" }) : String(row.amount);
  const date = row.date ? new Date(row.date).toLocaleDateString() : "Undated";
  const donorName = row.constituent ? [row.constituent.firstName, row.constituent.lastName].filter(Boolean).join(" ") : "";
  return `${formatted} - ${date}${donorName ? ` - ${donorName}` : ""}`;
}

export function parseIds(raw: string): string[] {
  return raw.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
}

export function resolveYear(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

export function getGeneratedIds(result: BatchResult | null): string[] {
  if (!result) return [];
  return (result.generatedIds ?? result.generated.map((entry) => entry.id)).filter((id) => Boolean(id && id !== "dry-run"));
}

export function filenameFromDisposition(disposition: string | null, fallbackName: string): string {
  const filenameMatch = (disposition || "").match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] || fallbackName;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function printableTypeLabel(category: string): string {
  return category.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
