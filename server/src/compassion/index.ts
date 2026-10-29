import "dotenv/config";
import app from "./app.js";
import { compassionDatabase } from "./database.js";
process.env.TZ = process.env.COMPASSION_TIMEZONE || "America/Chicago";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) throw new Error("JWT_SECRET must match the platform identity service.");
const port = Number(process.env.COMPASSION_API_PORT || 4100);
const server = app.listen(port, process.env.COMPASSION_API_HOST || "127.0.0.1", () => console.log(`Compassion API running on http://127.0.0.1:${port}`));
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => server.close(() => { void compassionDatabase.$disconnect().finally(() => process.exit(0)); }));
}
