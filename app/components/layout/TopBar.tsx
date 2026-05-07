export default function TopBar() {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-10">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-md bg-green-600 flex items-center justify-center text-white font-bold text-sm select-none">
          O
        </span>
        <span className="font-semibold text-gray-900 text-base tracking-tight">
          Oyama CRM
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">
          + New
        </button>
        <button className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-base">
          🔔
        </button>
        <button className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold hover:bg-green-200 transition-colors">
          JD
        </button>
      </div>
    </header>
  );
}
