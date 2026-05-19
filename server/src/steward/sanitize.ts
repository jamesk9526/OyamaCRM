/**
 * Steward AI sanitization utilities.
 * Pure functions — no Prisma, no Express, no side effects.
 */

import {
  ALLOWED_STEWARD_ARTIFACT_TYPES,
  ALLOWED_SUGGESTED_ACTION_TYPES,
  type StewardArtifactType,
  type StewardSuggestedActionPayload,
  type StewardStructuredResponsePayload,
} from "./types.js";

/** Casts an unknown value to a trimmed string, with optional fallback and max-length cap. */
export function asSafeText(value: unknown, fallback = "", maxLength = 4000): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

/** Sanitizes a raw rows array into a clean list of record objects safe for artifact rendering. */
export function sanitizeArtifactRows(rawRows: unknown): Array<Record<string, string | number | null>> {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .slice(0, 120)
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;

      const normalized: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(row as Record<string, unknown>).slice(0, 14)) {
        const safeKey = String(key || "").trim().slice(0, 80);
        if (!safeKey) continue;

        if (value == null) { normalized[safeKey] = null; continue; }
        if (typeof value === "number" && Number.isFinite(value)) { normalized[safeKey] = value; continue; }
        normalized[safeKey] = String(value).slice(0, 400);
      }

      return Object.keys(normalized).length > 0 ? normalized : null;
    })
    .filter((entry): entry is Record<string, string | number | null> => Boolean(entry));
}

/** Sanitizes a raw suggested-action payload into an allow-listed scalar map. */
export function sanitizeActionPayload(
  rawPayload: unknown
): Record<string, string | number | boolean | null> | undefined {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return undefined;

  const entries = Object.entries(rawPayload as Record<string, unknown>).slice(0, 20);
  if (entries.length === 0) return undefined;

  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of entries) {
    const safeKey = asSafeText(key, "", 80);
    if (!safeKey) continue;

    if (value == null) { sanitized[safeKey] = null; continue; }
    if (typeof value === "boolean") { sanitized[safeKey] = value; continue; }
    if (typeof value === "number" && Number.isFinite(value)) { sanitized[safeKey] = value; continue; }
    sanitized[safeKey] = asSafeText(value, "", 300);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/** Sanitizes a raw artifact object — validates type, enforces field constraints, and drops invalid ones. */
export function sanitizeArtifact(rawArtifact: unknown): Record<string, unknown> | null {
  if (!rawArtifact || typeof rawArtifact !== "object" || Array.isArray(rawArtifact)) return null;
  const candidate = rawArtifact as Record<string, unknown>;
  const rawType = asSafeText(candidate.type, "", 80) as StewardArtifactType;

  if (!ALLOWED_STEWARD_ARTIFACT_TYPES.has(rawType)) return null;

  const sanitized: Record<string, unknown> = {
    type: rawType,
    title: asSafeText(candidate.title, "", 140),
    description: asSafeText(candidate.description, "", 500),
  };

  if (rawType === "email_draft") {
    sanitized.subject = asSafeText(candidate.subject, "", 240);
    sanitized.previewText = asSafeText(candidate.previewText, "", 260);
    const bodyPlainText = asSafeText(candidate.bodyPlainText, asSafeText(candidate.body, "", 8000), 8000);
    const bodyMarkdown = asSafeText(candidate.bodyMarkdown, bodyPlainText, 8000);
    const bodyHtml = asSafeText(candidate.bodyHtml, "", 12000);
    sanitized.body = bodyPlainText;
    sanitized.bodyPlainText = bodyPlainText;
    sanitized.bodyMarkdown = bodyMarkdown;
    sanitized.bodyHtml = bodyHtml;
    sanitized.audience = asSafeText(candidate.audience, "", 220);
    sanitized.warnings = Array.isArray(candidate.warnings)
      ? candidate.warnings.map((w) => asSafeText(w, "", 240)).filter(Boolean).slice(0, 10)
      : [];
    if (!sanitized.subject || !bodyPlainText) return null;
  }

  if (rawType === "donor_list" || rawType === "csv_rows") {
    sanitized.columns = Array.isArray(candidate.columns)
      ? candidate.columns.map((c) => asSafeText(c, "", 80)).filter(Boolean).slice(0, 14)
      : [];
    sanitized.rows = sanitizeArtifactRows(candidate.rows);
    sanitized.fileName = asSafeText(candidate.fileName, "", 120);
    if (!Array.isArray(sanitized.rows) || sanitized.rows.length === 0) return null;
  }

  if (rawType === "report_summary") {
    sanitized.headline = asSafeText(candidate.headline, "", 220);
    sanitized.boardSummary = asSafeText(candidate.boardSummary, "", 8000);
    sanitized.keyMetrics = Array.isArray(candidate.keyMetrics)
      ? candidate.keyMetrics.map((i) => asSafeText(i, "", 240)).filter(Boolean).slice(0, 12)
      : [];
    sanitized.risks = Array.isArray(candidate.risks)
      ? candidate.risks.map((i) => asSafeText(i, "", 240)).filter(Boolean).slice(0, 12)
      : [];
    sanitized.opportunities = Array.isArray(candidate.opportunities)
      ? candidate.opportunities.map((i) => asSafeText(i, "", 240)).filter(Boolean).slice(0, 12)
      : [];
  }

  if (rawType === "task_list") {
    const tasks = Array.isArray(candidate.tasks)
      ? candidate.tasks
          .map((task) => {
            if (!task || typeof task !== "object" || Array.isArray(task)) return null;
            const t = task as Record<string, unknown>;
            const title = asSafeText(t.title, "", 220);
            if (!title) return null;
            return {
              title,
              priority: asSafeText(t.priority, "", 80),
              dueDate: asSafeText(t.dueDate, "", 80),
              donorName: asSafeText(t.donorName, "", 140),
            };
          })
          .filter((t): t is { title: string; priority: string; dueDate: string; donorName: string } => Boolean(t))
          .slice(0, 25)
      : [];

    if (tasks.length === 0) return null;
    sanitized.tasks = tasks;
  }

  if (rawType === "call_script") {
    sanitized.openingLine = asSafeText(candidate.openingLine, "", 400);
    sanitized.donorContext = asSafeText(candidate.donorContext, "", 600);
    sanitized.talkingPoints = Array.isArray(candidate.talkingPoints)
      ? candidate.talkingPoints.map((i) => asSafeText(i, "", 300)).filter(Boolean).slice(0, 12)
      : [];
    sanitized.nextStep = asSafeText(candidate.nextStep, "", 280);
  }

  if (rawType === "report_card") {
    sanitized.fiscalYearLabel = asSafeText(candidate.fiscalYearLabel, "", 60);
    sanitized.deepLink = asSafeText(candidate.deepLink, "", 120);
    sanitized.deepLinkLabel = asSafeText(candidate.deepLinkLabel, "", 80);
    const rawMetrics = Array.isArray(candidate.metrics) ? candidate.metrics : [];
    sanitized.metrics = rawMetrics
      .map((m) => {
        if (!m || typeof m !== "object" || Array.isArray(m)) return null;
        const rm = m as Record<string, unknown>;
        const label = asSafeText(rm.label, "", 80);
        const value = asSafeText(rm.value, "", 80);
        if (!label || !value) return null;
        const trend = asSafeText(rm.trend, "", 10) as "up" | "down" | "flat" | "";
        return { label, value, delta: asSafeText(rm.delta, "", 60), trend: trend || undefined };
      })
      .filter(Boolean)
      .slice(0, 10);
    if (candidate.chartData && typeof candidate.chartData === "object" && !Array.isArray(candidate.chartData)) {
      const cd = candidate.chartData as Record<string, unknown>;
      const cdLabels = Array.isArray(cd.labels) ? cd.labels.map((l) => asSafeText(l, "", 20)).filter(Boolean).slice(0, 36) : [];
      const cdValues = Array.isArray(cd.values) ? cd.values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).slice(0, 36) : [];
      if (cdLabels.length > 0 && cdValues.length > 0) sanitized.chartData = { labels: cdLabels, values: cdValues };
    }
  }

  if (rawType === "chart") {
    const rawChartType = asSafeText(candidate.chartType, "bar", 12);
    const validChartTypes = new Set(["bar", "line", "pie", "donut", "stacked_bar"]);
    sanitized.chartType = validChartTypes.has(rawChartType) ? rawChartType : "bar";
    sanitized.labels = Array.isArray(candidate.labels)
      ? candidate.labels.map((l) => asSafeText(l, "", 30)).filter(Boolean).slice(0, 36)
      : [];
    sanitized.yAxisPrefix = asSafeText(candidate.yAxisPrefix, "", 10);
    sanitized.yAxisLabel = asSafeText(candidate.yAxisLabel, "", 60);
    const rawSeries = Array.isArray(candidate.series) ? candidate.series : [];
    sanitized.series = rawSeries
      .map((s) => {
        if (!s || typeof s !== "object" || Array.isArray(s)) return null;
        const rs = s as Record<string, unknown>;
        const name = asSafeText(rs.name, "Series", 80);
        const data = Array.isArray(rs.data)
          ? rs.data.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).slice(0, 36)
          : [];
        if (data.length === 0) return null;
        return { name, color: asSafeText(rs.color, "", 30) || undefined, data };
      })
      .filter(Boolean)
      .slice(0, 6);
    const needsLabels = sanitized.chartType === "bar" || sanitized.chartType === "line" || sanitized.chartType === "stacked_bar";
    if (needsLabels && (!Array.isArray(sanitized.labels) || (sanitized.labels as string[]).length === 0)) return null;
    if (!Array.isArray(sanitized.series) || (sanitized.series as unknown[]).length === 0) return null;
  }

  return sanitized;
}

/** Extracts the optional steward-artifacts fenced block from raw model output. */
export function extractStewardArtifacts(rawText: string): { replyMarkdown: string; artifactsJson: string | null } {
  const blockRegex = /```steward-artifacts\s*([\s\S]*?)```/i;
  const match = rawText.match(blockRegex);
  if (!match) return { replyMarkdown: rawText.trim(), artifactsJson: null };
  return { replyMarkdown: rawText.replace(blockRegex, "").trim(), artifactsJson: match[1]?.trim() || null };
}

/** Normalizes model text into markdown + structured artifacts, never throwing on parse failures. */
export function normalizeStewardStructuredResponse(
  rawText: string,
  options: { debug: boolean }
): StewardStructuredResponsePayload {
  const extracted = extractStewardArtifacts(String(rawText || ""));
  const base: StewardStructuredResponsePayload = {
    version: 1,
    replyMarkdown: extracted.replyMarkdown,
    artifacts: [],
    suggestedActions: [],
    evidence: [],
  };

  if (!extracted.artifactsJson) return base;

  try {
    const parsed = JSON.parse(extracted.artifactsJson) as Record<string, unknown>;
    const rawArtifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
    const rawActions = Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [];
    const rawEvidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];

    const artifacts = rawArtifacts
      .map((a) => sanitizeArtifact(a))
      .filter((a): a is Record<string, unknown> => Boolean(a))
      .slice(0, 8);

    const suggestedActions = rawActions
      .map((action) => {
        if (!action || typeof action !== "object" || Array.isArray(action)) return null;
        const candidate = action as Record<string, unknown>;
        const label = asSafeText(candidate.label, "", 220);
        const actionType = asSafeText(candidate.actionType, "", 80);
        if (!label || !actionType || !ALLOWED_SUGGESTED_ACTION_TYPES.has(actionType)) return null;
        const payload = sanitizeActionPayload(candidate.payload);
        return {
          label,
          actionType,
          requiresConfirmation: candidate.requiresConfirmation !== false,
          ...(payload ? { payload } : {}),
        };
      })
      .filter((a): a is StewardSuggestedActionPayload => Boolean(a))
      .slice(0, 10);

    const evidence = rawEvidence
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const candidate = item as Record<string, unknown>;
        const label = asSafeText(candidate.label, "", 220);
        if (!label) return null;
        const detail = asSafeText(candidate.detail, "", 420);
        return { label, ...(detail ? { detail } : {}) };
      })
      .filter((i): i is { label: string; detail?: string } => Boolean(i))
      .slice(0, 16);

    return {
      version: 1,
      replyMarkdown: asSafeText(parsed.replyMarkdown, extracted.replyMarkdown, 12000) || extracted.replyMarkdown,
      artifacts,
      suggestedActions,
      evidence,
    };
  } catch {
    if (options.debug) {
      return { ...base, parseWarning: "Structured output unavailable due to invalid steward-artifacts JSON." };
    }
    return base;
  }
}
