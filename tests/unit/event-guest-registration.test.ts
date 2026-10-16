import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import EventGuestsPage from "@/app/events/guests/page";
import NewGuestModal from "@/app/components/events/NewGuestModal";
import { apiFetch } from "@/app/lib/auth-client";

vi.mock("@/app/lib/auth-client", () => ({ apiFetch: vi.fn() }));

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (value: unknown) => { state.values[index] = value; }];
  },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ eventId: "selected-event" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));

function elements(node: ReactNode): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode), ...elements(node.props.primaryAction as ReactNode)];
}

function renderPage() {
  state.cursor = 0;
  return elements(EventGuestsPage());
}

describe("event guest registration destination", () => {
  beforeEach(() => {
    state.values = [[], [
      { id: "first-event", name: "Other event", active: true },
      { id: "selected-event", name: "Selected event", active: true },
    ], false];
    state.cursor = 0;
  });

  it.each([0, 1, 2])("keeps the selected event for Add Guest action %i", (index) => {
    const actions = renderPage().filter((element) =>
      element.props.label === "Add Guest" || element.props.children === "+ Add Guest");
    expect(actions).toHaveLength(3);
    (actions[index].props.onClick as () => void)();
    const modal = renderPage().find((element) => element.type === NewGuestModal);
    expect(modal?.props.eventId).toBe("selected-event");
  });
});

describe("Add Guest submission", () => {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  const form = {
    firstName: " Ada ", lastName: " Lovelace ", email: " ada@example.org ",
    phone: " 555-0100 ", ticketTypeId: "ticket-1", dietaryRestrictions: " Vegetarian ",
    specialNeeds: " Step-free access ", notes: " Walk-in ",
  };
  function renderModal() {
    state.cursor = 0;
    return elements(NewGuestModal({ eventId: "selected-event", onCreated, onClose }));
  }
  async function submit() {
    const node = renderModal().find((element) => element.type === "form");
    await (node?.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault: vi.fn() });
  }
  beforeEach(() => {
    vi.clearAllMocks();
    state.values = [false, null, [], "", null, { ...form }];
    state.cursor = 0;
    vi.mocked(apiFetch).mockResolvedValue({ id: "saved-guest" });
  });

  it("sends guest details and ticket to the selected event then refreshes the roster", async () => {
    await submit();
    expect(apiFetch).toHaveBeenCalledWith("/api/events/selected-event/guests", {
      method: "POST",
      body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.org", phone: "555-0100",
        ticketTypeId: "ticket-1", dietaryRestrictions: "Vegetarian", specialNeeds: "Step-free access", notes: "Walk-in" }),
    });
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it("supports walk-ins without a constituent or ticket", async () => {
    state.values[5] = { ...form, email: "", phone: "", ticketTypeId: "" };
    await submit();
    const body = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]?.body as string);
    expect(body.firstName).toBe("Ada");
    expect(body).not.toHaveProperty("constituentId");
    expect(body).not.toHaveProperty("ticketTypeId");
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it("includes the optional constituent link", async () => {
    state.values[4] = { id: "constituent-1", firstName: "Ada", lastName: "Lovelace" };
    await submit();
    expect(JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]?.body as string).constituentId).toBe("constituent-1");
  });

  it("keeps failed registrations open with an alert beside the submit button", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Unable to save guest"));
    await submit();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const footer = renderModal().find((element) => {
      const children = elements(element.props.children as ReactNode);
      return children.some((child) => child.props.role === "alert")
        && children.some((child) => child.props.type === "submit")
        && !children.some((child) => child.type === "form");
    });
    expect(footer).toBeDefined();
    expect(renderModal().find((element) => element.props.role === "alert")?.props.children).toBe("Unable to save guest");
    expect(state.values[0]).toBe(false);
    expect(state.values[5]).toEqual(form);
  });

  it("rejects blank names before calling the API", async () => {
    state.values[5] = { ...form, firstName: " " };
    await submit();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(state.values[1]).toBe("First and last name are required");
  });
});
