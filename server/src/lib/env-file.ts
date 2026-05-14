/** Utilities for safely persisting selected environment keys into the project .env file. */
import { promises as fs } from "fs";
import path from "path";

const ENV_LINE_PATTERN = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;

function getEnvFilePath(): string {
  return path.resolve(process.cwd(), ".env");
}

function quoteEnvValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Upserts key/value pairs in the workspace .env file while preserving unrelated lines.
 * Values are always written as quoted strings to avoid parsing issues with punctuation.
 */
export async function upsertEnvironmentFileValues(updates: Record<string, string>): Promise<void> {
  const keys = Object.keys(updates).filter((key) => updates[key] !== undefined);
  if (keys.length === 0) return;

  const envPath = getEnvFilePath();
  let existing = "";

  try {
    existing = await fs.readFile(envPath, "utf8");
  } catch (error) {
    const asNodeError = error as NodeJS.ErrnoException;
    if (asNodeError.code !== "ENOENT") throw error;
  }

  const lines = existing ? existing.split(/\r?\n/) : [];
  const nextLines: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const match = ENV_LINE_PATTERN.exec(line);
    if (!match) {
      nextLines.push(line);
      continue;
    }

    const key = match[1];
    if (!Object.prototype.hasOwnProperty.call(updates, key)) {
      nextLines.push(line);
      continue;
    }

    nextLines.push(`${key}=${quoteEnvValue(updates[key])}`);
    seen.add(key);
  }

  for (const key of keys) {
    if (seen.has(key)) continue;
    nextLines.push(`${key}=${quoteEnvValue(updates[key])}`);
  }

  const normalized = `${nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  await fs.writeFile(envPath, normalized, "utf8");
}
