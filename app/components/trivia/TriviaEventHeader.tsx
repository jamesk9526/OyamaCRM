// TriviaEventHeader renders core event context metadata for trivia management pages.

import type { TriviaEvent } from "@/app/apps/trivia/lib/trivia-types";

interface TriviaEventHeaderProps {
  /** Active trivia event shown in this workspace. */
  event: TriviaEvent;
  /** Optional right-side action content for route-specific controls. */
  actions?: React.ReactNode;
}

/**
 * TriviaEventHeader provides a consistent event title and metadata strip.
 * It keeps route pages thin and avoids duplicating event context markup.
 */
export default function TriviaEventHeader({ event, actions }: TriviaEventHeaderProps) {
  return (
    <div className="border border-[#d1c7e8] bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5b3f9b]">Oyama Trivia Event</p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">{event.name}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Venue: {event.venue || "Not set"} • Host: {event.hostName || "Not set"}
          </p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
