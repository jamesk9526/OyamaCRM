/**
 * Events routes.
 * Provides event management, ticket types, orders, guests, and dashboard metrics.
 *
 * @module routes/events
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { Prisma } from "@prisma/client";

const router = Router();

// All event routes require authentication.
router.use(requireAuth);

/** GET /api/events/dashboard-summary — high-level command-center metrics for Events CRM. */
router.get("/dashboard-summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      totalEvents: 0,
      activeEvents: 0,
      upcomingEvents: 0,
      registeredGuests: 0,
      checkedInGuests: 0,
      totalRevenue: 0,
      openSeats: 0,
      volunteerHours: 0,
    });
    return;
  }

  const now = new Date();
  const [
    events,
    guestAggregate,
    checkedInGuests,
    orderAggregate,
    volunteerHoursAgg,
  ] = await Promise.all([
    prisma.event.findMany({
      where: { organizationId },
      select: {
        id: true,
        active: true,
        startDate: true,
        registrationGoal: true,
        capacity: true,
        _count: { select: { guests: true } },
      },
    }),
    prisma.eventGuest.aggregate({
      where: { event: { organizationId } },
      _count: { id: true },
    }),
    prisma.eventGuest.count({
      where: { event: { organizationId }, checkedIn: true },
    }),
    prisma.eventOrder.aggregate({
      where: { event: { organizationId }, status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
    prisma.volunteerHour.aggregate({
      where: { event: { organizationId } },
      _sum: { hours: true },
    }),
  ]);

  const activeEvents = events.filter((event) => event.active).length;
  const upcomingEvents = events.filter((event) => event.startDate >= now).length;
  const openSeats = events.reduce((sum, event) => {
    const capacity = event.capacity ?? event.registrationGoal ?? 0;
    const registered = event._count.guests;
    return sum + Math.max(0, capacity - registered);
  }, 0);

  res.json({
    totalEvents: events.length,
    activeEvents,
    upcomingEvents,
    registeredGuests: guestAggregate._count.id,
    checkedInGuests,
    totalRevenue: Number(orderAggregate._sum.totalAmount ?? 0),
    openSeats,
    volunteerHours: Number(volunteerHoursAgg._sum.hours ?? 0),
  });
});

/** GET /api/events — List all events with guest and order counts. */
router.get("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const events = await prisma.event.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          ticketTypes: true,
          attendances: true,
          volunteerHours: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });
  res.json(events);
});

/** GET /api/events/:id — Get event detail with full relations. */
router.get("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      _count: {
        select: {
          guests: true,
          orders: true,
          sponsors: true,
          tables: true,
          volunteerHours: true,
        },
      },
    },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  res.json(event);
});

/** POST /api/events — Create a new event record. */
router.post("/", async (req, res) => {
  const {
    name,
    description,
    type,
    status,
    visibility,
    location,
    address,
    city,
    state,
    zip,
    virtualUrl,
    startDate,
    endDate,
    registrationDeadline,
    capacity,
    registrationGoal,
    revenueGoal,
    ownerId,
    internalNotes,
    active,
  } = req.body;

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const event = await prisma.event.create({
    data: {
      organizationId,
      name,
      description: description ?? undefined,
      type: type ?? "OTHER",
      status: status ?? "DRAFT",
      visibility: visibility ?? "PUBLIC",
      location: location ?? undefined,
      address: address ?? undefined,
      city: city ?? undefined,
      state: state ?? undefined,
      zip: zip ?? undefined,
      virtualUrl: virtualUrl ?? undefined,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
      capacity: capacity ?? undefined,
      registrationGoal: registrationGoal ?? undefined,
      revenueGoal: revenueGoal ?? undefined,
      ownerId: ownerId ?? undefined,
      internalNotes: internalNotes ?? undefined,
      active: active ?? true,
    },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          ticketTypes: true,
          attendances: true,
          volunteerHours: true,
        },
      },
    },
  });

  res.status(201).json(event);
});

/** PATCH /api/events/:id — Update event details. */
router.patch("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const {
    name,
    description,
    type,
    status,
    visibility,
    location,
    address,
    city,
    state,
    zip,
    virtualUrl,
    startDate,
    endDate,
    registrationDeadline,
    capacity,
    registrationGoal,
    revenueGoal,
    ownerId,
    internalNotes,
    active,
  } = req.body;

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
      ...(visibility !== undefined && { visibility }),
      ...(location !== undefined && { location }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(zip !== undefined && { zip }),
      ...(virtualUrl !== undefined && { virtualUrl }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(registrationDeadline !== undefined && { registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null }),
      ...(capacity !== undefined && { capacity }),
      ...(registrationGoal !== undefined && { registrationGoal }),
      ...(revenueGoal !== undefined && { revenueGoal }),
      ...(ownerId !== undefined && { ownerId }),
      ...(internalNotes !== undefined && { internalNotes }),
      ...(active !== undefined && { active }),
    },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          ticketTypes: true,
          attendances: true,
          volunteerHours: true,
        },
      },
    },
  });

  res.json(event);
});

/** DELETE /api/events/:id — Delete an event (soft delete via active flag or hard delete if no orders). */
router.delete("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.id, organizationId },
    include: { _count: { select: { orders: true, guests: true } } },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  // If event has orders or guests, soft delete by marking inactive
  if (event._count.orders > 0 || event._count.guests > 0) {
    await prisma.event.update({
      where: { id: req.params.id },
      data: { active: false, status: "CANCELLED" },
    });
    res.json({ message: "Event marked inactive", soft: true });
  } else {
    // Hard delete if no related data
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: "Event deleted", soft: false });
  }
});

// ─── Ticket Types ────────────────────────────────────────────────────────────

/** GET /api/events/:eventId/ticket-types — List ticket types for an event. */
router.get("/:eventId/ticket-types", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: req.params.eventId },
    include: { _count: { select: { orderItems: true, guests: true } } },
    orderBy: { sortOrder: "asc" },
  });

  res.json(ticketTypes);
});

/** POST /api/events/:eventId/ticket-types — Create a new ticket type for an event. */
router.post("/:eventId/ticket-types", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { name, description, price, capacity, available, sortOrder, active } = req.body;

  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: req.params.eventId,
      name,
      description: description ?? undefined,
      price,
      capacity: capacity ?? undefined,
      available: available ?? capacity ?? undefined,
      sortOrder: sortOrder ?? 0,
      active: active ?? true,
    },
    include: { _count: { select: { orderItems: true, guests: true } } },
  });

  res.status(201).json(ticketType);
});

/** PATCH /api/events/:eventId/ticket-types/:id — Update a ticket type. */
router.patch("/:eventId/ticket-types/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { name, description, price, capacity, available, sortOrder, active } = req.body;

  const ticketType = await prisma.ticketType.update({
    where: { id: req.params.id, eventId: req.params.eventId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(capacity !== undefined && { capacity }),
      ...(available !== undefined && { available }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(active !== undefined && { active }),
    },
    include: { _count: { select: { orderItems: true, guests: true } } },
  });

  res.json(ticketType);
});

/** DELETE /api/events/:eventId/ticket-types/:id — Delete a ticket type. */
router.delete("/:eventId/ticket-types/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const ticketType = await prisma.ticketType.findFirst({
    where: { id: req.params.id, eventId: req.params.eventId },
    include: { _count: { select: { orderItems: true, guests: true } } },
  });

  if (!ticketType) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket type not found" } });
    return;
  }

  // If ticket type has orders or guests, soft delete by marking inactive
  if (ticketType._count.orderItems > 0 || ticketType._count.guests > 0) {
    await prisma.ticketType.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.json({ message: "Ticket type marked inactive", soft: true });
  } else {
    // Hard delete if no related data
    await prisma.ticketType.delete({ where: { id: req.params.id } });
    res.json({ message: "Ticket type deleted", soft: false });
  }
});

// ─── Event Orders ────────────────────────────────────────────────────────────

/** GET /api/events/orders — List all orders across all events with filters. */
router.get("/orders", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const { eventId, status, search } = req.query;

  // Build where clause dynamically for flexibility
  const whereConditions: Prisma.EventOrderWhereInput = { event: { organizationId } };
  if (eventId) {
    whereConditions.eventId = eventId as string;
  }
  if (status) {
    whereConditions.status = status as Prisma.EnumOrderStatusFilter<"EventOrder">;
  }
  if (search) {
    const searchStr = search as string;
    whereConditions.OR = [
      { orderNumber: { contains: searchStr } },
      { constituent: { firstName: { contains: searchStr } } },
      { constituent: { lastName: { contains: searchStr } } },
      { constituent: { email: { contains: searchStr } } },
    ];
  }

  const orders = await prisma.eventOrder.findMany({
    where: whereConditions,
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(orders);
});

/** GET /api/events/:eventId/orders — List orders for a specific event. */
router.get("/:eventId/orders", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const orders = await prisma.eventOrder.findMany({
    where: { eventId: req.params.eventId },
    include: {
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(orders);
});

/** POST /api/events/:eventId/orders — Create a new manual order for an event. */
router.post("/:eventId/orders", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { constituentId, items, paymentMethod, status, notes, paidAt } = req.body;

  if (!constituentId || !items || items.length === 0) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "constituentId and items are required" } });
    return;
  }

  // Generate unique order number
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const orderNumber = `ORD-${timestamp}-${random}`;

  interface OrderItemInput {
    ticketTypeId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }

  // Calculate totals
  const totalAmount = items.reduce((sum: number, item: OrderItemInput) => sum + Number(item.totalPrice), 0);

  const order = await prisma.eventOrder.create({
    data: {
      eventId: req.params.eventId,
      constituentId,
      orderNumber,
      status: status ?? "PENDING",
      totalAmount,
      feeAmount: 0,
      paymentMethod: paymentMethod ?? undefined,
      paidAt: paidAt ? new Date(paidAt) : undefined,
      notes: notes ?? undefined,
      items: {
        create: items.map((item: OrderItemInput) => ({
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
    },
    include: {
      event: { select: { id: true, name: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
  });

  // Log activity for constituent timeline (donor sync)
  await prisma.activity.create({
    data: {
      constituentId,
      eventId: req.params.eventId,
      type: "EVENT_REGISTRATION",
      description: `Registered for event: ${order.event.name} (${items.length} ticket${items.length > 1 ? "s" : ""}, $${totalAmount.toFixed(2)})`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount,
        itemCount: items.length,
        source: "api/events:orders:create",
      },
    },
  });

  res.status(201).json(order);
});

/** PATCH /api/events/orders/:orderId — Update an event order. */
router.patch("/orders/:orderId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const order = await prisma.eventOrder.findFirst({
    where: { id: req.params.orderId },
    include: { event: true },
  });

  if (!order || order.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found" } });
    return;
  }

  const { status, paymentMethod, paidAt, notes } = req.body;

  const updated = await prisma.eventOrder.update({
    where: { id: req.params.orderId },
    data: {
      ...(status !== undefined && { status }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
  });

  res.json(updated);
});

// ─── Event Guests ────────────────────────────────────────────────────────────

/** GET /api/events/guests — List all guests across all events with filters. */
router.get("/guests", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const { eventId, search, checkedIn, constituentLinked } = req.query;

  // Build where clause dynamically
  const whereConditions: Prisma.EventGuestWhereInput = { event: { organizationId } };
  if (eventId) {
    whereConditions.eventId = eventId as string;
  }
  if (checkedIn !== undefined) {
    whereConditions.checkedIn = checkedIn === "true";
  }
  if (constituentLinked === "true") {
    whereConditions.constituentId = { not: null };
  }
  if (constituentLinked === "false") {
    whereConditions.constituentId = null;
  }
  if (search) {
    const searchStr = search as string;
    whereConditions.OR = [
      { firstName: { contains: searchStr } },
      { lastName: { contains: searchStr } },
      { email: { contains: searchStr } },
      { constituent: { firstName: { contains: searchStr } } },
      { constituent: { lastName: { contains: searchStr } } },
    ];
  }

  const guests = await prisma.eventGuest.findMany({
    where: whereConditions,
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(guests);
});

/** GET /api/events/:eventId/guests — List guests for a specific event. */
router.get("/:eventId/guests", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const guests = await prisma.eventGuest.findMany({
    where: { eventId: req.params.eventId },
    include: {
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(guests);
});

/** POST /api/events/:eventId/guests — Create a new guest for an event. */
router.post("/:eventId/guests", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const {
    orderId,
    constituentId,
    ticketTypeId,
    tableId,
    firstName,
    lastName,
    email,
    phone,
    dietaryRestrictions,
    specialNeeds,
    notes,
  } = req.body;

  const guest = await prisma.eventGuest.create({
    data: {
      eventId: req.params.eventId,
      orderId: orderId ?? undefined,
      constituentId: constituentId ?? undefined,
      ticketTypeId: ticketTypeId ?? undefined,
      tableId: tableId ?? undefined,
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      dietaryRestrictions: dietaryRestrictions ?? undefined,
      specialNeeds: specialNeeds ?? undefined,
      notes: notes ?? undefined,
    },
    include: {
      event: { select: { id: true, name: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
  });

  // Log activity for linked constituents (donor sync)
  if (constituentId) {
    await prisma.activity.create({
      data: {
        constituentId,
        eventId: req.params.eventId,
        type: "EVENT_REGISTRATION",
        description: `Added as guest for event: ${guest.event.name}`,
        metadata: {
          guestId: guest.id,
          guestName: `${firstName || ""} ${lastName || ""}`.trim(),
          source: "api/events:guests:create",
        },
      },
    });
  }

  res.status(201).json(guest);
});

/** PATCH /api/events/guests/:guestId — Update a guest. */
router.patch("/guests/:guestId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  const {
    constituentId,
    ticketTypeId,
    tableId,
    firstName,
    lastName,
    email,
    phone,
    checkedIn,
    checkedInAt,
    dietaryRestrictions,
    specialNeeds,
    notes,
  } = req.body;

  const updated = await prisma.eventGuest.update({
    where: { id: req.params.guestId },
    data: {
      ...(constituentId !== undefined && { constituentId }),
      ...(ticketTypeId !== undefined && { ticketTypeId }),
      ...(tableId !== undefined && { tableId }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(checkedIn !== undefined && { checkedIn }),
      ...(checkedInAt !== undefined && { checkedInAt: checkedInAt ? new Date(checkedInAt) : null }),
      ...(dietaryRestrictions !== undefined && { dietaryRestrictions }),
      ...(specialNeeds !== undefined && { specialNeeds }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
  });

  res.json(updated);
});

/** DELETE /api/events/guests/:guestId — Delete a guest. */
router.delete("/guests/:guestId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  await prisma.eventGuest.delete({ where: { id: req.params.guestId } });
  res.json({ message: "Guest deleted" });
});

// ─── Event Tables (Seating Management) ──────────────────────────────────────

/** GET /api/events/:eventId/tables — List tables for an event with guest counts. */
router.get("/:eventId/tables", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const tables = await prisma.eventTable.findMany({
    where: { eventId: req.params.eventId },
    include: {
      guests: {
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          ticketType: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        },
      },
      _count: { select: { guests: true } },
    },
    orderBy: { name: "asc" },
  });

  res.json(tables);
});

/** POST /api/events/:eventId/tables — Create a new table for an event. */
router.post("/:eventId/tables", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { name, capacity, notes } = req.body;

  const table = await prisma.eventTable.create({
    data: {
      eventId: req.params.eventId,
      name,
      capacity: capacity ?? 10,
      notes: notes ?? undefined,
    },
    include: {
      guests: {
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          ticketType: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        },
      },
      _count: { select: { guests: true } },
    },
  });

  res.status(201).json(table);
});

/** PATCH /api/events/tables/:tableId — Update a table. */
router.patch("/tables/:tableId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const table = await prisma.eventTable.findFirst({
    where: { id: req.params.tableId },
    include: { event: true },
  });

  if (!table || table.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Table not found" } });
    return;
  }

  const { name, capacity, notes } = req.body;

  const updated = await prisma.eventTable.update({
    where: { id: req.params.tableId },
    data: {
      ...(name !== undefined && { name }),
      ...(capacity !== undefined && { capacity }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      guests: {
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          ticketType: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        },
      },
      _count: { select: { guests: true } },
    },
  });

  res.json(updated);
});

/** DELETE /api/events/tables/:tableId — Delete a table (unassigns guests first). */
router.delete("/tables/:tableId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const table = await prisma.eventTable.findFirst({
    where: { id: req.params.tableId },
    include: { event: true },
  });

  if (!table || table.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Table not found" } });
    return;
  }

  // Unassign all guests from this table before deleting
  await prisma.eventGuest.updateMany({
    where: { tableId: req.params.tableId },
    data: { tableId: null },
  });

  await prisma.eventTable.delete({ where: { id: req.params.tableId } });
  res.json({ message: "Table deleted" });
});

/** PATCH /api/events/guests/:guestId/assign-table — Assign or unassign a guest to a table. */
router.patch("/guests/:guestId/assign-table", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  const { tableId } = req.body;

  // Validate table exists and belongs to same event if tableId is provided
  if (tableId) {
    const table = await prisma.eventTable.findFirst({
      where: { id: tableId, eventId: guest.eventId },
    });
    if (!table) {
      res.status(400).json({ error: { code: "INVALID_TABLE", message: "Table not found for this event" } });
      return;
    }
  }

  const updated = await prisma.eventGuest.update({
    where: { id: req.params.guestId },
    data: { tableId: tableId ?? null },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true, capacity: true } },
    },
  });

  res.json(updated);
});

/** POST /api/events/guests/:guestId/check-in — Quick check-in toggle endpoint. */
router.post("/guests/:guestId/check-in", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  const { checkedIn } = req.body;
  const newStatus = checkedIn !== undefined ? checkedIn : !guest.checkedIn;

  const updated = await prisma.eventGuest.update({
    where: { id: req.params.guestId },
    data: {
      checkedIn: newStatus,
      checkedInAt: newStatus ? new Date() : null,
    },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
  });

  // Log activity for linked constituents when they check in (donor sync)
  if (newStatus && updated.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: updated.constituentId,
        eventId: updated.event.id,
        type: "EVENT_ATTENDANCE",
        description: `Checked in at event: ${updated.event.name}`,
        metadata: {
          guestId: updated.id,
          checkedInAt: updated.checkedInAt,
          source: "api/events:guests:check-in",
        },
      },
    });
  }

  res.json(updated);
});

// ─── Event Reports ───────────────────────────────────────────────────────────

/**
 * GET /api/events/:eventId/report — Comprehensive event summary for reporting.
 * Returns metrics, revenue breakdown, attendance, and donor-sync insights.
 */
router.get("/:eventId/report", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          donations: true,
          activities: true,
          sponsors: true,
        },
      },
    },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  // Get detailed guest counts
  const [
    totalGuests,
    checkedInGuests,
    linkedGuests,
    unlinkedGuests,
  ] = await Promise.all([
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId },
    }),
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId, checkedIn: true },
    }),
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId, constituentId: { not: null } },
    }),
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId, constituentId: null },
    }),
  ]);

  // Calculate no-shows (registered but not checked in)
  const noShows = totalGuests - checkedInGuests;

  // Get order revenue breakdown
  const orderRevenue = await prisma.eventOrder.aggregate({
    where: { eventId: req.params.eventId, status: "CONFIRMED" },
    _sum: { totalAmount: true },
    _count: { id: true },
  });

  // Get event-linked donation revenue
  const donationRevenue = await prisma.donation.aggregate({
    where: { eventId: req.params.eventId, status: "COMPLETED" },
    _sum: { amount: true },
    _count: { id: true },
  });

  // Get unique new donors from this event (first donation ever was for this event)
  const newDonorsFromEvent = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT d.constituentId) as count
    FROM "Donation" d
    WHERE d."eventId" = ${req.params.eventId}
      AND d.status = 'COMPLETED'
      AND NOT EXISTS (
        SELECT 1 FROM "Donation" d2
        WHERE d2."constituentId" = d."constituentId"
          AND d2.date < d.date
      )
  `;

  const newDonorCount = Number(newDonorsFromEvent[0]?.count ?? 0);

  // Total revenue = order revenue + donation revenue
  const totalRevenue = Number(orderRevenue._sum.totalAmount ?? 0) + Number(donationRevenue._sum.amount ?? 0);

  // Revenue goal progress
  const revenueGoal = event.revenueGoal ? Number(event.revenueGoal) : null;
  const revenueProgress = revenueGoal ? Math.round((totalRevenue / revenueGoal) * 100) : null;

  // Attendance goal progress
  const attendanceGoal = event.registrationGoal ?? event.capacity ?? null;
  const attendanceProgress = attendanceGoal ? Math.round((totalGuests / attendanceGoal) * 100) : null;

  res.json({
    event: {
      id: event.id,
      name: event.name,
      type: event.type,
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
      revenueGoal: event.revenueGoal,
      registrationGoal: event.registrationGoal,
      capacity: event.capacity,
    },
    attendance: {
      total: totalGuests,
      checkedIn: checkedInGuests,
      noShows,
      attendanceRate: totalGuests > 0 ? Math.round((checkedInGuests / totalGuests) * 100) : 0,
      goal: attendanceGoal,
      progress: attendanceProgress,
    },
    revenue: {
      total: totalRevenue,
      fromOrders: Number(orderRevenue._sum.totalAmount ?? 0),
      fromDonations: Number(donationRevenue._sum.amount ?? 0),
      orderCount: orderRevenue._count.id,
      donationCount: donationRevenue._count.id,
      goal: revenueGoal,
      progress: revenueProgress,
    },
    donorInsights: {
      linkedGuests,
      unlinkedGuests,
      newDonors: newDonorCount,
      needsFollowUp: unlinkedGuests + noShows, // Simple heuristic: unlinked + no-shows
    },
    counts: {
      sponsors: event._count.sponsors,
      activities: event._count.activities,
    },
  });
});

/**
 * GET /api/events/reports/summary — Aggregate report across all events.
 * Useful for event performance dashboards and YoY comparisons.
 */
router.get("/reports/summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      totalEvents: 0,
      totalRevenue: 0,
      totalAttendees: 0,
      totalNewDonors: 0,
      topEvents: [],
    });
    return;
  }

  const { startDate, endDate, eventType } = req.query;

  // Build filter dynamically
  const whereConditions: Prisma.EventWhereInput = { organizationId };
  
  if (startDate || endDate) {
    whereConditions.startDate = {};
    if (startDate) {
      whereConditions.startDate.gte = new Date(startDate as string);
    }
    if (endDate) {
      whereConditions.startDate.lte = new Date(endDate as string);
    }
  }
  
  if (eventType) {
    whereConditions.type = eventType as Prisma.EnumEventTypeFilter<"Event">;
  }

  const events = await prisma.event.findMany({
    where: whereConditions,
    select: {
      id: true,
      name: true,
      type: true,
      startDate: true,
      _count: {
        select: {
          guests: true,
          orders: true,
          donations: true,
        },
      },
    },
  });

  // Get revenue for all matching events
  const eventIds = events.map((e) => e.id);

  const [orderRevenue, donationRevenue, checkedInCounts] = await Promise.all([
    prisma.eventOrder.aggregate({
      where: { eventId: { in: eventIds }, status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
    prisma.donation.aggregate({
      where: { eventId: { in: eventIds }, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.eventGuest.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, checkedIn: true },
      _count: { id: true },
    }),
  ]);

  const totalRevenue = Number(orderRevenue._sum.totalAmount ?? 0) + Number(donationRevenue._sum.amount ?? 0);
  const totalAttendees = checkedInCounts.reduce((sum, e) => sum + e._count.id, 0);

  // Calculate top events by revenue (order + donation combined)
  const eventRevenueMap = new Map<string, number>();
  
  const ordersByEvent = await prisma.eventOrder.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, status: "CONFIRMED" },
    _sum: { totalAmount: true },
  });

  const donationsByEvent = await prisma.donation.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, status: "COMPLETED" },
    _sum: { amount: true },
  });

  ordersByEvent.forEach((o) => {
    eventRevenueMap.set(o.eventId, Number(o._sum.totalAmount ?? 0));
  });

  donationsByEvent.forEach((d) => {
    if (d.eventId) {
      const current = eventRevenueMap.get(d.eventId) ?? 0;
      eventRevenueMap.set(d.eventId, current + Number(d._sum.amount ?? 0));
    }
  });

  const topEvents = events
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      startDate: e.startDate,
      revenue: eventRevenueMap.get(e.id) ?? 0,
      guests: e._count.guests,
      checkedIn: checkedInCounts.find((c) => c.eventId === e.id)?._count.id ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  res.json({
    totalEvents: events.length,
    totalRevenue,
    totalAttendees,
    topEvents,
  });
});

export default router;
