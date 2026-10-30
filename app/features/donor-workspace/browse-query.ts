/** Preserve unrelated handoff parameters while changing only the requested filters. */
export function updateBrowseQuery(current: string, updates: Record<string, string | null>, resetPage = true) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") params.delete(key); else params.set(key, value);
  }
  if (resetPage) params.delete("page");
  return params.toString();
}

export function positivePage(value: string | null, fallback = 1) {
  return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}
