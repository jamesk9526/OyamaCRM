// Sample event templates for rapid end-to-end trivia flow testing.

import { createDefaultDisplaySettings, createDefaultScoringRules } from "@/app/apps/trivia/lib/trivia-demo-data";
import type { TriviaEvent } from "@/app/apps/trivia/lib/trivia-types";

/**
 * createSampleTriviaEvent returns a complete test-ready event with major round and question types.
 * This is optional starter content and is never auto-seeded into storage.
 */
export function createSampleTriviaEvent(eventId: string): TriviaEvent {
  const nowIso = new Date().toISOString();

  return {
    id: eventId,
    name: "Sample Trivia Night",
    venue: "Community Hall",
    hostName: "Trivia Host",
    startAt: nowIso,
    status: "draft",
    scoringRules: createDefaultScoringRules(),
    displaySettings: createDefaultDisplaySettings(),
    createdAt: nowIso,
    updatedAt: nowIso,
    teams: [
      {
        id: `${eventId}-team-1`,
        name: "The Brainstormers",
        players: ["Avery", "Morgan"],
        score: 0,
        bonusPoints: 0,
        active: true,
        color: "#34d399",
        icon: "brain",
        sortOrder: 0,
      },
      {
        id: `${eventId}-team-2`,
        name: "Quiztopher Crew",
        players: ["Jordan", "Taylor"],
        score: 0,
        bonusPoints: 0,
        active: true,
        color: "#38bdf8",
        icon: "bolt",
        sortOrder: 1,
      },
      {
        id: `${eventId}-team-3`,
        name: "Lightning Guesses",
        players: ["Casey", "Riley"],
        score: 0,
        bonusPoints: 0,
        active: true,
        color: "#f59e0b",
        icon: "rocket",
        sortOrder: 2,
      },
    ],
    rounds: [
      {
        id: `${eventId}-round-1`,
        title: "General Knowledge",
        description: "Classic opener",
        roundType: "normal",
        questions: [
          {
            id: `${eventId}-q-1`,
            prompt: "What is the capital of Australia?",
            options: ["Sydney", "Melbourne", "Canberra", "Perth"],
            questionType: "multiple_choice",
            scoringAnswer: "Canberra",
            audienceAnswer: "Canberra",
            acceptedAnswers: ["canberra"],
            explanation: "Canberra has been Australia's capital since 1913.",
            revealText: "Correct answer: Canberra",
            mediaUrl: "",
            points: 10,
            timeLimitSec: 30,
            hostNotes: "Watch for teams guessing Sydney.",
          },
        ],
      },
      {
        id: `${eventId}-round-2`,
        title: "Picture Round",
        description: "Identify from an image",
        roundType: "picture",
        questions: [
          {
            id: `${eventId}-q-2`,
            prompt: "Name the landmark shown in the image.",
            options: [],
            questionType: "image",
            scoringAnswer: "Eiffel Tower",
            audienceAnswer: "Eiffel Tower",
            acceptedAnswers: ["the eiffel tower", "tour eiffel"],
            explanation: "Built for the 1889 World's Fair in Paris.",
            revealText: "It is the Eiffel Tower.",
            mediaUrl: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f",
            points: 15,
            timeLimitSec: 45,
            hostNotes: "Zoom image before reveal if possible.",
          },
        ],
      },
      {
        id: `${eventId}-round-3`,
        title: "Audio Speed Round",
        description: "Fast answers from a short clip",
        roundType: "speed",
        questions: [
          {
            id: `${eventId}-q-3`,
            prompt: "Identify the song from this clip.",
            options: [],
            questionType: "audio",
            scoringAnswer: "Bohemian Rhapsody",
            audienceAnswer: "Bohemian Rhapsody by Queen",
            acceptedAnswers: ["bohemian rhapsody", "queen bohemian rhapsody"],
            explanation: "Released in 1975 on A Night at the Opera.",
            revealText: "Song: Bohemian Rhapsody by Queen",
            mediaUrl: "https://example.com/audio/bohemian-rhapsody.mp3",
            points: 20,
            timeLimitSec: 20,
            hostNotes: "Run this as quick-fire.",
          },
        ],
      },
      {
        id: `${eventId}-round-4`,
        title: "Final Wager",
        description: "Teams can wager points",
        roundType: "final_wager",
        questions: [
          {
            id: `${eventId}-q-4`,
            prompt: "Final question: Which element has atomic number 79?",
            options: [],
            questionType: "text",
            scoringAnswer: "Gold",
            audienceAnswer: "Gold",
            acceptedAnswers: ["au"],
            explanation: "Element 79 is gold, chemical symbol Au.",
            revealText: "The answer is Gold.",
            mediaUrl: "",
            points: 0,
            timeLimitSec: 60,
            hostNotes: "Collect wagers before revealing.",
          },
        ],
      },
      {
        id: `${eventId}-round-5`,
        title: "Tiebreaker",
        description: "Used only if teams tie",
        roundType: "tiebreaker",
        questions: [
          {
            id: `${eventId}-q-5`,
            prompt: "Closest wins: How many bones are in an adult human body?",
            options: [],
            questionType: "host_prompt",
            scoringAnswer: "206",
            audienceAnswer: "206",
            acceptedAnswers: ["206 bones"],
            explanation: "Adults typically have 206 bones.",
            revealText: "Tiebreaker answer: 206",
            mediaUrl: "",
            points: 5,
            timeLimitSec: 30,
            hostNotes: "Use nearest answer for tie resolution.",
          },
        ],
      },
    ],
  };
}
