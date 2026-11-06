import type { Channel } from "./domain.js";
import { sourceIdentity } from "./studio/design.js";
import type { StudioDesign } from "./studio/types.js";

/** A digital editor can submit only its channel adaptation and email metadata. */
export function mergeDigitalDraft(base: StudioDesign, proposed: StudioDesign, channel: Exclude<Channel, "LETTER">): StudioDesign {
  const adaptation = proposed.channels?.[channel];
  if (!adaptation) return base;
  return {
    ...base,
    channels: { ...base.channels, [channel]: { ...adaptation, reviewedSource: adaptation.reviewedSource === sourceIdentity(proposed) ? sourceIdentity(base) : adaptation.reviewedSource } },
    email: channel === "EMAIL" ? { ...base.email, subject: proposed.email.subject, previewText: proposed.email.previewText } : base.email,
  };
}
