import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { cleanQrSlug, parseQrDestination, qrDeviceType, qrReferrer } from "@/server/src/routes/qr-codes";

describe("trackable QR code contracts", () => {
  it("accepts safe redirect destinations and rejects non-web schemes", () => {
    expect(parseQrDestination("https://example.org/donate?campaign=fall")).toBe("https://example.org/donate?campaign=fall");
    expect(parseQrDestination("http://localhost:3000/form")).toBe("http://localhost:3000/form");
    expect(parseQrDestination("javascript:alert(1)")).toBeNull();
    expect(parseQrDestination("not a url")).toBeNull();
  });

  it("normalizes aliases and blocks malformed short-link paths", () => {
    expect(cleanQrSlug(" Fall-Appeal ")).toBe("fall-appeal");
    expect(cleanQrSlug("ab")).toBeNull();
    expect(cleanQrSlug("bad_alias")).toBeNull();
    expect(cleanQrSlug("-leading-dash")).toBeNull();
  });

  it("reduces device and referrer telemetry", () => {
    expect(qrDeviceType("Mozilla/5.0 (iPhone; Mobile)")).toBe("mobile");
    expect(qrDeviceType("Mozilla/5.0 (iPad; Tablet)")).toBe("tablet");
    expect(qrDeviceType("Googlebot/2.1")).toBe("bot");
    expect(qrReferrer("https://social.example/post/42?private=value")).toBe("https://social.example");
    expect(qrReferrer("invalid")).toBeNull();
  });

  it("encodes the durable redirect URL as a downloadable PNG data URL", async () => {
    const image = await QRCode.toDataURL("https://crm.example/api/qr-codes/public/fall-appeal", { errorCorrectionLevel: "H" });
    expect(image.startsWith("data:image/png;base64,")).toBe(true);
    expect(image.length).toBeGreaterThan(500);
  });
});
