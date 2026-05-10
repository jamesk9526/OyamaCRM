/**
 * Full CRM backup service.
 * Exports/imports complete database snapshots as JSON + SQL text.
 */
import mysql from "mysql2/promise";

interface JsonBufferShape {
  __oyamaType: "buffer";
  base64: string;
}

export interface CrmBackupTable {
  tableName: string;
  rowCount: number;
  createTableSql: string;
  rows: Record<string, unknown>[];
}

export interface CrmDatabaseSnapshot {
  databaseName: string;
  tableCount: number;
  rowCount: number;
  tables: CrmBackupTable[];
}

export interface CrmBackupBundle {
  backupSchemaVersion: "1";
  generatedAt: string;
  generatedBy: string;
  organizationId: string;
  appVersion: string;
  sqlDump: string;
  primaryDatabase: CrmDatabaseSnapshot;
  watchdogDatabase?: CrmDatabaseSnapshot;
}

export interface RestoreReport {
  primary: {
    databaseName: string;
    restoredTables: number;
    restoredRows: number;
  };
  watchdog?: {
    databaseName: string;
    restoredTables: number;
    restoredRows: number;
  };
}

interface ExportDatabaseParams {
  databaseUrl: string;
  excludeTables?: Set<string>;
}

interface RestoreDatabaseParams {
  databaseUrl: string;
  snapshot: CrmDatabaseSnapshot;
}

/** Escapes a table or column identifier for dynamic SQL. */
function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

/** Extracts one database name from a MySQL connection URL. */
function getDatabaseName(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const pathname = parsed.pathname.replace(/^\//, "").trim();
  return pathname || "unknown_database";
}

/** Normalizes values to JSON-safe serializable structures. */
function normalizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) {
    const encoded: JsonBufferShape = {
      __oyamaType: "buffer",
      base64: value.toString("base64"),
    };
    return encoded;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = normalizeJsonValue(nested);
    }
    return result;
  }
  return value;
}

/** Converts ISO date strings to MySQL DATETIME-compatible string format. */
function toMysqlDateTimeString(value: string): string {
  const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoLike.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toISOString().replace("T", " ").replace("Z", "");
}

/** Converts JSON-safe values back to DB insert values. */
function denormalizeDbValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "__oyamaType" in (value as Record<string, unknown>) &&
    (value as Record<string, unknown>).__oyamaType === "buffer"
  ) {
    const base64 = (value as JsonBufferShape).base64;
    return Buffer.from(base64, "base64");
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    return toMysqlDateTimeString(value);
  }

  return value;
}

/** Returns all base-table names from one database. */
async function listBaseTables(pool: mysql.Pool): Promise<string[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableNames = rows
    .map((row) => String(Object.values(row)[0] ?? ""))
    .filter((name) => name.length > 0)
    .sort((a, b) => a.localeCompare(b));

  return tableNames;
}

/** Builds one SQL insert statement for a single row. */
function buildInsertSql(tableName: string, row: Record<string, unknown>, pool: mysql.Pool): string {
  const columns = Object.keys(row);
  if (columns.length === 0) {
    return `INSERT INTO ${escapeIdentifier(tableName)} () VALUES ();`;
  }

  const columnSql = columns.map((column) => escapeIdentifier(column)).join(", ");
  const valuesSql = columns
    .map((column) => {
      const value = denormalizeDbValue(row[column]);
      return pool.escape(value as never);
    })
    .join(", ");

  return `INSERT INTO ${escapeIdentifier(tableName)} (${columnSql}) VALUES (${valuesSql});`;
}

/** Exports one database to JSON tables and SQL dump text. */
async function exportDatabaseSnapshot(params: ExportDatabaseParams): Promise<{
  snapshot: CrmDatabaseSnapshot;
  sqlLines: string[];
}> {
  const databaseName = getDatabaseName(params.databaseUrl);
  const pool = mysql.createPool(params.databaseUrl);

  try {
    const tableNames = await listBaseTables(pool);
    const filteredTables = tableNames.filter((tableName) => !params.excludeTables?.has(tableName));

    const tables: CrmBackupTable[] = [];
    let totalRows = 0;
    const sqlLines: string[] = [];

    sqlLines.push(`-- DATABASE SNAPSHOT: ${databaseName}`);
    sqlLines.push("SET FOREIGN_KEY_CHECKS = 0;");

    for (const tableName of filteredTables) {
      const [createRows] = await pool.query<mysql.RowDataPacket[]>(`SHOW CREATE TABLE ${escapeIdentifier(tableName)}`);
      const createRow = createRows[0] ?? {};
      const createTableSql = String(
        (createRow["Create Table"] as string | undefined) ??
          Object.values(createRow).find((value) => typeof value === "string" && String(value).startsWith("CREATE TABLE")) ??
          "",
      );

      const [rowPackets] = await pool.query<mysql.RowDataPacket[]>(`SELECT * FROM ${escapeIdentifier(tableName)}`);
      const rowObjects = rowPackets.map((packet) => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(packet)) {
          normalized[key] = normalizeJsonValue(value);
        }
        return normalized;
      });

      totalRows += rowObjects.length;
      tables.push({
        tableName,
        rowCount: rowObjects.length,
        createTableSql,
        rows: rowObjects,
      });

      sqlLines.push("");
      sqlLines.push(`-- TABLE: ${tableName}`);
      if (createTableSql.trim()) {
        const createWithSemi = createTableSql.trim().endsWith(";")
          ? createTableSql.trim()
          : `${createTableSql.trim()};`;
        sqlLines.push(createWithSemi);
      }
      sqlLines.push(`TRUNCATE TABLE ${escapeIdentifier(tableName)};`);
      for (const row of rowObjects) {
        sqlLines.push(buildInsertSql(tableName, row, pool));
      }
    }

    sqlLines.push("SET FOREIGN_KEY_CHECKS = 1;");

    return {
      snapshot: {
        databaseName,
        tableCount: tables.length,
        rowCount: totalRows,
        tables,
      },
      sqlLines,
    };
  } finally {
    await pool.end();
  }
}

/** Restores one database from JSON table snapshots. */
async function restoreDatabaseSnapshot(params: RestoreDatabaseParams): Promise<{
  databaseName: string;
  restoredTables: number;
  restoredRows: number;
}> {
  const databaseName = getDatabaseName(params.databaseUrl);
  const pool = mysql.createPool(params.databaseUrl);
  const connection = await pool.getConnection();

  let restoredTables = 0;
  let restoredRows = 0;

  try {
    const existingTables = new Set(await listBaseTables(pool));

    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of params.snapshot.tables) {
      if (!existingTables.has(table.tableName)) {
        if (!table.createTableSql.trim()) {
          throw new Error(`Cannot restore missing table ${table.tableName}: no CREATE TABLE SQL in backup.`);
        }
        await connection.query(table.createTableSql);
        existingTables.add(table.tableName);
      }

      await connection.query(`TRUNCATE TABLE ${escapeIdentifier(table.tableName)}`);
    }

    for (const table of params.snapshot.tables) {
      for (const row of table.rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;

        const placeholders = columns.map(() => "?").join(", ");
        const values = columns.map((column) => denormalizeDbValue(row[column]));
        const insertSql = `INSERT INTO ${escapeIdentifier(table.tableName)} (${columns
          .map((column) => escapeIdentifier(column))
          .join(", ")}) VALUES (${placeholders})`;

        await connection.query(insertSql, values);
        restoredRows += 1;
      }
      restoredTables += 1;
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await connection.commit();

    return {
      databaseName,
      restoredTables,
      restoredRows,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

/** Exports full CRM backup bundle with SQL dump + JSON data payloads. */
export async function exportFullCrmBackup(params: {
  organizationId: string;
  generatedBy: string;
  appVersion: string;
  includeWatchdogDatabase: boolean;
}): Promise<CrmBackupBundle> {
  const primaryUrl = process.env.DATABASE_URL?.trim();
  if (!primaryUrl) {
    throw new Error("DATABASE_URL is required for CRM backup export.");
  }

  const primary = await exportDatabaseSnapshot({ databaseUrl: primaryUrl });
  const sqlLines = [...primary.sqlLines];

  let watchdogSnapshot: CrmDatabaseSnapshot | undefined;
  if (params.includeWatchdogDatabase) {
    const watchdogUrl = process.env.WATCHDOG_DATABASE_URL?.trim();
    if (watchdogUrl) {
      const watchdog = await exportDatabaseSnapshot({
        databaseUrl: watchdogUrl,
        excludeTables: new Set(["watchdog_crm_backups"]),
      });
      watchdogSnapshot = watchdog.snapshot;
      sqlLines.push("");
      sqlLines.push(...watchdog.sqlLines);
    }
  }

  return {
    backupSchemaVersion: "1",
    generatedAt: new Date().toISOString(),
    generatedBy: params.generatedBy,
    organizationId: params.organizationId,
    appVersion: params.appVersion,
    sqlDump: sqlLines.join("\n"),
    primaryDatabase: primary.snapshot,
    watchdogDatabase: watchdogSnapshot,
  };
}

/** Restores a full CRM backup bundle into the configured database URLs. */
export async function restoreFullCrmBackup(params: {
  bundle: CrmBackupBundle;
  includeWatchdogDatabase: boolean;
}): Promise<RestoreReport> {
  const primaryUrl = process.env.DATABASE_URL?.trim();
  if (!primaryUrl) {
    throw new Error("DATABASE_URL is required for CRM backup import.");
  }

  const primaryResult = await restoreDatabaseSnapshot({
    databaseUrl: primaryUrl,
    snapshot: params.bundle.primaryDatabase,
  });

  let watchdogResult: RestoreReport["watchdog"];
  if (params.includeWatchdogDatabase && params.bundle.watchdogDatabase) {
    const watchdogUrl = process.env.WATCHDOG_DATABASE_URL?.trim();
    if (!watchdogUrl) {
      throw new Error("WATCHDOG_DATABASE_URL is required to restore watchdog backup data.");
    }

    const restored = await restoreDatabaseSnapshot({
      databaseUrl: watchdogUrl,
      snapshot: params.bundle.watchdogDatabase,
    });

    watchdogResult = restored;
  }

  return {
    primary: primaryResult,
    watchdog: watchdogResult,
  };
}
