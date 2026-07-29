import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createStoredZip, parseCrmBackupPackage, readStoredZip } from "@/server/src/services/crm-backup-package";

describe("portable CRM backup ZIP format", () => {
  it("round-trips stored entries without a platform ZIP dependency", () => {
    const archive = createStoredZip([
      { path: "manifest.json", content: Buffer.from('{"format":"oyama"}') },
      { path: "assets/trivia-media/org/question.mp3", content: Buffer.from([0, 1, 2, 255]) },
    ]);

    expect(readStoredZip(archive)).toEqual([
      { path: "manifest.json", content: Buffer.from('{"format":"oyama"}') },
      { path: "assets/trivia-media/org/question.mp3", content: Buffer.from([0, 1, 2, 255]) },
    ]);
  });

  it("rejects unsafe paths and corrupted content", () => {
    expect(() => createStoredZip([{ path: "../escape.txt", content: Buffer.from("no") }])).toThrow(/unsafe/i);

    const archive = createStoredZip([{ path: "manifest.json", content: Buffer.from("valid") }]);
    const corrupted = Buffer.from(archive);
    corrupted[30 + Buffer.byteLength("manifest.json")] ^= 0xff;
    expect(() => readStoredZip(corrupted)).toThrow(/checksum/i);
  });

  it("accepts only a complete, manifest-verified CRM package inventory", () => {
    const bundle = {
      backupSchemaVersion: "1",
      generatedAt: "2026-07-29T12:00:00.000Z",
      generatedBy: "user-1",
      organizationId: "org-1",
      appVersion: "1.3.0",
      sqlDump: "SELECT 1;",
      primaryDatabase: {},
    };
    const backupJson = Buffer.from(JSON.stringify(bundle));
    const sql = Buffer.from(bundle.sqlDump);
    const asset = Buffer.from("media bytes");
    const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
    const manifest = {
      format: "oyama-crm-backup-package",
      formatVersion: 1,
      packageId: "package-1",
      generatedAt: bundle.generatedAt,
      organizationId: bundle.organizationId,
      appVersion: bundle.appVersion,
      includesWatchdogDatabase: false,
      backupJsonSha256: digest(backupJson),
      backupSqlSha256: digest(sql),
      assets: [{ path: "trivia-media/org-1/clip.mp3", sizeBytes: asset.length, sha256: digest(asset) }],
    };
    const archive = createStoredZip([
      { path: "manifest.json", content: Buffer.from(JSON.stringify(manifest)) },
      { path: "backup.json", content: backupJson },
      { path: "backup.sql", content: sql },
      { path: "assets/trivia-media/org-1/clip.mp3", content: asset },
    ]);

    const parsed = parseCrmBackupPackage(archive);
    expect(parsed.bundle.organizationId).toBe("org-1");
    expect(parsed.assets).toEqual([{ relativePath: "trivia-media/org-1/clip.mp3", content: asset }]);
  });
});
