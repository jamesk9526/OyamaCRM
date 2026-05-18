// Service layer for TableLink host access token issuance and verification.
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "../lib/prisma.js";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function issueTableLinkAccessToken(input: {
  eventId: string;
  tableId: string;
  hostEmail: string;
  expiresInMinutes?: number;
}) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 60) * 60 * 1000);

  await prisma.eventTableAccessToken.create({
    data: {
      eventId: input.eventId,
      tableId: input.tableId,
      hostEmail: input.hostEmail.toLowerCase(),
      tokenHash,
      expiresAt,
      status: "ACTIVE",
    },
  });

  return { token: rawToken, expiresAt };
}

export async function verifyTableLinkAccessToken(input: { eventId: string; token: string }) {
  const tokenHash = hashToken(input.token);
  const rows = await prisma.eventTableAccessToken.findMany({
    where: { eventId: input.eventId, status: "ACTIVE" },
    include: { table: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const matched = rows.find((row) => timingSafeEqual(Buffer.from(row.tokenHash), Buffer.from(tokenHash)));
  if (!matched) return null;
  if (matched.expiresAt.getTime() < Date.now()) {
    await prisma.eventTableAccessToken.update({ where: { id: matched.id }, data: { status: "EXPIRED" } });
    return null;
  }

  await prisma.eventTableAccessToken.update({
    where: { id: matched.id },
    data: { status: "USED", lastUsedAt: new Date() },
  });

  return matched;
}

export async function revokeTableLinkAccessTokens(tableId: string) {
  return prisma.eventTableAccessToken.updateMany({
    where: { tableId, status: { in: ["ACTIVE", "USED"] } },
    data: { status: "REVOKED" },
  });
}
