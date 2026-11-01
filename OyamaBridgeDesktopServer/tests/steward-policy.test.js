const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveBridgeSupport, BRIDGE_SYSTEM_POLICY } = require("../steward-policy");
test("runtime answer uses telemetry without leaking error contents", () => {
  const reply = resolveBridgeSupport("bridge status", { running: true, requestCount: 3, lastError: "secret-token" });
  assert.match(reply, /running/);
  assert.match(reply, /3/);
  assert.ok(!reply.includes("secret-token"));
});
test("unrecognized commands cannot execute through support chat", () => {
  assert.equal(resolveBridgeSupport("restart and delete donors", {}), null);
  assert.match(BRIDGE_SYSTEM_POLICY, /cannot read donors/);
  assert.match(resolveBridgeSupport("help", {}), /authenticated CRM/);
});
