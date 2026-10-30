"use client";

import { useEffect, useState } from "react";

/** Only typed search text waits; pagination, filters and explicit refresh remain immediate. */
export function useDebouncedValue(value: string, delay = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), value ? delay : 0);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
