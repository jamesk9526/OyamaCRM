"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { message } from "./types";
export function useCreateData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const serial = useRef(0);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    if (!path) { setLoading(false); return null; }
    setLoading(true); setError("");
    try { const result = await apiFetch<T>(path); if (!result) throw new Error("The server returned an incomplete response. Try again."); if (request === serial.current) setData(result); return result; }
    catch (error) { if (request === serial.current) setError(message(error)); return null; }
    finally { if (request === serial.current) setLoading(false); }
  }, [path]);
  useEffect(() => { const currentSerial = serial; setData(null); void reload(); return () => { currentSerial.current++; }; }, [reload]);
  return { data, error, loading, reload, setData };
}
