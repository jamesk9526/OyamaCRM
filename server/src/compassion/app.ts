/** Independent API application. No donor routes, donors, campaigns, or AI are mounted. */
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import coreRoutes from "../routes/compassion.js";
import { careRoutes, publicCareRoutes } from "./routes.js";
import bookingRoutes from "../routes/compassion-public.js";

const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(express.json({ limit: "15mb" }));
app.get("/health", (_req, res) => res.json({ service: "compassion-api", status: "running" }));
app.use("/api/compassion-public", rateLimit({ windowMs: 60000, limit: 30 }), publicCareRoutes);
app.use("/api/compassion-public", bookingRoutes);
app.use("/api/compassion", careRoutes, coreRoutes);
app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Client-care endpoint not found." } }));
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  // Never print request bodies, decrypted data, SQL arguments, or raw database errors.
  console.error("[compassion-api] Request failed", error?.code === "P2021" ? "SCHEMA_NOT_READY" : "REQUEST_FAILED");
  res.status(503).json({ error: { code: "CARE_SERVICE_UNAVAILABLE", message: "Client-care service unavailable. Check database migrations and protected-storage configuration." } });
};
app.use(errors);
export default app;
