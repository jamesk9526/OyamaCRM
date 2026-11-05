/** Fixed in-process adapters to the existing authenticated CRM command handlers.
 * No URL, HTTP method, route, JWT, or router is ever accepted from the model.
 * This keeps native role/ownership checks and business validation on every path.
 */
import express, { type Request, type Response, type Router } from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import type { Socket } from "node:net";
import { signAccessToken } from "../lib/auth.js";
import { CreateError } from "../oyama-create/domain.js";
import type { AiCapability, NativeRouter } from "./catalog.js";

const routers = new Map<NativeRouter, Promise<Router>>();
function moduleRouter(value: unknown): Router {
  for (let depth = 0; depth < 3; depth++) {
    if (typeof value === "function" && "use" in value && "route" in value) return value as Router;
    if (value && typeof value === "object" && "default" in value) value = value.default;
    else break;
  }
  throw new CreateError(503, "The native CRM command adapter is unavailable.");
}
function loadRouter(name: NativeRouter): Promise<Router> {
  let result = routers.get(name);
  if (!result) {
    switch (name) {
      case "constituents": result = import("../routes/constituents.js").then(moduleRouter); break;
      case "donations": result = import("../routes/donations.js").then(moduleRouter); break;
      case "campaigns": result = import("../routes/campaigns.js").then(moduleRouter); break;
      case "tasks": result = import("../routes/tasks.js").then(moduleRouter); break;
      case "meetings": result = import("../routes/meetings.js").then(moduleRouter); break;
      case "events": result = import("../routes/events.js").then(moduleRouter); break;
      case "grants": result = import("../routes/grants.js").then(moduleRouter); break;
      case "households": result = import("../routes/households.js").then(moduleRouter); break;
      case "email": result = import("../routes/email-campaigns.js").then(moduleRouter); break;
      case "paths": result = import("../routes/steward-paths.js").then(moduleRouter); break;
      case "create": result = import("../oyama-create/routes.js").then(moduleRouter); break;
      case "webmaster": result = import("../routes/webmaster.js").then(moduleRouter); break;
      case "qr": result = import("../routes/qr-codes.js").then(moduleRouter); break;
      case "customReports": result = import("../routes/custom-reports.js").then(moduleRouter); break;
      case "letters": result = import("../routes/letters.js").then(moduleRouter); break;
      case "customFields": result = import("../routes/custom-fields.js").then(moduleRouter); break;
    }
    if (!result) throw new CreateError(400, "Unknown CRM command adapter.");
    routers.set(name, result);
  }
  return result;
}
export async function invokeNative(req: Request, capability: AiCapability, parameters: Record<string, string>, fields: Record<string, unknown>) {
  if (!capability.native) throw new CreateError(400, "No native command is configured.");
  const descriptor = capability.native, router = await loadRouter(descriptor.router);
  const route = descriptor.path.replace(/:([A-Za-z]+)/g, (_match, key: string) => {
    const id = parameters[key];
    if (!id || !/^[A-Za-z0-9_-]{1,191}$/.test(id)) throw new CreateError(400, `A verified ${key} is required.`);
    return encodeURIComponent(id);
  });
  const app = express(); app.disable("x-powered-by"); app.use("/api/ai-command", router);
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const transport = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
    const incoming = new IncomingMessage(transport as unknown as Socket);
    incoming.method = descriptor.method; incoming.url = `/api/ai-command${route}`;
    incoming.headers = { host: "localhost", authorization: `Bearer ${signAccessToken(req.user!)}`, "content-type": "application/json" };
    const request = incoming as unknown as Request;
    request.body = fields;
    const response = new ServerResponse(incoming); response.assignSocket(transport as unknown as Socket);
    const chunks: Buffer[] = []; let size = 0, settled = false;
    const finish = (error?: unknown, value?: Record<string, unknown>) => { if (settled) return; settled = true; clearTimeout(timeout); transport.destroy(); if (error) reject(error); else resolve(value || {}); };
    const capture = (chunk: unknown) => { if (chunk !== undefined && chunk !== null) { const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)); size += data.length; if (size > 2_000_000) throw new CreateError(413, "The native result is too large. Review the operation in CRM."); chunks.push(data); } };
    const write = response.write.bind(response), end = response.end.bind(response);
    response.write = ((chunk: unknown, ...args: unknown[]) => { capture(chunk); return Reflect.apply(write, response, [chunk, ...args]); }) as typeof response.write;
    response.end = ((chunk: unknown, ...args: unknown[]) => { capture(chunk); return Reflect.apply(end, response, [chunk, ...args]); }) as typeof response.end;
    const timeoutMs = ["email.send", "email.schedule"].includes(capability.key) ? 10 * 60000 : 60000;
    const timeout = setTimeout(() => finish(new CreateError(504, "The CRM command has an uncertain outcome. Check its operation status; keep the same request key.")), timeoutMs);
    response.on("finish", () => {
      let value: Record<string, unknown> = {};
      try { const text = Buffer.concat(chunks).toString("utf8"); if (text) value = JSON.parse(text) as Record<string, unknown>; }
      catch { finish(new CreateError(response.statusCode >= 400 ? response.statusCode : 500, "The CRM command could not return a structured result. Review it in CRM.")); return; }
      if (response.statusCode >= 400) {
        const error = value.error as { message?: string } | string | undefined;
        const message = typeof error === "string" ? error : error?.message;
        finish(new CreateError(response.statusCode, message?.slice(0, 1000) || "The CRM rejected this command. Review the record and its validation requirements."));
      } else finish(undefined, value);
    });
    response.on("error", finish);
    app(request, response as unknown as Response, (error?: unknown) => finish(error instanceof CreateError ? error : new CreateError(error ? 500 : 404, "The CRM command is unavailable. No alternative endpoint was used.")));
  });
}
