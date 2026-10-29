/** Apply only the additive Compassion migration; never deploy unrelated pending migrations. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const names = ["20261029120000_refactor_compassion_client_care", "20261029130000_compassion_boundaries_and_arrivals", "20261029140000_compassion_recovery_compatibility"];
for (const name of names) {
const sql = await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [previous] = await connection.execute("SELECT checksum, finished_at FROM _prisma_migrations WHERE migration_name = ? AND rolled_back_at IS NULL", [name]);
  if (previous.some((row) => row.finished_at && row.checksum === checksum)) { console.log("Compassion migration already applied."); }
  else {
    if (previous.length) throw new Error("Migration history differs; inspect it before continuing.");
    const statements = sql.split(";").map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      // Migration is intentionally limited to care tables and information_schema probes.
      if (/\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i.test(statement) && !/ON UPDATE/i.test(statement)) throw new Error("Unexpected non-additive migration statement.");
      await connection.query(statement);
    }
    await connection.execute("INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES (?, ?, ?, NOW(3), NOW(3), 1)", [randomUUID(), checksum, name]);
    console.log("Applied Compassion-only additive migration. Donor migrations were not executed.");
  }
} finally { await connection.end(); }

}
