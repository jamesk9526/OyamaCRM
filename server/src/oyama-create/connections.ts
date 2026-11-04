import { Router } from "express";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { encryptCredential, decryptCredential } from "../services/credential-encryption.js";
import { json } from "../services/letter-production.js";
import { demand } from "./access.js";
import { route, param } from "./http.js";
import { CreateError, object, required, string } from "./domain.js";
import { azureConfig, secureEqual, verifyConnection } from "./providers.js";
const router = Router();
export const webhookRouter = Router();

router.get("/connections", route(async (req, res, org) => {
  await demand(req, "view:communications");
  const connections = await prisma.createConnection.findMany({ where: { organizationId: org }, select: { id: true, provider: true, configJson: true, readyAt: true, error: true, updatedAt: true } });
  res.json(connections);
}));
router.put("/connections/:provider", route(async (req, res, org) => {
  await demand(req, "create.connections.manage");
  if (!/^[a-f0-9]{64}$/i.test(process.env.CREDENTIAL_ENCRYPTION_KEY || "")) throw new CreateError(422, "Configure the server's credential encryption key before connecting providers.");
  const provider = param(req, "provider");
  if (!["AZURE_SMS", "META"].includes(provider)) throw new CreateError(400, "Unknown connection provider.");
  const config = provider === "AZURE_SMS" ? azureConfig(req.body) : { apiVersion: required(req.body.apiVersion, "Meta Graph API version", 10), accounts: [], instagramReady: false };
  if (provider === "META" && !/^v\d+\.\d+$/.test(string(object(config).apiVersion))) throw new CreateError(400, "Use a supported Meta Graph version such as v25.0.");
  const key = required(req.body.secret, provider === "AZURE_SMS" ? "Azure access key" : "Meta user access token", 12000);
  if (provider === "AZURE_SMS" && !/^[a-z0-9+/]{40,}={0,2}$/i.test(key)) throw new CreateError(400, "Enter a valid base64 Azure resource access key.");
  const secret = encryptCredential(provider === "AZURE_SMS" ? key : JSON.stringify({ userToken: key }));
  const webhookKey = randomBytes(32).toString("hex");
  const saved = await prisma.createConnection.upsert({ where: { organizationId_provider: { organizationId: org, provider } }, create: { organizationId: org, provider, configJson: json(config), secret, webhookSecret: encryptCredential(webhookKey) }, update: { configJson: json(config), secret, webhookSecret: encryptCredential(webhookKey), readyAt: null, error: null } });
  // The setup key is returned only once to an authorized administrator.
  res.json({ id: saved.id, provider, readyAt: null, webhookKey: provider === "AZURE_SMS" ? webhookKey : undefined });
}));
router.post("/connections/:provider/verify", route(async (req, res, org) => {
  await demand(req, "create.connections.manage");
  const connection = await prisma.createConnection.findUnique({ where: { organizationId_provider: { organizationId: org, provider: param(req, "provider") } } });
  if (!connection) throw new CreateError(404, "Save the connection before checking readiness.");
  try {
    await verifyConnection(connection);
    await prisma.createConnection.update({ where: { id: connection.id }, data: { readyAt: new Date(), error: null } });
    res.json({ ready: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider verification failed.";
    await prisma.createConnection.update({ where: { id: connection.id }, data: { readyAt: null, error: message } });
    res.status(422).json({ error: { message } });
  }
}));
router.get("/sms-consent", route(async (req, res, org) => {
  await demand(req, "create.sms.publish");
  res.json(await prisma.createSmsConsent.findMany({ where: { organizationId: org }, orderBy: { updatedAt: "desc" }, take: 200 }));
}));
router.post("/sms-consent", route(async (req, res, org, actor) => {
  await demand(req, "create.sms.publish");
  const phone = required(req.body.phone, "Phone", 20), status = string(req.body.status);
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !["OPTED_IN", "OPTED_OUT"].includes(status)) throw new CreateError(400, "Choose an E.164 phone number and a consent status.");
  const evidence = required(req.body.evidence, "Consent evidence", 5000);
  const occurredAt = new Date(string(req.body.occurredAt));
  if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > Date.now()) throw new CreateError(400, "Enter the date and time consent was recorded; it cannot be in the future.");
  await prisma.$transaction(async tx => {
    const previous = await tx.createSmsConsent.findUnique({ where: { organizationId_phone: { organizationId: org, phone } } });
    if (previous && previous.occurredAt > occurredAt) throw new CreateError(409, "A newer consent event exists. Review it before changing consent.");
    await tx.createSmsConsent.upsert({ where: { organizationId_phone: { organizationId: org, phone } }, create: { organizationId: org, phone, status, evidence, source: `staff:${actor}`, occurredAt }, update: { status, evidence, source: `staff:${actor}`, occurredAt } });
    if (status === "OPTED_OUT") await tx.createDelivery.updateMany({ where: { organizationId: org, channel: "SMS", recipientKey: phone, status: { in: ["PENDING", "HELD", "PAUSED"] } }, data: { status: "SUPPRESSED", error: "Recipient opted out of SMS." } });
  }); res.json({ recorded: true });
}));
webhookRouter.post("/azure/:id", async (req, res, next) => {
  try {
    const connection = await prisma.createConnection.findFirst({ where: { id: string(req.params.id), provider: "AZURE_SMS" } });
    if (!connection || !secureEqual(string(req.headers["x-oyama-webhook-key"]), decryptCredential(connection.webhookSecret))) { res.status(401).json({ error: { message: "Webhook authentication failed." } }); return; }
    const config = object(connection.configJson); const events = Array.isArray(req.body) ? req.body : [];
    if (!events.length || events.length > 100) throw new CreateError(400, "Provide 1–100 Event Grid events.");
    let validationResponse: string | undefined;
    for (const raw of events) {
      const event = object(raw), data = object(event.data); const type = string(event.eventType);
      if (type === "Microsoft.EventGrid.SubscriptionValidationEvent") {
        validationResponse = required(data.validationCode, "Validation code", 200);
        await prisma.createConnection.update({ where: { id: connection.id }, data: { configJson: json({ ...config, eventGridVerified: true }), readyAt: null } });
        continue;
      }
      if (string(event.topic).toLowerCase() !== string(config.topic).toLowerCase()) throw new CreateError(403, "Event Grid topic does not match the connected Azure resource.");
      if (!["Microsoft.Communication.SMSReceived", "Microsoft.Communication.SMSDeliveryReportReceived"].includes(type)) continue;
      const eventKey = required(event.id, "Event ID", 200); const occurredAt = new Date(string(event.eventTime));
      if (!Number.isFinite(occurredAt.getTime())) throw new CreateError(400, "Invalid Event Grid timestamp.");
      try {
        await prisma.$transaction(async tx => {
          await tx.createWebhookEvent.create({ data: { organizationId: connection.organizationId, provider: "AZURE_SMS", eventKey } });
          if (type.endsWith("SMSReceived")) {
            const phone = string(data.from).replace(/^(?!\+)/, "+"), to = string(data.to).replace(/^(?!\+)/, "+");
            if (to !== config.sender) throw new CreateError(403, "Incoming SMS sender does not match this connection.");
            if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new CreateError(400, "Invalid incoming phone number.");
            const keyword = string(data.message).trim().toUpperCase();
            if (!["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "START", "UNSTOP"].includes(keyword)) return;
            const status = ["START", "UNSTOP"].includes(keyword) ? "OPTED_IN" : "OPTED_OUT";
            const previous = await tx.createSmsConsent.findUnique({ where: { organizationId_phone: { organizationId: connection.organizationId, phone } } });
            if (!previous || previous.occurredAt <= occurredAt) await tx.createSmsConsent.upsert({ where: { organizationId_phone: { organizationId: connection.organizationId, phone } }, create: { organizationId: connection.organizationId, phone, status, source: "azure-inbound", evidence: `Received ${keyword}; event ${eventKey}`, occurredAt }, update: { status, source: "azure-inbound", evidence: `Received ${keyword}; event ${eventKey}`, occurredAt } });
            if (status === "OPTED_OUT") await tx.createDelivery.updateMany({ where: { organizationId: connection.organizationId, channel: "SMS", recipientKey: phone, status: { in: ["HELD", "PENDING", "PAUSED"] } }, data: { status: "SUPPRESSED", error: "Recipient opted out by SMS." } });
          } else {
            const status = string(data.deliveryStatus); if (!["Delivered", "Failed"].includes(status)) return;
            const tag = string(data.Tag || data.tag), messageId = string(data.messageId), to = string(data.to).replace(/^(?!\+)/, "+");
            if (!messageId) throw new CreateError(400, "A delivery report message ID is required.");
            await tx.createDelivery.updateMany({ where: { organizationId: connection.organizationId, channel: "SMS", recipientKey: to, ...(tag ? { id: tag } : { providerId: messageId }), status: { in: ["SENDING", "ACCEPTED", "UNKNOWN"] } }, data: { status: status === "Delivered" ? "DELIVERED" : "FAILED", providerId: messageId, ...(status === "Delivered" ? { deliveredAt: occurredAt } : { error: string(data.deliveryStatusDetails).slice(0, 2000) || "Azure delivery failed." }) } });
          }
        });
      } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue; throw error; }
    }
    res.json(validationResponse ? { validationResponse } : { received: true });
  } catch (error) { if (error instanceof CreateError) { res.status(error.status).json({ error: { message: error.message } }); return; } next(error); }
});
export default router;
