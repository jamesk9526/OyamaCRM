// API integration tests for Steward AI user memory and context-library controls.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
const createdMemoryIds: string[] = [];
const createdContextFileIds: string[] = [];

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const admin = await loginAsAdmin(app);
  adminToken = admin.token;
});

afterAll(async () => {
  const auth = { Authorization: `Bearer ${adminToken}` };

  for (const id of createdMemoryIds) {
    await request(app).delete(`/api/steward-ai/memories/${id}`).set(auth);
  }
  for (const id of createdContextFileIds) {
    await request(app).delete(`/api/steward-ai/context-files/${id}`).set(auth);
  }
  await request(app)
    .put("/api/steward-ai/memory/preferences")
    .set(auth)
    .send({ memoryEnabled: true, fileContextEnabled: true });
});

describe("steward ai memory and context management api", () => {
  it("loads and updates per-user memory preferences", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const initial = await request(app)
      .get("/api/steward-ai/memory/preferences")
      .set(auth)
      .expect(200);

    expect(typeof initial.body?.data?.memoryEnabled).toBe("boolean");
    expect(typeof initial.body?.data?.fileContextEnabled).toBe("boolean");

    const updated = await request(app)
      .put("/api/steward-ai/memory/preferences")
      .set(auth)
      .send({ memoryEnabled: false, fileContextEnabled: true })
      .expect(200);

    expect(updated.body?.data?.memoryEnabled).toBe(false);
    expect(updated.body?.data?.fileContextEnabled).toBe(true);

    await request(app)
      .put("/api/steward-ai/memory/preferences")
      .set(auth)
      .send({ memoryEnabled: true, fileContextEnabled: true })
      .expect(200);
  });

  it("creates, lists, edits, and deletes user-scoped memories", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const unique = `Steward memory API ${Date.now()}`;

    const created = await request(app)
      .post("/api/steward-ai/memories")
      .set(auth)
      .send({
        title: unique,
        content: `${unique} prefers concise gala sponsor follow-up drafts.`,
        category: "writing_style",
        workspaceScope: "events",
      })
      .expect(201);

    const memoryId = String(created.body?.data?.id);
    createdMemoryIds.push(memoryId);
    expect(created.body?.data?.category).toBe("writing_style");
    expect(created.body?.data?.workspaceScope).toBe("events");
    expect(created.body?.data?.active).toBe(true);

    const listed = await request(app)
      .get(`/api/steward-ai/memories?q=${encodeURIComponent(unique)}`)
      .set(auth)
      .expect(200);

    expect(Array.isArray(listed.body?.data)).toBe(true);
    expect(listed.body.data.some((memory: { id: string }) => memory.id === memoryId)).toBe(true);

    const edited = await request(app)
      .put(`/api/steward-ai/memories/${memoryId}`)
      .set(auth)
      .send({ active: false, category: "preference" })
      .expect(200);

    expect(edited.body?.data?.active).toBe(false);
    expect(edited.body?.data?.category).toBe("preference");

    await request(app)
      .delete(`/api/steward-ai/memories/${memoryId}`)
      .set(auth)
      .expect(200);

    createdMemoryIds.splice(createdMemoryIds.indexOf(memoryId), 1);
  });

  it("blocks the dedicated memory tool when memory is disabled", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    await request(app)
      .put("/api/steward-ai/memory/preferences")
      .set(auth)
      .send({ memoryEnabled: false })
      .expect(200);

    const blocked = await request(app)
      .post("/api/steward-ai/memory-tool/save")
      .set(auth)
      .send({
        title: "Blocked memory tool test",
        content: "This durable fact should not be saved while memory is disabled.",
        category: "workflow",
      });

    expect(blocked.status).toBe(409);
    expect(blocked.body?.error?.code).toBe("MEMORY_DISABLED");

    const enabled = await request(app)
      .put("/api/steward-ai/memory/preferences")
      .set(auth)
      .send({ memoryEnabled: true })
      .expect(200);

    expect(enabled.body?.data?.memoryEnabled).toBe(true);
  });

  it("uploads, indexes, updates, reindexes, and deletes context-library files", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const unique = `Steward context file ${Date.now()}`;

    const created = await request(app)
      .post("/api/steward-ai/context-files")
      .set(auth)
      .send({
        fileName: `${unique}.txt`,
        displayName: unique,
        mimeType: "text/plain",
        fileType: "text",
        sizeBytes: 160,
        workspaceScope: "steward",
        description: "Context-library API test document.",
        tags: ["api-test", "steward"],
        extractedText: `${unique}\n\nThe gala follow-up workflow uses handwritten thank-yous for table hosts.`,
      })
      .expect(201);

    const fileId = String(created.body?.data?.id);
    createdContextFileIds.push(fileId);
    expect(created.body?.data?.indexingStatus).toBe("indexed");
    expect(created.body?.data?.chunkCount).toBeGreaterThan(0);

    const listed = await request(app)
      .get(`/api/steward-ai/context-files?q=${encodeURIComponent(unique)}`)
      .set(auth)
      .expect(200);

    expect(listed.body.data.some((file: { id: string }) => file.id === fileId)).toBe(true);

    const updated = await request(app)
      .put(`/api/steward-ai/context-files/${fileId}`)
      .set(auth)
      .send({ displayName: `${unique} renamed`, active: false, tags: ["renamed"] })
      .expect(200);

    expect(updated.body?.data?.displayName).toBe(`${unique} renamed`);
    expect(updated.body?.data?.active).toBe(false);
    expect(updated.body?.data?.tags).toEqual(["renamed"]);

    const reindexed = await request(app)
      .post(`/api/steward-ai/context-files/${fileId}/reindex`)
      .set(auth)
      .expect(200);

    expect(reindexed.body?.data?.indexingStatus).toBe("indexed");
    expect(reindexed.body?.data?.chunkCount).toBeGreaterThan(0);

    await request(app)
      .delete(`/api/steward-ai/context-files/${fileId}`)
      .set(auth)
      .expect(200);

    createdContextFileIds.splice(createdContextFileIds.indexOf(fileId), 1);
  });
});
