export interface ContactsPaginationState {
  currentPage: number;
  pageCount: number;
  startIndex: number;
  endIndex: number;
  firstVisibleItem: number;
  lastVisibleItem: number;
}

/** Build a clamped pagination window for the Contacts Manager grid. */
export function getContactsPagination(
  totalItems: number,
  pageSize: number | "ALL",
  requestedPage: number,
): ContactsPaginationState {
  const safeTotal = Math.max(0, Math.floor(totalItems));
  const safePageSize = pageSize === "ALL" ? Math.max(1, safeTotal) : Math.max(1, Math.floor(pageSize));
  const pageCount = pageSize === "ALL" ? 1 : Math.max(1, Math.ceil(safeTotal / safePageSize));
  const normalizedPage = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const currentPage = Math.min(pageCount, Math.max(1, normalizedPage));
  const startIndex = pageSize === "ALL" ? 0 : (currentPage - 1) * safePageSize;
  const endIndex = pageSize === "ALL" ? safeTotal : Math.min(safeTotal, startIndex + safePageSize);

  return {
    currentPage,
    pageCount,
    startIndex,
    endIndex,
    firstVisibleItem: safeTotal === 0 ? 0 : startIndex + 1,
    lastVisibleItem: endIndex,
  };
}
