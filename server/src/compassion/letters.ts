import { randomUUID } from "node:crypto";
import { Router } from "express";
import { prisma } from "./database.js";
import { audit, org } from "./security.js";
import { check, client, route, text } from "./http.js";
export const letterRoutes = Router();
const allowedFields = ["firstName", "lastName", "preferredName", "addressLine1", "city", "state", "zip", "today"];
letterRoutes.get("/letter-templates", ...route("messages", async (req, res) => {
  const rows = await prisma.compassionConfiguration.findMany({ where: { organizationId: org(req), pluginKey: { startsWith: "letter:" } } });
  res.json(rows.map((row) => ({ id: row.id, ...row.config as object })));
}));
letterRoutes.post("/letter-templates", ...route("messages", async (req, res) => {
  const title = text(req.body.title, 191); const body = text(req.body.body, 20000);
  const fields = [...body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]);
  check(fields.every((field) => allowedFields.includes(field)), "Use only the supported client merge fields.");
  const row = await prisma.compassionConfiguration.create({ data: { organizationId: org(req), pluginKey: `letter:${randomUUID()}`, enabled: true, config: { title, body } } });
  await audit(req, "CLIENT_LETTER_TEMPLATE_SAVED", row.id); res.status(201).json({ id: row.id });
}));
letterRoutes.post("/letters/preview", ...route("messages", async (req, res) => {
  const record = await client(req, text(req.body.clientId, 191));
  const template = await prisma.compassionConfiguration.findFirst({ where: { id: text(req.body.templateId, 191), organizationId: org(req), pluginKey: { startsWith: "letter:" } } }); check(template?.config, "Letter template not found.");
  const config = template.config as { title: string; body: string };
  const values: Record<string, string | null> = { firstName: record.firstName, lastName: record.lastName, preferredName: record.preferredName || record.firstName, addressLine1: record.addressLine1, city: record.city, state: record.state, zip: record.zip, today: new Date().toLocaleDateString("en-US") };
  const body = config.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_all, field: string) => values[field] || "");
  await audit(req, "CLIENT_LETTER_PREVIEWED", record.id); res.json({ title: config.title, body });
}));
