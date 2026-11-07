export class ReviewRequestError extends Error { constructor(message: string, public code: string) { super(message); } }
export async function reviewFetch<T>(path: string, body?: unknown, csrf?: string): Promise<T> {
  const response = await fetch(`/api/compassion/physician-review${path}`, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(csrf ? { "X-Review-CSRF": csrf } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new ReviewRequestError(data.error?.message || "Unable to complete this request.", data.error?.code || "REQUEST_FAILED");
  return data;
}
