/**
 * BoardShell — simplified shell for report_viewer (board member) accounts.
 * Shows only branding, org name, and the board-only dashboard.
 * No sidebar, no constituent/donation navigation — reports & metrics only.
 */
"use client";

import { useAuth } from "@/app/components/auth/AuthProvider";

/**
 * BoardShell wraps all board-member pages with a stripped header
 * and a single-column layout with no sidebar navigation.
 * Provides logout access and shows the user's name + role badge.
 */
export default function BoardShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    window.location.assign("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar — minimal branding + logout */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo / brand mark */}
          <div className="w-7 h-7 rounded-md bg-green-600 flex items-center justify-center text-white font-bold text-sm select-none">
            O
          </div>
          <span className="text-sm font-semibold text-gray-900">OyamaCRM v1.3</span>
          {/* Board-only badge */}
          <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
            Board View
          </span>
        </div>

        {/* Right side: user info + logout */}
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.firstName} {user.lastName}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              Report Viewer
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Main content — full width, no sidebar */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
