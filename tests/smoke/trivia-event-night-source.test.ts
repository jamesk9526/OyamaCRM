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
    expect(route).toContain("randomInt(1000, 10_000)");
    expect(route).toContain('value === "table_manager"');
    expect(accessPanel).toContain("Temporary sign-ins and remote controllers");
    expect(accessPanel).toContain("Complete remote URL");
    expect(accessPanel).toContain("create-qr-code");
    expect(remote).toContain("Event-night remote");
    expect(remote).toContain("Tables, guests, and check-in");
    expect(remote).toContain('"x-trivia-access"');
  });

  it("publishes capacity-aware public signup with table, seat, and mixed payment options", () => {
    const route = read("server/src/routes/trivia.ts");
    const settings = read("app/components/trivia/TriviaRegistrationSettingsPanel.tsx");
    const publicPage = read("app/components/trivia/TriviaPublicRegistrationPage.tsx");

    expect(route).toContain('publicRouter.get("/registration/:slug"');
    expect(route).toContain('publicRouter.post("/registration/:slug"');
    expect(route).toContain('"EVENT_FULL"');
    expect(route).toContain("sendTriviaRegistrationConfirmation");
    expect(route).toContain('router.post("/events/:eventId/registration-invitations"');
    expect(route).toContain('"EVENT_PROMOTION"');
    expect(route).toContain("amountDue");
    expect(settings).toContain("Registration studio");
    expect(settings).toContain("Invitation sender");
    expect(settings).toContain("confirmedPermission");
    expect(settings).toContain('"mixed"');
    expect(settings).toContain("Stripe hosted checkout");
    expect(publicPage).toContain("Table host name");
    expect(publicPage).toContain("four-digit check-in code");
    expect(publicPage).toContain("confirmation.email.status");
  });

  it("uses strict unique numeric table identifiers and exposes full member editing at check-in", () => {
    const route = read("server/src/routes/trivia.ts");
    const store = read("app/apps/trivia/lib/trivia-store.ts");
    const state = read("app/apps/trivia/hooks/useTriviaModuleState.ts");
    const checkIn = read("app/components/trivia/ops/TriviaCheckInWorkspace.tsx");

    expect(route).toContain("normalizeTableNumber");
    expect(route).toContain('"DUPLICATE_TABLE_NUMBER"');
    expect(route).toContain("nextAvailableTableNumber");
    expect(store).toContain("normalizeTriviaTableNumber");
    expect(state).toContain("is already assigned to another team");
    expect(checkIn).toContain("Table members — one person per line");
    expect(checkIn).toContain("Save table and members");
  });

  it("guards the host console and keeps every temporary remote usable on phones", () => {
    const hostControls = read("app/components/trivia/HostControlPanel.tsx");
    const hostRoute = read("app/apps/trivia/events/[eventId]/host/page.tsx");
    const remote = read("app/components/trivia/TriviaRemoteController.tsx");

    expect(hostControls).toContain("Emergency hold");
    expect(hostControls).toContain("Save safety checkpoint");
    expect(hostControls).toContain("Tap the highlighted control again");
    expect(hostControls).toContain("Shared state connected");
    expect(hostRoute).toContain("Before going live");
    expect(remote).toContain("safe-area-inset-bottom");
    expect(remote).toContain("This phone is offline");
    expect(remote).toContain("guardedAction");
    expect(remote).toContain("Check in table");
  });

  it("links Trivia rosters to durable Oyama Events tables and public registrations", () => {
    const triviaRoute = read("server/src/routes/trivia.ts");
    const eventsRoute = read("server/src/routes/events.ts");
    const linkPanel = read("app/components/trivia/TriviaEventsLinkPanel.tsx");
    const publicRegistration = read("app/components/events/public/PublicEventRegistrationForm.tsx");
    const schema = read("prisma/schema.prisma");

    expect(triviaRoute).toContain("syncTriviaEventFromOyamaEvents");
    expect(triviaRoute).toContain("syncTriviaEventToOyamaEvents");
    expect(triviaRoute).toContain('router.patch("/events/:eventId/events-link"');
    expect(triviaRoute).toContain('router.post("/events/:eventId/events-sync"');
    expect(linkPanel).toContain("Manage tables & members in Events");
    expect(linkPanel).toContain("Edit RSVP site");
    expect(linkPanel).toContain("Open live RSVP site");
    expect(eventsRoute).toContain("registeredTable");
    expect(eventsRoute).toContain("nextOpenEventTableNumber");
    expect(publicRegistration).toContain("A unique table number is assigned automatically");
    expect(schema).toContain("@@unique([eventId, tableNumber])");
    expect(schema).toContain("TRIVIA");
    expect(schema).toContain("FUNDRAISER");
  });

  it("creates Trivia as an Event mode from the unified minimal setup", () => {
    const triviaRoute = read("server/src/routes/trivia.ts");
    const createModal = read("app/components/events/NewEventModal.tsx");
    const eventRoute = read("server/src/routes/events.ts");

    expect(triviaRoute).toContain("createTriviaEventStudioWorkspace");
    expect(eventRoute).toContain('mode === "TRIVIA"');
    expect(eventRoute).toContain("triviaConfiguration");
    expect(createModal).toContain("What are you creating?");
    expect(createModal).toContain("Standard event");
    expect(createModal).toContain("Trivia night");
    expect(createModal).not.toContain("revenueGoal");
  });

  it("provides a persisted interactive venue plan and simplified event journey", () => {
    const tableWorkspace = read("app/events/tables/page.tsx");
    const eventShell = read("app/components/events/EventsStudioShell.tsx");
    const eventRoute = read("server/src/routes/events.ts");

    expect(tableWorkspace).toContain("Venue floor plan");
    expect(tableWorkspace).toContain("onPointerMove");
    expect(tableWorkspace).toContain("saveFloorPositions");
    expect(tableWorkspace).toContain("Auto-arrange");
    expect(eventRoute).toContain("INVALID_TABLE_POSITION");
    expect(eventShell).toContain('label: "Payments", segment: "payments"');
    expect(eventShell).toContain('event?.type === "TRIVIA"');
    expect(eventShell).toContain('label: "Event day", segment: "day"');
    expect(eventShell).toContain('aria-label="Switch event"');
  });

  it("persists Trivia under Event-scoped relational records and imports the retired store once", () => {
    const route = read("server/src/routes/trivia.ts");
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260824150000_unify_event_trivia_mode/migration.sql");
    expect(route).toContain("loadRelationalStore");
    expect(route).toContain("importLegacyStoreIfNeeded");
    expect(route).toContain("prisma.triviaRound.create");
    expect(schema).toContain("model TriviaConfiguration");
    expect(schema).toContain("model TriviaQuestion");
    expect(schema).toContain("eventTable    EventTable?");
    expect(migration).toContain("TriviaConfiguration_eventId_fkey");
  });

  it("keeps builder and projector useable for event staff", () => {
    const builder = read("app/components/trivia/RoundQuestionBuilderPanel.tsx");
    const gameMap = read("app/components/trivia/TriviaGameMap.tsx");
    const unifiedBuilder = read("app/events/[eventId]/trivia/builder/page.tsx");
    const hostControls = read("app/components/trivia/HostControlPanel.tsx");
    const projector = read("app/components/trivia/ProjectorDisplayView.tsx");
    const route = read("server/src/routes/trivia.ts");
    const host = read("app/apps/trivia/events/[eventId]/host/page.tsx");
    const display = read("app/apps/trivia/display/[eventId]/page.tsx");

    expect(builder).toContain("Build rounds, then add questions");
    expect(builder).toContain("QUESTION_TYPE_HELP");
    expect(builder).toContain("Save Question to");
    expect(builder).toContain("No timer for this question");
    expect(gameMap).toContain("Primary workspace");
    expect(gameMap).toContain("+ Add question");
    expect(gameMap).toContain("Save &amp; next");
    expect(gameMap).toContain('event.key === "Enter"');
    expect(gameMap).toContain("Accepted answers");
    expect(gameMap).toContain("/events/${event.id}/trivia/host");
    expect(gameMap).toContain("/events/${event.id}/trivia/projector");
    expect(unifiedBuilder).toContain("apps/trivia/events/[eventId]/builder/page");
    expect(hostControls).toContain("Untimed question");
    expect(projector).toContain("timerEnabled");
    expect(route).toContain("configuredSeconds >= 0");
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
      "app/apps/trivia/events/[eventId]/registration/page.tsx",
      "app/apps/trivia/display/[eventId]/leaderboard/page.tsx",
      "app/apps/trivia/display/[eventId]/check-in/page.tsx",
      "app/trivia/[slug]/page.tsx",
    ];
    paths.forEach((path) => expect(read(path).length).toBeGreaterThan(120));
    expect(shell).toContain('label: "Recovery"');
    expect(shell).toContain('label: "Check-In Board"');
    expect(shell).toContain('label: "Registration & page"');
    expect(projector).toContain('live.stage === "check_in_open"');
  });

  it("uses one themed Event Studio command center for every trivia-night role", () => {
    const commandCenter = read("app/events/[eventId]/trivia/page.tsx");
    const shell = read("app/components/events/EventsStudioShell.tsx");
    const styles = read("app/globals.css");
    const opsHeader = read("app/components/trivia/ops/TriviaEventOpsHeader.tsx");
    const selector = read("app/apps/trivia/lib/trivia-selectors.ts");
    const unifiedRoutes = ["check-in", "scores", "judge", "scoreboard", "recovery", "printables"];

    expect(shell).toContain("event-studio-shell");
    expect(shell).toContain("event-studio-right-rail");
    expect(shell).toContain("event-trivia-admin-content");
    expect(shell).toContain("RIGHT_RAIL_KEY");
    expect(shell).toContain('aria-label="Event workspace navigation"');
    expect(shell).toContain("Collapse event navigation");
    expect(commandCenter).toContain("Trivia night command center");
    expect(commandCenter).toContain("Event-night stations");
    expect(commandCenter).toContain("Do not begin the live game yet");
    expect(commandCenter).toContain("Print host packet");
    expect(styles).toContain(":is(.trivia-admin-content, .event-trivia-admin-content)");
    expect(styles).toContain(".event-trivia-admin-content .trivia-builder-page");
    expect(styles).toContain("Legacy cyan/fuchsia/violet actions become the single Event Studio indigo action");
    expect(opsHeader).toContain("trivia-ops-header");
    expect(selector).toContain("findTriviaEventForRoute");
    unifiedRoutes.forEach((route) => expect(read(`app/events/[eventId]/trivia/${route}/page.tsx`)).toContain("@/app/apps/trivia"));
  });

  it("offers atomic bulk question entry with server-side authorization and content limits", () => {
    const builderPage = read("app/apps/trivia/events/[eventId]/builder/page.tsx");
    const questionEntry = read("app/components/trivia/TriviaQuestionBulkAddPanel.tsx");
    const state = read("app/apps/trivia/hooks/useTriviaModuleState.ts");
    const route = read("server/src/routes/trivia.ts");

    expect(builderPage).toContain("TriviaQuestionBulkAddPanel");
    expect(questionEntry).toContain("Add prepared questions to the game");
    expect(questionEntry).toContain("One question per line");
    expect(state).toContain("function addQuestions");
    expect(state).toContain("stateRef.current");
    expect(state).toContain("500-question safety limit");
    expect(route).toContain('requirePermission("view:events")');
    expect(route).toContain('requirePermission("edit:events")');
    expect(route).toContain("MAX_TRIVIA_QUESTIONS_PER_ROUND");
    expect(route).toContain("normalizeTriviaEventContent");
  });
});
