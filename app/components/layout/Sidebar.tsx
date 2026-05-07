"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    items: [
      { label: "Home", href: "/", icon: "🏠" },
      { label: "Constituents", href: "/constituents", icon: "👥" },
      { label: "Donations", href: "/donations", icon: "💰" },
      { label: "Campaigns", href: "/campaigns", icon: "📊" },
      { label: "Reports", href: "/reports", icon: "📈" },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Tasks", href: "/tasks", icon: "✓" },
      { label: "Communications", href: "/communications", icon: "✉️" },
      { label: "Events", href: "/events", icon: "📅" },
      { label: "Volunteers", href: "/volunteers", icon: "🤝" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Data Tools", href: "/data-tools", icon: "🔧" },
      { label: "Settings", href: "/settings", icon: "⚙️" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      {NAV_SECTIONS.map((section, si) => (
        <div key={si} className="py-3">
          {section.label && (
            <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {section.label}
            </p>
          )}
          <nav>
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mx-2 mb-1 flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-green-600 text-white"
                      : "text-gray-700 hover:bg-green-50 hover:text-green-700"
                  }`}
                >
                  <span className="text-base opacity-80">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
}
