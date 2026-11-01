const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function createImprovementsStore(directory, readConfig, fetchImpl = fetch) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "steward-improvements.json");
  let syncing = false;
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw new Error("Improvements log could not be read; existing reports were preserved."); } };
  const write = items => { const temp = `${file}.tmp`; fs.writeFileSync(temp, JSON.stringify(items, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); };
  function add(payload) {
    const reasons = ["helpful", "accurate", "clear", "incorrect", "missing_context", "unsafe", "slow", "format", "runtime_error", "other"];
    if (!payload || !["up", "down", "error"].includes(payload.rating) || !reasons.includes(payload.reason)) throw new Error("Choose a valid rating and reason.");
    const items = read(); if (items.length >= 5000) throw new Error("Improvements log is full. Export and archive it before adding reports.");
    const entry = { reportId: crypto.randomUUID(), createdAt: new Date().toISOString(), rating: payload.rating, reason: payload.reason, note: String(payload.note || "").slice(0, 1500), excerpt: payload.includeExcerpt === true ? String(payload.excerpt || "").slice(0, 2000) : "", model: String(readConfig().bridgeModel || "").slice(0, 120), source: "desktop", status: "pending", lastError: "" };
    items.push(entry); write(items); return entry;
  }
  async function sync() {
    if (syncing) return state(); syncing = true;
    try {
      const config = readConfig();
      if (!config.feedbackSiteUrl) throw new Error("Connect desktop feedback using the CRM site URL and a feedback token.");
      const url = new URL(config.feedbackSiteUrl || "");
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Use an HTTPS CRM URL, or localhost for development.");
      if (!config.feedbackToken) throw new Error("Connect desktop feedback using the token from the CRM improvements log.");
      const pending = read().filter(item => item.status !== "synced");
      for (const item of pending) {
        try {
          const response = await fetchImpl(new URL("/api/steward-feedback/bridge", url.origin), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${config.feedbackToken}` }, body: JSON.stringify(item), signal: AbortSignal.timeout(15000), redirect: "error" });
          if (!response.ok) throw new Error(`CRM rejected report (${response.status}). Renew the connection or retry.`);
          const receipt = await response.json(); if (receipt?.data?.saved !== true || receipt.data.reportId !== item.reportId) throw new Error("CRM did not confirm this report.");
          const latest = read(); const entry = latest.find(row => row.reportId === item.reportId); if (entry) { entry.status = "synced"; entry.lastError = ""; entry.syncedAt = new Date().toISOString(); } write(latest);
        } catch (error) {
          const latest = read(); const entry = latest.find(row => row.reportId === item.reportId); if (entry) entry.lastError = error.message || "Report sync failed."; write(latest); throw error;
        }
      }
      return state();
    } finally { syncing = false; }
  }
  function state() { const items = read(); return { file, pending: items.filter(item => item.status !== "synced").length, items: items.slice(-100).reverse(), syncing }; }
  return { add, sync, state };
}
module.exports = { createImprovementsStore };
