// LiveCom workspace shell that hosts individual communication tools.
"use client";

import Link from "next/link";
import { useState } from "react";
import LiveComInboxTool from "@/app/components/livecom/LiveComInboxTool";

type LiveComToolKey = "inbox";

const TOOLS: Array<{
  id: LiveComToolKey;
  label: string;
  description: string;
}> = [
  {
    id: "inbox",
    label: "Inbox",
    description: "Messenger-style website conversations and staff replies.",
  },
];

/** Renders the LiveCom workspace with Inbox as a distinct first-class tool. */
export default function LiveComWorkspace() {
  const [activeTool, setActiveTool] = useState<LiveComToolKey>("inbox");

  return (
    <div className="min-w-0 space-y-4">
      <header className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">LiveCom Workspace</p>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">Website Messenger</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Manage LiveCom tools for website chat, donor follow-up, saved replies, retention, and messaging settings.
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => setActiveTool("inbox")}
              className="rounded-md bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-700"
            >
              Open Inbox
            </button>
            <Link href="/livecom/inbox" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-center text-sm font-semibold text-green-700 hover:bg-green-100">
              Inbox URL
            </Link>
            <Link href="/settings/site-embeds" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
              Widget Settings
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-900">LiveCom Inbox</p>
              <p className="mt-0.5 text-xs text-green-800">
                Open website conversations, reply to visitors, add internal notes, and link messages to donor follow-up.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTool("inbox")}
              className="min-h-10 rounded-md bg-white px-3 py-2 text-sm font-semibold text-green-700 ring-1 ring-green-200 hover:bg-green-100"
            >
              Go to Inbox
            </button>
            <Link href="/livecom/inbox" className="min-h-10 rounded-md bg-green-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-green-700">
              Open Full Inbox
            </Link>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              className={`min-w-[220px] rounded-md border px-3 py-2 text-left transition-colors ${
                activeTool === tool.id
                  ? "border-green-300 bg-white text-green-900 shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="block text-sm font-semibold">Open {tool.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{tool.description}</span>
            </button>
          ))}
        </div>
      </header>

      {activeTool === "inbox" && <LiveComInboxTool />}
    </div>
  );
}
