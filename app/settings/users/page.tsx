/**
 * Users settings page — full admin UI for managing team member accounts.
 * Renders the UserManagement component which provides list, add, edit, and password reset.
 */
import UserManagement from "@/app/components/settings/UserManagement";

/** UsersSettingsPage renders the user management interface. Admin-only. */
export default function UsersSettingsPage() {
  return (
    <div className="max-w-5xl">
      <UserManagement />
    </div>
  );
}

