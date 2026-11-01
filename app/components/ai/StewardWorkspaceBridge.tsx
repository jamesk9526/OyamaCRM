"use client";

import StewardChathead from "./StewardChathead";

/** Single mount point retained for contextual launchers and the shared top bar. */
export default function StewardWorkspaceBridge({ moduleKey }: { moduleKey?: string }) {
  return <StewardChathead moduleKey={moduleKey} />;
}
