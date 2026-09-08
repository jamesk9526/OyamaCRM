/** Open the PDF itself: printing an HTML iframe wrapper can paginate the wrapper. */
export function openPdfPrintView(url: string): boolean {
  const printWindow = window.open(url, "_blank");
  if (!printWindow) return false;
  printWindow.opener = null;
  return true;
}
