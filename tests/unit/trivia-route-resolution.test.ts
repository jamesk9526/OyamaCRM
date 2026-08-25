import { describe, expect, it } from "vitest";
import { findTriviaEventForRoute } from "@/app/apps/trivia/lib/trivia-selectors";
import type { TriviaEvent } from "@/app/apps/trivia/lib/trivia-types";

const event = {
  id: "trivia-configuration-id",
  legacyTriviaId: "legacy-trivia-id",
  linkedEventsEventId: "event-studio-id",
} as TriviaEvent;

describe("Trivia unified route resolution", () => {
  it("accepts Event Studio, canonical Trivia, and legacy ids", () => {
    expect(findTriviaEventForRoute([event], "event-studio-id")).toBe(event);
    expect(findTriviaEventForRoute([event], "trivia-configuration-id")).toBe(event);
    expect(findTriviaEventForRoute([event], "legacy-trivia-id")).toBe(event);
    expect(findTriviaEventForRoute([event], "missing-id")).toBeNull();
  });
});
