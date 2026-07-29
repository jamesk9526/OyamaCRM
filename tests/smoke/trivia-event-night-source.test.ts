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

  it("keeps visual game planning and supported uploaded question media available", () => {
    const route = read("server/src/routes/trivia.ts");
    const builder = read("app/components/trivia/RoundQuestionBuilderPanel.tsx");
    const map = read("app/components/trivia/TriviaGameMap.tsx");
    const projector = read("app/components/trivia/ProjectorDisplayView.tsx");

    expect(route).toContain('router.post("/media"');
    expect(route).toContain("TRIVIA_MEDIA_TYPES");
    expect(builder).toContain("/api/apps/trivia/media");
    expect(builder).toContain("Upload file");
    expect(map).toContain("Visual game map");
    expect(projector).toContain('question.questionType === "video"');
    expect(projector).toContain('question.questionType === "audio"');
  });

  it("provides reusable game-wide templates before question authoring", () => {
    const types = read("app/apps/trivia/lib/trivia-types.ts");
    const state = read("app/apps/trivia/hooks/useTriviaModuleState.ts");
    const library = read("app/components/trivia/TriviaGameTemplateLibrary.tsx");
    const builder = read("app/apps/trivia/events/[eventId]/builder/page.tsx");

    expect(types).toContain("TriviaGameTemplate");
    expect(state).toContain("function applyGameTemplate");
    expect(state).toContain("without deleting authored rounds or questions");
    expect(library).toContain("Game-wide rules");
    expect(library).toContain("Apply game plan");
    expect(builder).toContain("TriviaGameTemplateLibrary");
  });

  it("backs every Trivia operations and display navigation link with a route", () => {
    const shell = read("app/components/trivia/TriviaOpsShell.tsx");
    const projector = read("app/components/trivia/ProjectorDisplayView.tsx");
    const paths = [
      "app/apps/trivia/events/[eventId]/overview/page.tsx",
      "app/apps/trivia/events/[eventId]/check-in/page.tsx",
      "app/apps/trivia/events/[eventId]/judge/page.tsx",
      "app/apps/trivia/events/[eventId]/scoreboard/page.tsx",
      "app/apps/trivia/events/[eventId]/recovery/page.tsx",
      "app/apps/trivia/events/[eventId]/printables/page.tsx",
      "app/apps/trivia/display/[eventId]/leaderboard/page.tsx",
      "app/apps/trivia/display/[eventId]/check-in/page.tsx",
    ];
    paths.forEach((path) => expect(read(path).length).toBeGreaterThan(120));
    expect(shell).toContain('label: "Recovery"');
    expect(shell).toContain('label: "Check-In Display"');
    expect(projector).toContain('live.stage === "check_in_open"');
  });
});
