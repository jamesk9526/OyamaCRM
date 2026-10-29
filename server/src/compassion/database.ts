/** Dedicated client-care connection pool. Never installs middleware on the donor pool. */
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, type Prisma } from "@prisma/client";

export const compassionDatabase = new PrismaClient({ log: [] });
const transactions = new AsyncLocalStorage<Prisma.TransactionClient>();
export const prisma = new Proxy(compassionDatabase, {
  get(target, property) {
    const client = transactions.getStore() ?? target;
    if (property === "$transaction" && transactions.getStore()) {
      return async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => work(client as Prisma.TransactionClient);
    }
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function atomic<T>(organizationId: string, work: () => Promise<T>): Promise<T> {
  if (transactions.getStore()) return work();
  await compassionDatabase.$executeRaw`INSERT INTO CompassionScheduleLock (organizationId, updatedAt) VALUES (${organizationId}, NOW(3)) ON DUPLICATE KEY UPDATE organizationId = VALUES(organizationId)`;
  return compassionDatabase.$transaction(async (tx) => {
    // A client-care-only lock serializes conflicting writes across API processes.
    await tx.$queryRaw`SELECT organizationId FROM CompassionScheduleLock WHERE organizationId = ${organizationId} FOR UPDATE`;
    return transactions.run(tx, work);
  }, { timeout: 60000, maxWait: 10000 });
}
