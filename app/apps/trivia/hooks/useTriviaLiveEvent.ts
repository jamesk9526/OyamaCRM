"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_TRIVIA_LIVE_STATE, TriviaLiveClient, type TriviaLiveClientState, type TriviaLiveCommand } from "../lib/trivia-live-client";

export function useTriviaLiveEvent(eventId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const clientRef = useRef<TriviaLiveClient | null>(null);
  const [result, setResult] = useState<{ eventId: string; state: TriviaLiveClientState }>({ eventId: "", state: EMPTY_TRIVIA_LIVE_STATE });

  useEffect(() => {
    if (!enabled || !eventId) return;
    const client = new TriviaLiveClient(eventId, { onChange: (state) => setResult({ eventId, state }) });
    clientRef.current = client;
    client.start();
    return () => {
      clientRef.current = null;
      client.dispose();
    };
  }, [enabled, eventId]);

  const sendCommand = useCallback((action: TriviaLiveCommand, payload?: Record<string, unknown>) => clientRef.current?.sendCommand(action, payload) ?? Promise.resolve(false), []);
  const refresh = useCallback(() => clientRef.current?.refresh() ?? Promise.resolve(), []);
  const state = enabled && result.eventId === eventId ? result.state : EMPTY_TRIVIA_LIVE_STATE;
  return { ...state, sendCommand, refresh };
}
