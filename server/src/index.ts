import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import constituentRoutes from "./routes/constituents.js";
import donationRoutes from "./routes/donations.js";
import campaignRoutes from "./routes/campaigns.js";
import designationRoutes from "./routes/designations.js";
import taskRoutes from "./routes/tasks.js";
import reportRoutes from "./routes/reports.js";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_API_URL
      ? [process.env.NEXT_PUBLIC_API_URL, "http://localhost:3000"]
      : "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/constituents", constituentRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/reports", reportRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[API] OyamaCRM API server running on http://localhost:${PORT}`);
});

export default app;
