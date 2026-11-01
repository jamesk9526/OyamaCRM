const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createImprovementsStore } = require("../improvements");
test("feedback survives restart and failed sync, then acknowledges the same report", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "oyama-feedback-"));
  const config = () => ({ feedbackSiteUrl: "https://crm.example.invalid", feedbackToken: "test", bridgeModel: "qwen3.5:9b" });
  let fail = true; let sent;
  const transport = async (_url, options) => { sent = JSON.parse(options.body); return { ok: !fail, status: 503, json: async () => ({ data: { saved: true, reportId: sent.reportId } }) }; };
  const store = createImprovementsStore(folder, config, transport);
  const entry = store.add({ rating: "down", reason: "incorrect", note: "Wrong answer", excerpt: "private text" });
  assert.equal(entry.excerpt, "");
  await assert.rejects(store.sync()); assert.equal(store.state().pending, 1);
  const reopened = createImprovementsStore(folder, config, transport);
  fail = false; await reopened.sync(); assert.equal(reopened.state().pending, 0);
  assert.equal(sent.reportId, entry.reportId);
  // Keep temporary test output in its isolated OS temp folder for inspection.
});
