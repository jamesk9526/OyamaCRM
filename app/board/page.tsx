/**
 * Board dashboard page — accessible only to report_viewer (board member) accounts.
 * Shows high-level fundraising metrics, giving trends, and key reports.
 * Wraps in BoardShell (no sidebar, stripped navigation).
 */
import BoardShell from "@/app/components/layout/BoardShell";
import BoardDashboard from "@/app/components/board/BoardDashboard";

/** Route: /board — board member reporting dashboard. */
export default function BoardPage() {
  return (
    <BoardShell>
      <BoardDashboard />
    </BoardShell>
  );
}
