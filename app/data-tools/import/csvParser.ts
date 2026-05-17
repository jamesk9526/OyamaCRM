// CSV / TSV / pasted-tabular parsing utilities — smart header detection,
// delimiter auto-detection, quoted-field parsing, and column-type inference.
// Used by both Donor and Compassion CRM import wizards. Pure client-side; no deps.

/** Raw parsed row: maps CSV column header names to cell values (as strings). */
export type RawRow = Record<string, string>;

/** Supported delimiters. "auto" lets parseCSV detect from sample lines. */
export type Delimiter = "," | "\t" | ";" | "|" | "auto";

/** Result of parsing a CSV file, including which row contained the headers. */
export interface CsvParseResult {
  headers: string[];
  rows: RawRow[];
  /** 1-based row number where actual column headers were found (for display to the user). */
  detectedHeaderRow: number;
  /** The delimiter that was actually used (resolved from "auto" if needed). */
  delimiter: Exclude<Delimiter, "auto">;
  /** Non-fatal parser warnings such as duplicate headers or extra cells. */
  warnings: string[];
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
 * splitCsvLine: parse one line using the given delimiter, respecting quoted fields with embedded
 * delimiters and "" escapes. Handles RFC 4180-style quoting for any single-character delimiter.
 */
function splitCsvLine(line: string, delimiter: string = ","): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // "" inside a quoted field = escaped double-quote
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delimiter && !inQuotes) {
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
 * coalesceMultilineRows: joins physical lines into logical CSV rows when quoted
 * fields span multiple lines (common in address/note columns exported from legacy CRMs).
 */
function coalesceMultilineRows(lines: string[]): string[] {
  const rows: string[] = [];
  let buffer = "";
  let inQuotes = false;

  for (const line of lines) {
    buffer = buffer ? `${buffer}\n${line}` : line;

    for (let i = 0; i < line.length; i++) {
      if (line[i] !== '"') continue;
      // Escaped quote inside quoted field: ""
      if (line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    }

    if (!inQuotes) {
      rows.push(buffer);
      buffer = "";
    }
  }

  if (buffer) rows.push(buffer);
  return rows;
}

function makeUniqueHeaders(headers: string[]): { headers: string[]; warnings: string[] } {
  const seen = new Map<string, number>();
  const warnings: string[] = [];
  const unique = headers.map((header, index) => {
    const base = header.trim() || `Column ${index + 1}`;
    const count = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), count + 1);
    if (count === 0) return base;
    const renamed = `${base} (${count + 1})`;
    warnings.push(`Duplicate column "${base}" was renamed to "${renamed}".`);
    return renamed;
  });
  return { headers: unique, warnings };
}

/**
 * detectDelimiter: choose the most likely column delimiter from the first ~20 non-empty lines
 * by counting occurrences of `,`, `\t`, `;`, and `|` outside of quoted regions and picking the
 * delimiter whose per-line count is the most consistent and largest.
 *
 * Falls back to "," when no delimiter shows up clearly (single-column files).
 */
export function detectDelimiter(lines: string[]): Exclude<Delimiter, "auto"> {
  const candidates: Array<Exclude<Delimiter, "auto">> = [",", "\t", ";", "|"];
  const sample = lines.filter((l) => l.trim() !== "").slice(0, 20);
  if (sample.length === 0) return ",";

  let best: Exclude<Delimiter, "auto"> = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const counts = sample.map((l) => splitCsvLine(l, d).length - 1);
    const max = Math.max(...counts);
    if (max < 1) continue;
    // Score = avg count, penalised by variance so jagged delimiters lose
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
    const score = avg - variance * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
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
export function detectHeaderRow(lines: string[], delimiter: string = ","): number {
  const limit = Math.min(lines.length, 10);
  for (let i = 0; i < limit; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    if (!isTitleRow(cells) && isHeaderRow(cells)) return i;
  }
  return 0;
}

/**
 * parseCSV: full parser with smart header + delimiter detection. Strips a leading UTF-8 BOM and
 * normalizes line endings. Skips title/blank rows above the detected header row.
 *
 * @param text       — raw CSV/TSV/pasted-tabular content
 * @param delimiter  — delimiter to use; "auto" (default) detects from the file content
 */
export function parseCSV(text: string, delimiter: Delimiter = "auto"): CsvParseResult {
  // Strip UTF-8 BOM if present (common in Windows / Excel exports)
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\0/g, "");
  const initialLines = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const excelSep = initialLines[0]?.match(/^sep=(.)$/i)?.[1];
  const physicalLines = excelSep ? initialLines.slice(1) : initialLines;
  if (physicalLines.length === 0) {
    return { headers: [], rows: [], detectedHeaderRow: 1, delimiter: ",", warnings: [] };
  }

  const resolvedDelimiter: Exclude<Delimiter, "auto"> =
    delimiter === "auto" ? ((excelSep as Exclude<Delimiter, "auto"> | undefined) ?? detectDelimiter(physicalLines)) : delimiter;

  // Merge wrapped quoted rows so downstream header/row parsing stays column-aligned.
  const lines = coalesceMultilineRows(physicalLines);

  const headerIdx = detectHeaderRow(lines, resolvedDelimiter);
  // Filter empty trailing header cells (from trailing delimiters)
  const headerResult = makeUniqueHeaders(splitCsvLine(lines[headerIdx], resolvedDelimiter).filter((h) => h.trim() !== ""));
  const headers = headerResult.headers;
  const warnings = [...headerResult.warnings];
  const rows: RawRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // skip blank lines
    const values = splitCsvLine(line, resolvedDelimiter);
    if (values.length > headers.length) {
      warnings.push(`Row ${i + 1} has ${values.length - headers.length} extra cell(s); extra values were ignored.`);
    }
    const row: RawRow = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }

  return {
    headers,
    rows,
    detectedHeaderRow: headerIdx + 1, // +1 for 1-based display
    delimiter: resolvedDelimiter,
    warnings: Array.from(new Set(warnings)).slice(0, 50),
  };
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
