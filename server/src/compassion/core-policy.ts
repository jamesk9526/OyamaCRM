import type { Request, Response, NextFunction, RequestHandler } from "express";
import { atomic, prisma } from "./database.js";
import { hasCareCapability, org, audit, type CareCapability } from "./security.js";
import { withinAvailability } from "./scheduling.js";
import { CompassionAppointmentStatus, CompassionAppointmentType, CompassionCaseStatus, CompassionCaseType, CompassionClientStatus, CompassionFollowUpStatus, CompassionPriority, CompassionServiceType } from "@prisma/client";

export function recoveredPolicy(req: Request, res: Response, next: NextFunction) {
  const write = !["GET", "HEAD"].includes(req.method);
  if (write) {
    const body = req.body ?? {};
    const enums: Record<string, readonly string[]> = { clientStatus: Object.values(CompassionClientStatus), caseStatus: Object.values(CompassionCaseStatus), caseType: Object.values(CompassionCaseType), appointmentType: Object.values(CompassionAppointmentType), priority: Object.values(CompassionPriority), serviceType: Object.values(CompassionServiceType) };
    if (req.path.startsWith("/appointments")) enums.status = Object.values(CompassionAppointmentStatus);
    if (req.path.startsWith("/follow-ups")) enums.status = Object.values(CompassionFollowUpStatus);
    for (const [field, values] of Object.entries(enums)) {
      if (body[field] !== undefined && !values.includes(body[field])) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: `Invalid ${field}.` } }); return; }
    }
    for (const field of ["startTime", "endTime", "dateOfBirth", "intakeDate", "openedAt", "closedAt", "dueDate", "serviceDate"]) {
      if (body[field] && (typeof body[field] !== "string" || !Number.isFinite(Date.parse(body[field])))) { res.status(400).json({ error: { code: "INVALID_DATE", message: `Invalid ${field}.` } }); return; }
    }
    if (body.timezone !== undefined) { try { new Intl.DateTimeFormat("en-US", { timeZone: String(body.timezone) }); } catch { res.status(400).json({ error: { code: "INVALID_TIMEZONE", message: "Choose a valid timezone." } }); return; } }
  }
  let capability: CareCapability = "records";
  if (req.path.startsWith("/appointment-widget")) capability = "manage";
  else if (req.path.startsWith("/staff")) capability = write ? "manage" : "records";
  else if (req.path.startsWith("/appointments")) capability = "schedule";
  else if (req.path.startsWith("/reports")) capability = "export";
  else if (/^\/(cases|follow-ups|services|families|dashboard-summary)/.test(req.path) || /^\/clients\/[^/]+/.test(req.path)) capability = "casework";
  else if (write) capability = "casework";
  if (!hasCareCapability(String(res.locals.careRole), capability)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "This action requires a Compassion capability." } }); return;
  }
  // Recovered generic activity entries must never act as a medical chart or document store.
  if (write && /activity-entries/.test(req.path) && ["CLIENT_DOCUMENT", "CLIENT_PORTAL_EVENT"].includes(req.body?.activityType)) {
    res.status(400).json({ error: { code: "PROTECTED_WORKFLOW_REQUIRED", message: "Use protected documents or portal workflows." } }); return;
  }
  if (write && req.path.startsWith("/services") && ["PREGNANCY_TEST", "ULTRASOUND"].includes(req.body?.serviceType) && !hasCareCapability(String(res.locals.careRole), "clinical")) {
    res.status(403).json({ error: { code: "CLINICAL_ACCESS_REQUIRED", message: "Medical services require clinical access." } }); return;
  }
  if (req.method === "DELETE" && !hasCareCapability(String(res.locals.careRole), "manage")) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Deletion requires care administration." } }); return;
  }
  if (req.method === "DELETE" && /^\/(clients|cases)\//.test(req.path)) {
    res.status(409).json({ error: { code: "ARCHIVE_REQUIRED", message: "Archive client and case records to preserve clinical and migration history." } }); return;
  }
  if (write && (req.path === "/clients" || /^\/clients\/[^/]+$/.test(req.path))) {
    for (const field of ["firstName", "lastName"]) {
      const value = req.body?.[field];
      if ((req.method === "POST" || value !== undefined) && (typeof value !== "string" || !value.trim() || value.length > 191)) {
        res.status(400).json({ error: { code: "INVALID_NAME", message: "Enter first and last names up to 191 characters each." } }); return;
      }
      if (typeof value === "string") req.body[field] = value.trim();
    }
  }
  if (["PATCH", "DELETE"].includes(req.method) && /^\/services\/[^/]+$/.test(req.path) && !hasCareCapability(String(res.locals.careRole), "clinical")) {
    void prisma.compassionService.findFirst({ where: { id: req.path.split("/")[2], organizationId: org(req) }, select: { serviceType: true } }).then((service) => {
      if (service && ["PREGNANCY_TEST", "ULTRASOUND"].includes(service.serviceType)) {
        res.status(403).json({ error: { code: "CLINICAL_ACCESS_REQUIRED", message: "Medical service history requires clinical access." } });
      } else next();
    }, next);
    return;
  }
  // Read events contain identifiers only and fail closed if audit persistence fails.
  if (!write && req.path.startsWith("/clients/")) {
    void audit(req, "CLIENT_READ", req.path.split("/")[2]).then(() => next(), next); return;
  }
  next();
}

/** Buffers the JSON response until the database transaction has committed. */
export function careTransaction(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    const send = res.json.bind(res);
    let payload: unknown;
    res.json = ((value: unknown) => { payload = value; return res; }) as Response["json"];
    try {
      await atomic(org(req), async () => {
        const membership = await prisma.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId: org(req), userId: req.user!.sub } } });
        if (!membership?.active || membership.role !== res.locals.careRole) {
          res.statusCode = 403; payload = { error: { code: "MEMBERSHIP_CHANGED", message: "Your client-care access changed. Refresh the workspace." } }; throw new Error("CARE_RESPONSE_ROLLBACK");
        }
        await handler(req, res);
        if (res.statusCode >= 400) throw new Error("CARE_RESPONSE_ROLLBACK");
        const row = payload as { id?: string; startTime?: Date; endTime?: Date; status?: string; assignedCompassionStaffId?: string | null } | undefined;
        if (!row?.id || !req.path.startsWith("/appointments")) return;
        const id = row.id;
        const requested = req.body?.resourceIds;
        if (requested !== undefined && (!Array.isArray(requested) || requested.length > 20 || requested.some((x: unknown) => typeof x !== "string"))) {
          res.statusCode = 400; payload = { error: { code: "INVALID_RESOURCES", message: "Select up to 20 resources." } }; throw new Error("CARE_RESPONSE_ROLLBACK");
        }
        const old = await prisma.compassionReservation.findMany({ where: { appointmentId: id, organizationId: org(req) } });
        const required = row.assignedCompassionStaffId ? await prisma.compassionResource.findMany({ where: { organizationId: org(req), staffId: row.assignedCompassionStaffId, kind: "STAFF", active: true }, select: { id: true } }) : [];
        const resourceIds = [...new Set([...(requested === undefined ? old.map((r) => r.resourceId) : requested as string[]), ...required.map((r) => r.id)])];
        await prisma.compassionReservation.deleteMany({ where: { appointmentId: id, organizationId: org(req) } });
        if (req.method === "DELETE" || ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(String(row.status))) return;
        if (!row.startTime || !row.endTime) return;
        for (const resourceId of resourceIds) {
          const resource = await prisma.compassionResource.findFirst({ where: { id: resourceId, organizationId: org(req), active: true } });
          const conflict = await prisma.compassionReservation.findFirst({ where: { organizationId: org(req), resourceId, startTime: { lt: new Date(row.endTime) }, endTime: { gt: new Date(row.startTime) } } });
          if (!resource || conflict || !withinAvailability(new Date(row.startTime), new Date(row.endTime), resource.timezone, resource.availability)) {
            res.statusCode = 409; payload = { error: { code: "RESOURCE_CONFLICT", message: "A selected resource is unavailable." } }; throw new Error("CARE_RESPONSE_ROLLBACK");
          }
          await prisma.compassionReservation.create({ data: { organizationId: org(req), appointmentId: id, resourceId, startTime: new Date(row.startTime), endTime: new Date(row.endTime) } });
        }
      });
      res.json = send; send(payload);
    } catch (error) {
      res.json = send;
      if (error instanceof Error && error.message === "CARE_RESPONSE_ROLLBACK") { send(payload); return; }
      next(error);
    }
  };
}

/** Public booking uses its configured organization's lock and never impersonates a staff user. */
export function publicBookingTransaction(resolveOrg: (token: string) => Promise<string | null>, handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    const organizationId = await resolveOrg(String(req.params.token));
    if (!organizationId) { res.status(404).json({ error: { message: "Booking link not found." } }); return; }
    const json = res.json.bind(res); let payload: unknown;
    res.json = ((value: unknown) => { payload = value; return res; }) as Response["json"];
    try {
      await atomic(organizationId, async () => { await handler(req, res); if (res.statusCode >= 400) throw new Error("CARE_RESPONSE_ROLLBACK"); });
      res.json = json; json(payload);
    } catch (error) { res.json = json; if (error instanceof Error && error.message === "CARE_RESPONSE_ROLLBACK") json(payload); else next(error); }
  };
}
