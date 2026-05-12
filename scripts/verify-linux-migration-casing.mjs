// Verifies Prisma migration SQL files do not reference known case-sensitive table names in lowercase.
import fs from "node:fs";
import path from "node:path";

/**
 * Recursively collects migration.sql files under prisma/migrations.
 * @param {string} dir Absolute directory path to walk.
 * @returns {string[]} Absolute file paths for migration SQL files.
 */
function collectMigrationFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMigrationFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === "migration.sql") {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Checks one SQL file for lowercase table references that break on Linux MySQL.
 * @param {string} filePath Absolute SQL file path.
 * @returns {{ filePath: string, issues: string[] }} File path with issue messages.
 */
function checkFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  const lines = sql.split(/\r?\n/);

  const riskyLowercaseNames = [
    "activity",
    "donation",
    "event",
    "task",
    "eventguest",
    "eventtable",
    "tickettype",
    "compassionactivity",
    "compassionappointment",
    "compassioncase",
    "compassionclient",
    "compassionfollowup",
    "compassionservice",
    "emailrecipientlist",
    "organizationsettings",
  ];

  const issues = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    for (const name of riskyLowercaseNames) {
      const alterPattern = new RegExp("\\bALTER\\s+TABLE\\s+`" + name + "`", "i");
      const refPattern = new RegExp("\\bREFERENCES\\s+`" + name + "`", "i");

      if (alterPattern.test(line) || refPattern.test(line)) {
        issues.push(`Line ${i + 1}: ${line.trim()}`);
        break;
      }
    }
  }

  return { filePath, issues };
}

const migrationsDir = path.resolve(process.cwd(), "prisma", "migrations");

if (!fs.existsSync(migrationsDir)) {
  console.error("ERROR: prisma/migrations directory not found.");
  process.exit(1);
}

const files = collectMigrationFiles(migrationsDir);
const results = files.map(checkFile).filter((item) => item.issues.length > 0);

if (results.length === 0) {
  console.log("PASS: No risky lowercase migration table references found.");
  process.exit(0);
}

console.error("FAIL: Found Linux case-sensitivity risks in migration SQL:");
for (const result of results) {
  console.error(`\n${path.relative(process.cwd(), result.filePath)}`);
  for (const issue of result.issues) {
    console.error(`  - ${issue}`);
  }
}

process.exit(1);
