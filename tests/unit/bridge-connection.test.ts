import { describe, expect, it } from "vitest";
import { parseDesktopBridgeConnection } from "../../server/src/steward/bridge-connection.js";
const payload = { endpoint: "https://bridge.example.invalid", apiKey: "test-key-123456", model: "qwen3.5:9b", expiresAt: new Date(Date.now() + 60000).toISOString() };
describe("desktop connection import", () => {
  it("accepts the desktop fragment handoff and exported JSON", () => {
    const token = Buffer.from(JSON.stringify(payload)).toString("base64url") + ".signature";
    expect(parseDesktopBridgeConnection(`https://crm.example.invalid/settings/ai#bridgePair=${token}`).model).toBe(payload.model);
    expect(parseDesktopBridgeConnection(JSON.stringify({payload})).apiKey).toBe(payload.apiKey);
  });
  it("rejects expired or malformed handoffs and credentials embedded in endpoints", () => {
    for (const override of [{expiresAt:"invalid"},{expiresAt:"2020-01-01"},{endpoint:"https://user:password@example.invalid"},{endpoint:"file:///private"}]) {
      expect(()=>parseDesktopBridgeConnection(JSON.stringify({...payload,...override}))).toThrow();
    }
  });
});
