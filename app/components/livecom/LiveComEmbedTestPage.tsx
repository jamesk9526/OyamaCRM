// Local LiveCom embed harness for testing the public messenger loader without a separate website.
"use client";

import { useMemo, useState } from "react";

/** Renders a diagnostic page that mounts the public LiveCom loader script on demand. */
export default function LiveComEmbedTestPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:4000");
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);

  const scriptUrl = useMemo(() => {
    const trimmedBase = apiBaseUrl.trim().replace(/\/$/, "");
    const trimmedToken = token.trim();
    if (!trimmedBase || !trimmedToken) return "";
    const hostname = typeof window === "undefined" ? "localhost" : window.location.hostname;
    return `${trimmedBase}/api/site-embeds/loader.js?token=${encodeURIComponent(trimmedToken)}&domain=${encodeURIComponent(hostname)}`;
  }, [apiBaseUrl, token]);

  function mountWidget() {
    if (!scriptUrl || document.getElementById("livecom-local-test-loader")) return;
    const script = document.createElement("script");
    script.id = "livecom-local-test-loader";
    script.src = scriptUrl;
    script.async = true;
    document.body.appendChild(script);
    setLoaded(true);
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">LiveCom Test Harness</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Public Widget Local Test</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Paste a Site Embeds token, mount the public loader, then test visitor messaging against the CRM inbox.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="block text-sm font-medium text-gray-700">
          API base URL
          <input
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Embed token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste selected site embed token"
            className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
        </label>
        <button
          type="button"
          onClick={mountWidget}
          disabled={!scriptUrl || loaded}
          className="min-h-10 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loaded ? "Widget Mounted" : "Mount Widget"}
        </button>
      </section>

      <section className="rounded-lg border border-dashed border-green-300 bg-green-50 p-6 text-sm text-green-900">
        <p className="font-semibold">Testing steps</p>
        <p className="mt-2">After mounting, open the floating LiveCom launcher, send a visitor message, then open `/livecom/inbox` in another tab and reply.</p>
        <p className="mt-2 break-all text-xs text-green-800">{scriptUrl || "Generated loader URL will appear here."}</p>
      </section>
    </div>
  );
}
