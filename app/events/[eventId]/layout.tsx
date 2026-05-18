// Event-scoped layout inherits the dedicated Events studio chrome from /events/layout.

/** EventWorkspaceLayout intentionally avoids adding a second CRM-style context bar. */
export default function EventWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
