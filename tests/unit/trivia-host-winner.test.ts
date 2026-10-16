import { describe, expect, it } from "vitest";
import { getWinnerTeam } from "@/app/apps/trivia/lib/trivia-selectors";
import { createSampleTriviaEvent } from "@/app/apps/trivia/lib/trivia-sample-data";
import { createDefaultLiveState } from "@/app/apps/trivia/lib/trivia-demo-data";

describe("Trivia winner selection", () => {
  it("does not announce an arbitrary winner when active leaders are tied", () => {
    const event = createSampleTriviaEvent("winner-tie");
    event.teams.forEach((team) => { team.score = 10; team.active = true; });
    expect(getWinnerTeam(event, createDefaultLiveState(event))).toBeNull();
  });

  it("ignores inactive teams even when a previous winner id is persisted", () => {
    const event = createSampleTriviaEvent("winner-inactive");
    event.teams[0].active = false;
    const live = { ...createDefaultLiveState(event), winnerTeamId: event.teams[0].id };
    expect(getWinnerTeam(event, live)).toBeNull();
  });

  it("announces the unique active leader", () => {
    const event = createSampleTriviaEvent("winner-leader");
    event.teams.forEach((team, index) => { team.score = index; team.active = true; });
    expect(getWinnerTeam(event, createDefaultLiveState(event))?.id).toBe(event.teams.at(-1)?.id);
  });
});
