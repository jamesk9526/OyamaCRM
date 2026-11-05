import { AsyncLocalStorage } from "node:async_hooks";
/** Trusted request context, established only after JWT validation. */
export const tenantContext = new AsyncLocalStorage<string>();
