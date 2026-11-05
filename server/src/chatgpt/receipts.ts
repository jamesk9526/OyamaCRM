import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CreateError } from "../oyama-create/domain.js";
import { json } from "../services/letter-production.js";
import { hashToken } from "./config.js";

export function toolFingerprint(value: unknown) {
  return hashToken(JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item));
}

/** The receipt and the CRM write commit in the same transaction. */
export async function withToolReceipt(grantId: string, requestKey: string, fingerprint: string,
  perform: (record: (tx: Prisma.TransactionClient, result: object) => Promise<void>) => Promise<object>,
) {
  const where = { grantId_requestKey: { grantId, requestKey } };
  async function replay() {
    const existing = await prisma.chatGptDraftRequest.findUnique({ where });
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint) throw new CreateError(409, "This requestKey was already used for different content. Use a new key for a new request.");
    return existing.resultJson;
  }
  const existing = await replay();
  if (existing) return existing;
  try {
    return await perform(async (tx, result) => {
      await tx.chatGptDraftRequest.create({ data: { grantId, requestKey, fingerprint, resultJson: json(result) } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" || error instanceof CreateError && error.status === 409) {
      const saved = await replay();
      if (saved) return saved;
    }
    throw error;
  }
}
