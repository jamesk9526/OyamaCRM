import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("OyamaPASSWORD workspace source", () => {
  it("keeps only working sidebar and list controls", () => {
    const source = read("app/components/password/OyamaPasswordWorkspace.tsx");

    expect(source).not.toContain('label: "Trash"');
    expect(source).not.toContain('"Credit Cards"');
    expect(source).not.toContain('"Wi‑Fi"');
    expect(source).not.toContain('"Wi-Fi"');
    expect(source).not.toContain("aria-label=\"Notifications\"");
    expect(source).not.toContain("aria-label=\"Filter\"");
    expect(source).toContain("Working Views");
    expect(source).toContain("Save Changes");
  });

  it("documents stronger PIN guidance and shorter session posture", () => {
    const source = read("app/components/password/OyamaPasswordWorkspace.tsx");
    const service = read("server/src/services/oyama-password-store.ts");

    expect(source).toContain("Choose a 6-10 digit PIN");
    expect(source).toContain("Vault sessions now expire after 30 minutes.");
    expect(service).toContain("const PIN_MIN_LENGTH = 6;");
    expect(service).toContain("const PIN_SESSION_TTL_MS = 30 * 60 * 1000;");
    expect(service).toContain("const MAX_PIN_ATTEMPTS = 5;");
  });
});
