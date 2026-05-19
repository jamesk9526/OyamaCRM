// GPU telemetry parsing helpers for NVIDIA nvidia-smi output.

function parseNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGpuListOutput(rawValue) {
  return String(rawValue || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^GPU\s+(\d+):\s+(.+?)\s+\(UUID:\s+(.+?)\)$/i);
      if (!match) return null;
      return {
        index: Number(match[1]),
        name: match[2],
        uuid: match[3],
        utilizationPct: null,
        temperatureC: null,
        memoryUsedMiB: null,
        memoryTotalMiB: null,
        powerDrawW: null,
        memory: "unknown",
      };
    })
    .filter(Boolean);
}

function collapseWrappedTelemetryLines(rawValue) {
  const collapsed = [];
  const lines = String(rawValue || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const isRecordStart = (line) => /^\d+\s*,\s*GPU-[^,]+\s*,/i.test(line);

  let current = "";
  lines.forEach((line) => {
    if (isRecordStart(line)) {
      if (current) collapsed.push(current);
      current = line;
      return;
    }

    if (!current) {
      current = line;
      return;
    }

    current += line.startsWith(",") ? line : ` ${line}`;
  });

  if (current) collapsed.push(current);
  return collapsed;
}

function parseTelemetryRecord(line) {
  const parts = String(line || "").split(",").map((part) => part.trim());
  if (parts.length < 8) return null;

  const index = Number(parts[0]);
  if (!Number.isInteger(index) || index < 0) return null;

  const uuidRaw = parts[1] || "";
  const powerDrawRaw = parts[parts.length - 1] || "";
  const memoryTotalRaw = parts[parts.length - 2] || "";
  const memoryUsedRaw = parts[parts.length - 3] || "";
  const temperatureRaw = parts[parts.length - 4] || "";
  const utilizationRaw = parts[parts.length - 5] || "";
  const nameRaw = parts.slice(2, parts.length - 5).join(", ").trim();

  return {
    index,
    uuid: uuidRaw,
    name: nameRaw || `GPU ${index}`,
    utilizationPct: parseNumberOrNull(utilizationRaw),
    temperatureC: parseNumberOrNull(temperatureRaw),
    memoryUsedMiB: parseNumberOrNull(memoryUsedRaw),
    memoryTotalMiB: parseNumberOrNull(memoryTotalRaw),
    powerDrawW: parseNumberOrNull(powerDrawRaw),
    memory: memoryTotalRaw ? `${memoryTotalRaw} MiB` : "unknown",
  };
}

function parseGpuTelemetryCsv(rawValue) {
  return collapseWrappedTelemetryLines(rawValue)
    .map(parseTelemetryRecord)
    .filter(Boolean);
}

module.exports = {
  parseGpuListOutput,
  parseGpuTelemetryCsv,
  parseNumberOrNull,
};