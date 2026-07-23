// Settings page for distributing the OyamaCRM desktop installer to staff users.
import Link from "next/link";

const DESKTOP_INSTALLER_URL = "https://oyamacrm.com/downloads/OyamaCRM-Desktop-Setup-1.0.0.exe";

/**
 * DesktopAppSettingsPage exposes a one-click installer download link in Settings.
 */
export default function DesktopAppSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Desktop App</h1>
        <p className="mt-1 text-sm text-gray-500">
          Download and install the OyamaCRM v1.3 desktop shell for Windows.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Windows Installer</h2>
        <p className="text-sm text-gray-600">
          Use the one-click installer to deploy the desktop app on staff workstations.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={DESKTOP_INSTALLER_URL}
            className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Desktop Installer (.exe)
          </a>
          <Link
            href={DESKTOP_INSTALLER_URL}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
            target="_blank"
          >
            Copy installer URL
          </Link>
        </div>

        <p className="text-xs text-gray-500 break-all">{DESKTOP_INSTALLER_URL}</p>
      </section>
    </div>
  );
}
