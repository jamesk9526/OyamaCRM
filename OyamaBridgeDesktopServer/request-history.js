const fs = require("node:fs");
const fields = ["id", "requestId", "timestamp", "method", "path", "statusCode", "durationMs", "model", "errorClass", "bodyBytes", "responseBytes", "cudaDeviceRequested", "cudaDeviceApplied"];
function readHistory(file) {
  try { const rows = JSON.parse(fs.readFileSync(file, "utf8")); return Array.isArray(rows) ? rows.slice(0,1000) : []; } catch { return []; }
}
function saveRequest(file, entry) {
  const safe = Object.fromEntries(fields.filter(key => typeof entry[key] === "string" || typeof entry[key] === "number").map(key => [key, typeof entry[key] === "string" ? entry[key].slice(0,300) : entry[key]]));
  safe.path = String(safe.path || "/").split("?")[0];
  const rows = [safe, ...readHistory(file).filter(row => row.id !== safe.id)].slice(0,1000);
  fs.writeFileSync(file + ".tmp", JSON.stringify(rows), "utf8"); fs.renameSync(file + ".tmp", file);
}
module.exports = {readHistory, saveRequest};
