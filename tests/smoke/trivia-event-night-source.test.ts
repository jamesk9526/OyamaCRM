import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Trivia event-night controls", () => {
  it("keeps temporary remote access role-scoped, expiring, and revocable", () => {
    const route = read("server/src/routes/trivia.ts");
    const accessPanel = read("app/components/trivia/TemporaryEventAccessPanel.tsx");
    const remote = read("app/components/trivia/TriviaRemoteController.tsx");

    expect(route).toContain('publicRouter.post("/events/:eventId/claim"');
    expect(route).toContain('"INVALID_EVENT_ACCESS"');
    expect(route).toContain('router.post("/events/:eventId/access-passes"');
    expect(route).toContain('router.delete("/events/:eventId/access-passes/:passId"');
    expect(route).toContain('access.pass.role === "host"');
    expect(route).toContain('action === "check_in"');
    expect(accessPanel).toContain("Temporary sign-ins and remote controllers");
    expect(remote).toContain("Event-night sign-in");
    expect(remote).toContain('"x-trivia-access"');
  });

  it("keeps builder and projector useable for event staff", () => {
    const builder = read("app/components/trivia/RoundQuestionBuilderPanel.tsx");
    const host = read("app/apps/trivia/events/[eventId]/host/page.tsx");
    const display = read("app/apps/trivia/display/[eventId]/page.tsx");

    expect(builder).toContain("Build rounds, then add questions");
    expect(builder).toContain("QUESTION_TYPE_HELP");
    expect(builder).toContain("Save Question to");
    expect(host).toContain("Event-night connection");
    expect(host).toContain('setSyncMode("server")');
    expect(display).toContain('setSyncMode("server")');
  });
});
