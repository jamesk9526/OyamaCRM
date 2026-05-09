// CSV parsing utilities — smart header detection, quoted-field parsing, and column-type inference.
// Used by ImportWizard to process uploaded CSV files entirely client-side (no external libraries).

/** Raw parsed row: maps CSV column header names to cell values (as strings). */
export type RawRow = Record<string, string>;

/** Result of parsing a CSV file, including which row contained the headers. */
export interface CsvParseResult {
  headers: string[];
  rows: RawRow[];
  /** 1-based row number where actual column headers were found (for display to the user). */
  detectedHeaderRow: number;
}

/**
 * Per-column statistics shown in the Field Details panel and used for data quality warnings.
 * Computed once after file upload; immutable thereafter.
 */
export interface ColumnStats {
  colName: string;
  /** Up to 5 unique non-empty sample values from this column. */
  sampleValues: string[];
  /** Count of distinct non-empty values in this column. */
  uniqueCount: number;
  /** Percentage of rows (0–100) that have a non-empty value. */
  fillRate: number;
  detectedType: "Text" | "Number" | "Date" | "Boolean" | "Phone" | "Email";
}

// ─── Internal parsing helpers ─────────────────────────────────────────────────

/**
 * splitCsvLine: parse one CSV line, respecting quoted fields with embedded commas and "" escapes.
 * Handles the RFC 4180 standard quoting rules.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // "" inside a quoted field = escaped double-quote
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

/**
 * isTitleRow: returns true if a row looks like a report title / system artifact, not real data.
 * Rule: fewer than 3 populated cells, OR first cell matches known report-artifact prefixes.
 */
function isTitleRow(cells: string[]): boolean {
  const populated = cells.filter((c) => c.trim() !== "");
  if (populated.length === 0) return true;
  if (populated.length < 3) return true;
  const first = cells[0].trim().toLowerCase();
  // Known report prefixes: textbox1, "Donor File Address List", dated rows, page numbers
  return /^(textbox|report|title|date|page|\d{1,2}[/\-]\d)/.test(first);
}

/**
 * isHeaderRow: returns true if most cells look like column names — short, non-numeric strings.
 * At least 70% of populated cells must pass the "looks like a column name" test.
 */
function isHeaderRow(cells: string[]): boolean {
  const populated = cells.filter((c) => c.trim() !== "");
  if (populated.length < 3) return false;
  const columnLike = populated.filter((c) => {
    const t = c.trim();
    // Column names are short (≤50 chars), non-empty, not purely numeric
    return t.length > 0 && t.length <= 50 && !/^\d+(\.\d+)?$/.test(t);
  });
  return columnLike.length / populated.length >= 0.7;
}

// ─── Exported parsing functions ───────────────────────────────────────────────

/**
 * detectHeaderRow: scans the first 10 CSV lines to find the actual column header row.
 * Skips title/blank rows (e.g. "textbox1", report titles, empty lines).
 * Returns the 0-based index of the detected header row; falls back to 0 if none found.
 */
export function detectHeaderRow(lines: string[]): number {
  const limit = Math.min(lines.length, 10);
  for (let i = 0; i < limit; i++) {
    const cells = splitCsvLine(lines[i]);
    if (!isTitleRow(cells) && isHeaderRow(cells)) return i;
  }
  return 0;
}

/**
 * parseCSV: full CSV parser with smart header detection.
 * Skips title/blank rows above the detected header row.
 * Returns the headers array, data rows keyed by header name, and the 1-based header row number.
 *
 * @param text — raw CSV file content as a string
 */
export function parseCSV(text: string): CsvParseResult {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return { headers: [], rows: [], detectedHeaderRow: 1 };

  const headerIdx = detectHeaderRow(lines);
  // Filter empty trailing header cells (from trailing commas)
  const headers = splitCsvLine(lines[headerIdx]).filter((h) => h.trim() !== "");
  const rows: RawRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip blank lines
    const values = splitCsvLine(line);
    const row: RawRow = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }

  return { headers, rows, detectedHeaderRow: headerIdx + 1 }; // +1 for 1-based display
}

// ─── Column statistics ────────────────────────────────────────────────────────

/**
 * detectColumnType: infers the likely data type of a CSV column by examining its values.
 * Uses the first 30 non-empty values as a representative sample.
 */
function detectColumnType(values: string[]): ColumnStats["detectedType"] {
  const sample = values.filter((v) => v.trim() !== "").slice(0, 30);
  if (sample.length === 0) return "Text";
  if (sample.every((v) => /^-?\d+(\.\d+)?$/.test(v.trim()))) return "Number";
  if (sample.every((v) => /^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}/.test(v.trim()))) return "Date";
  if (sample.every((v) => /^(true|false|yes|no|0|1)$/i.test(v.trim()))) return "Boolean";
  if (sample.some((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()))) return "Email";
  if (sample.some((v) => /^\+?[\d\s().\-]{7,15}$/.test(v.trim()))) return "Phone";
  return "Text";
}

/**
 * computeColumnStats: computes display statistics for every CSV column in O(rows × cols).
 * Results are shown in the Field Details panel and used for data quality warning generation.
 *
 * @param headers — CSV column header names
 * @param rows    — all parsed data rows
 */
export function computeColumnStats(
  headers: string[],
  rows: RawRow[]
): Record<string, ColumnStats> {
  const stats: Record<string, ColumnStats> = {};
  for (const col of headers) {
    const allValues = rows.map((r) => r[col] ?? "");
    const nonEmpty = allValues.filter((v) => v.trim() !== "");
    const unique = Array.from(new Set(nonEmpty));
    stats[col] = {
      colName: col,
      sampleValues: unique.slice(0, 5),
      uniqueCount: unique.length,
      fillRate: rows.length > 0 ? Math.round((nonEmpty.length / rows.length) * 100) : 0,
      detectedType: detectColumnType(allValues),
    };
  }
  return stats;
}
