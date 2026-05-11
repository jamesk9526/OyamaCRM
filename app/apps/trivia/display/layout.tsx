// Display layout removes host navigation so projector route stays audience-safe.

/**
 * TriviaDisplayLayout bypasses the host shell for projector-focused rendering.
 * This keeps the display route clean for large-screen audience use.
 */
export default function TriviaDisplayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
