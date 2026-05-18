// Service layer for TableLink guest invites and invite completion.
import { createHash, randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function generateCheckinCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const existing = await prisma.eventGuest.findUnique({ where: { checkinCode: code } });
    if (!existing) return code;
  }
  return Date.now().toString(36).toUpperCase().slice(-6);
}

export async function createGuestInvite(input: {
  eventId: string;
  tableId: string;
  seatId?: string;
  invitedByUserId?: string;
  invitedByHostEmail?: string;
  inviteEmail?: string;
  invitePhone?: string;
  expiresInHours?: number;
}) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000);

  const invite = await prisma.eventGuestInvite.create({
    data: {
      eventId: input.eventId,
      tableId: input.tableId,
      seatId: input.seatId,
      invitedByUserId: input.invitedByUserId,
      invitedByHostEmail: input.invitedByHostEmail,
      inviteEmail: input.inviteEmail,
      invitePhone: input.invitePhone,
      tokenHash,
      expiresAt,
      status: "CREATED",
    },
  });

  return { invite, token };
}

export async function markGuestInviteOpened(token: string) {
  const tokenHash = hashToken(token);
  return prisma.eventGuestInvite.updateMany({
    where: { tokenHash, status: { in: ["CREATED", "QUEUED", "SENT"] } },
    data: { status: "OPENED", openedAt: new Date() },
  });
}

export async function completeGuestInvite(input: {
  token: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mealPreference?: string;
  dietaryRestrictions?: string;
  specialNeeds?: string;
  notes?: string;
}) {
  const tokenHash = hashToken(input.token);
  const invite = await prisma.eventGuestInvite.findFirst({
    where: { tokenHash },
    include: { table: true },
  });

  if (!invite) throw new Error("Invite not found.");
  if (invite.status === "CANCELLED" || invite.status === "COMPLETED") throw new Error("Invite is not active.");
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    await prisma.eventGuestInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    throw new Error("Invite has expired.");
  }

  const existingGuest = invite.guestId
    ? await prisma.eventGuest.findUnique({ where: { id: invite.guestId } })
    : null;

  const guest = existingGuest
    ? await prisma.eventGuest.update({
        where: { id: existingGuest.id },
        data: {
          firstName: input.firstName ?? existingGuest.firstName,
          lastName: input.lastName ?? existingGuest.lastName,
          email: input.email ?? existingGuest.email,
          phone: input.phone ?? existingGuest.phone,
          mealPreference: input.mealPreference ?? existingGuest.mealPreference,
          dietaryRestrictions: input.dietaryRestrictions ?? existingGuest.dietaryRestrictions,
          specialNeeds: input.specialNeeds ?? existingGuest.specialNeeds,
          notes: input.notes ?? existingGuest.notes,
          source: "GUEST_SELF_ENTRY",
          rsvpStatus: "CONFIRMED",
        },
      })
    : await prisma.eventGuest.create({
        data: {
          eventId: invite.eventId,
          tableId: invite.tableId,
          seatId: invite.seatId,
          seatNumber: invite.seatId
            ? (await prisma.eventTableSeat.findUnique({ where: { id: invite.seatId }, select: { seatNumber: true } }))?.seatNumber ?? null
            : null,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          mealPreference: input.mealPreference,
          dietaryRestrictions: input.dietaryRestrictions,
          specialNeeds: input.specialNeeds,
          notes: input.notes,
          source: "GUEST_SELF_ENTRY",
          rsvpStatus: "CONFIRMED",
          checkinCode: await generateCheckinCode(),
        },
      });

  await prisma.$transaction([
    prisma.eventGuestInvite.update({
      where: { id: invite.id },
      data: { status: "COMPLETED", completedAt: new Date(), guestId: guest.id },
    }),
    ...(invite.seatId ? [prisma.eventTableSeat.update({ where: { id: invite.seatId }, data: { status: "CONFIRMED" } })] : []),
  ]);

  return guest;
}
