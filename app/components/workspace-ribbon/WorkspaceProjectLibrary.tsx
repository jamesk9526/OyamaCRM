/** Reusable project-library card grid used as the obvious start path for workspaces. */
import Link from "next/link";

interface WorkspaceProjectLibraryItem {
  id: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
}

interface WorkspaceProjectLibraryProps {
  heading: string;
  helper: string;
  items: WorkspaceProjectLibraryItem[];
}

/**
 * Renders a project manager style library surface for first-step navigation.
 */
export default function WorkspaceProjectLibrary({ heading, helper, items }: WorkspaceProjectLibraryProps) {
  return (
    <section className="space-y-3 rounded-md border border-emerald-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{heading}</h2>
        <p className="mt-1 text-xs text-gray-500">{helper}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="rounded-md border border-emerald-100 bg-white px-3 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              {item.badge ? (
                <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-gray-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
