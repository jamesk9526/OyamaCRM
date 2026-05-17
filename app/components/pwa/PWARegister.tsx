"use client";

import { useEffect } from "react";

/** Registers the production service worker used for installable PWA behavior. */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    const unregisterDevelopmentWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys
              .filter((key) => key.startsWith("app-shell-") || key.startsWith("runtime-") || key.includes("oyamacrm"))
              .map((key) => caches.delete(key))
          );
        }
      } catch {
        // Silent failure keeps the app usable even if cleanup fails.
      }
    };

    if (isLocalhost || process.env.NODE_ENV !== "production") {
      void unregisterDevelopmentWorkers();
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Silent failure keeps the app usable even when SW registration is blocked.
      }
    };

    void register();
  }, []);

  return null;
}
