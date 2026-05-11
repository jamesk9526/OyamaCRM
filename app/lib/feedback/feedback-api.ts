// Client API wrappers for feedback submission and Watchdog ticket interactions.

import { apiFetch } from "@/app/lib/auth-client";
import type { FeedbackSubmitPayload, FeedbackSubmitResponse } from "@/app/components/feedback/types";

/** Submits one feedback payload and returns the created Watchdog ticket metadata. */
export async function submitFeedbackTicket(payload: FeedbackSubmitPayload): Promise<FeedbackSubmitResponse> {
  return apiFetch<FeedbackSubmitResponse>("/api/feedback/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
