import { AsyncLocalStorage } from "node:async_hooks";

/** Process-local execution context; HTTP headers and tool arguments cannot set it. */
export type MutationGuard = { model: string; id: string; expected: Record<string, unknown>; consumed?: boolean };
export const aiMutationContext = new AsyncLocalStorage<{
  operationId: string;
  guards: MutationGuard[];
  suppressImplicitEffects: true;
  approvedEmail?: { campaignId: string; bodies: { html: string; text: string } };
  allowDelivery?: (email: string) => Promise<boolean>;
}>();
