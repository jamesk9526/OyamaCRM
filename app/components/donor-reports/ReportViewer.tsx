// Full-page report viewer — workspace ribbon, multiple chart types, on-the-fly customization
"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ComposedChart,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from "recharts";
import { type DonorReportDefinition } from "@/app/components/donor-reports/donor-report-catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartType = "bar" | "line" | "area" | "pie" | "donut" | "composed" | "scatter";
type PanelView = "dashboard" | "table" | "print";
type SortDir = "asc" | "desc";

interface ReportViewerProps {
  report: DonorReportDefinition;
  data: unknown;
  year: number;
  onClose?: () => void;
}

interface ChartConfig {
  type: ChartType;
  xKey: string;
  yKeys: string[];
  colorTheme: "green" | "blue" | "purple" | "orange" | "rainbow";
  showGrid: boolean;
  showLegend: boolean;
  showLabels: boolean;
  height: "sm" | "md" | "lg";
  stacked: boolean;
}

// ─── Color themes ─────────────────────────────────────────────────────────────

const THEMES: Record<string, string[]> = {
  green:   ["#16a34a", "#4ade80", "#15803d", "#86efac", "#166534", "#bbf7d0"],
  blue:    ["#2563eb", "#60a5fa", "#1d4ed8", "#93c5fd", "#1e3a8a", "#bfdbfe"],
  purple:  ["#7c3aed", "#a78bfa", "#6d28d9", "#c4b5fd", "#4c1d95", "#e9d5ff"],
  orange:  ["#ea580c", "#fb923c", "#c2410c", "#fdba74", "#7c2d12", "#fed7aa"],
  rainbow: ["#16a34a", "#2563eb", "#dc2626", "#ea580c", "#8b5cf6", "#0891b2", "#db2777", "#ca8a04"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function isCurrencyKey(k: string) {
  const lk = k.toLowerCase();
  return lk.includes("amount") || lk.includes("raised") || lk.includes("total") || lk.includes("giving") || lk.includes("goal");
}

function fmtCell(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key.toLowerCase() === "month" && typeof value === "number") return MONTHS[(value as number) - 1] ?? String(value);
  if (isCurrencyKey(key) && typeof value === "number") {
    return "$" + (value as number).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return (value as number).toLocaleString();
  return String(value);
}

function fmtTooltipVal(key: string, value: unknown): string {
  if (typeof value !== "number") return String(value ?? "—");
  return isCurrencyKey(key)
    ? "$" + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value.toLocaleString();
}

function labelForKey(k: string): string {
  return k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
}

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => { const v = String(row[h] ?? ""); return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v; }).join(",")
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: unknown; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg text-xs">
      {label && <p className="mb-1.5 font-semibold text-slate-700">{label}</p>}
      {payload.map(p => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{labelForKey(p.name)}:</span>
          <span className="font-semibold text-slate-900">{fmtTooltipVal(p.name, p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCards({ data, numericKeys, colors }: { data: Record<string, unknown>[]; numericKeys: string[]; colors: string[] }) {
  if (!data.length || !numericKeys.length) return null;
  const stats = numericKeys.map((k, i) => {
    const vals = data.map(r => typeof r[k] === "number" ? r[k] as number : 0);
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = total / vals.length;
    const max = Math.max(...vals);
    return { key: k, total, avg, max, color: colors[i % colors.length] };
  });
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map(s => (
        <div key={s.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">{labelForKey(s.key)}</p>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{fmtCell(s.key, s.total)}</p>
          <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
            <span>Avg: <b className="text-slate-700">{fmtCell(s.key, Math.round(s.avg))}</b></span>
            <span>Max: <b className="text-slate-700">{fmtCell(s.key, s.max)}</b></span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Chart renderer ───────────────────────────────────────────────────────────

const HEIGHT_MAP = { sm: 260, md: 380, lg: 500 };

function ReportChart({ chartData, cfg }: { chartData: Record<string, unknown>[]; cfg: ChartConfig }) {
  const colors = THEMES[cfg.colorTheme] ?? THEMES.green;
  const h = HEIGHT_MAP[cfg.height];
  const { xKey, yKeys, showGrid, showLegend, showLabels, stacked } = cfg;

  if (!chartData.length || !yKeys.length) {
    return <p className="py-16 text-center text-slate-400">Select at least one metric (Y axis) from the ribbon above.</p>;
  }

  const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /> : null;
  const legend = showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null;
  const tooltip = <Tooltip content={<CustomTooltip />} />;
  const xAxis = <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />;
  const yAxis = (
    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
      tickFormatter={v => isCurrencyKey(yKeys[0] ?? "") ? "$" + (v as number).toLocaleString() : String(v)} />
  );

  if (cfg.type === "pie" || cfg.type === "donut") {
    const pieData = yKeys.flatMap(k =>
      chartData.map(r => ({
        name: `${fmtCell(xKey, r[xKey])}${yKeys.length > 1 ? ` (${labelForKey(k)})` : ""}`,
        value: typeof r[k] === "number" ? r[k] as number : 0,
      }))
    ).filter(d => d.value > 0);
    const inner = cfg.type === "donut" ? "55%" : 0;
    return (
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={inner} outerRadius="72%"
              dataKey="value" nameKey="name" paddingAngle={2}
              label={showLabels ? ({ percent }) => `${(percent! * 100).toFixed(0)}%` : false}
              labelLine={showLabels}>
              {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [fmtCell(yKeys[0] ?? "", v), name]} />
            {legend}
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (cfg.type === "scatter") {
    return (
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            {grid}{tooltip}{legend}
            <XAxis dataKey={xKey} name={labelForKey(xKey)} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis dataKey={yKeys[0]} name={labelForKey(yKeys[0] ?? "")} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <ZAxis range={[40, 120]} />
            <Scatter data={chartData} fill={colors[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (cfg.type === "composed") {
    return (
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            {grid}{xAxis}{yAxis}{tooltip}{legend}
            {yKeys.map((k, i) =>
              i === 0
                ? <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[4,4,0,0]} barSize={22}>
                    {showLabels && <LabelList dataKey={k} position="top" style={{ fontSize: 10, fill: "#64748b" }} formatter={(v: unknown) => fmtCell(k, v)} />}
                  </Bar>
                : <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (cfg.type === "area") {
    return (
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            {grid}{xAxis}{yAxis}{tooltip}{legend}
            {yKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]}
                fill={colors[i % colors.length]} fillOpacity={0.12} strokeWidth={2}
                stackId={stacked ? "s" : undefined} dot={false}>
                {showLabels && <LabelList dataKey={k} position="top" style={{ fontSize: 10, fill: "#64748b" }} formatter={(v: unknown) => fmtCell(k, v)} />}
              </Area>
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (cfg.type === "line") {
    return (
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            {grid}{xAxis}{yAxis}{tooltip}{legend}
            {yKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2.5}
                dot={{ fill: colors[i % colors.length], r: 3 }} activeDot={{ r: 5 }}>
                {showLabels && <LabelList dataKey={k} position="top" style={{ fontSize: 10, fill: "#64748b" }} formatter={(v: unknown) => fmtCell(k, v)} />}
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // default: bar
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={4}>
          {grid}{xAxis}{yAxis}{tooltip}{legend}
          {yKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[5,5,0,0]}
              stackId={stacked ? "s" : undefined} barSize={yKeys.length > 2 ? 14 : 22}>
              {showLabels && <LabelList dataKey={k} position="top" style={{ fontSize: 10, fill: "#64748b" }} formatter={(v: unknown) => fmtCell(k, v)} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Ribbon helpers ───────────────────────────────────────────────────────────

function RibbonBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? "border-green-600 bg-green-600 text-white shadow-sm"
          : "border-emerald-100 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
      }`}>
      {children}
    </button>
  );
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-fit flex-col gap-1 border-r border-emerald-100 px-2 pb-0.5 last:border-r-0">
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      <p className="text-center text-[9px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function RibbonDivider() {
  return null;
}

// ─── Mini table (dashboard preview) ──────────────────────────────────────────

function MiniTable({ rows, keys }: { rows: Record<string, unknown>[]; keys: string[] }) {
  if (!rows.length) return <p className="py-8 text-center text-xs text-slate-400">No data</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-slate-100 bg-slate-50">
          {keys.map(k => (
            <th key={k} className="whitespace-nowrap py-2.5 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {labelForKey(k)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50/60 ${i % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
            {keys.map(k => (
              <td key={k} className="whitespace-nowrap py-2 px-4 text-slate-700">{fmtCell(k, row[k])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Print table ──────────────────────────────────────────────────────────────

function PrintTable({ rows, keys }: { rows: Record<string, unknown>[]; keys: string[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-slate-100">
          {keys.map(k => (
            <th key={k} className="border border-slate-200 p-2 text-left font-semibold text-slate-800">{labelForKey(k)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 150).map((row, i) => (
          <tr key={i} className={i % 2 !== 0 ? "bg-slate-50" : ""}>
            {keys.map(k => (
              <td key={k} className="border border-slate-200 p-2 text-slate-700">{fmtCell(k, row[k])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportViewer({ report, data, year, onClose }: ReportViewerProps) {
  const [panel, setPanel] = useState<PanelView>("dashboard");
  const [reportTitle, setReportTitle] = useState(report.title);
  const [reportNotes, setReportNotes] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);

  // Normalise rows
  const rows = useMemo<Record<string, unknown>[]>(() => {
    if (!Array.isArray(data)) return [];
    return data as Record<string, unknown>[];
  }, [data]);

  // Flat KPI data (non-array response)
  const kpiData = useMemo<Record<string, unknown> | null>(() => {
    if (Array.isArray(data)) return null;
    if (typeof data === "object" && data !== null) return data as Record<string, unknown>;
    return null;
  }, [data]);

  const allKeys = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).filter(k => k !== "id");
  }, [rows]);

  const numericKeys = useMemo(() => allKeys.filter(k => typeof rows[0]?.[k] === "number"), [allKeys, rows]);
  const stringKeys = useMemo(() => allKeys.filter(k => typeof rows[0]?.[k] !== "number"), [allKeys, rows]);

  const defaultXKey = useMemo(() => {
    return stringKeys.find(k => k.toLowerCase().includes("name") || k.toLowerCase().includes("first"))
      || stringKeys.find(k => k.toLowerCase() === "month")
      || stringKeys[0] || allKeys[0] || "";
  }, [stringKeys, allKeys]);

  const defaultYKeys = useMemo(() => {
    const preferred = numericKeys.filter(k => isCurrencyKey(k));
    return (preferred.length ? preferred : numericKeys).slice(0, 2);
  }, [numericKeys]);

  const [cfg, setCfg] = useState<ChartConfig>(() => ({
    type: "bar",
    xKey: defaultXKey,
    yKeys: defaultYKeys,
    colorTheme: "green",
    showGrid: true,
    showLegend: true,
    showLabels: false,
    height: "md",
    stacked: false,
  }));

  // Table state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rowLimit, setRowLimit] = useState<number>(100);
  const [filterText, setFilterText] = useState("");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => new Set(allKeys));

  const sortedRows = useMemo(() => {
    let r = [...rows];
    if (filterText) {
      const q = filterText.toLowerCase();
      r = r.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
    }
    if (sortKey) {
      r.sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey];
        const cmp = typeof av === "number" && typeof bv === "number"
          ? (av as number) - (bv as number)
          : String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return r.slice(0, rowLimit);
  }, [rows, sortKey, sortDir, rowLimit, filterText]);

  function toggleYKey(k: string) {
    setCfg(c => ({
      ...c,
      yKeys: c.yKeys.includes(k) ? c.yKeys.filter(y => y !== k) : [...c.yKeys, k],
    }));
  }

  function toggleCol(k: string) {
    setVisibleCols(s => {
      const n = new Set(s);
      if (n.has(k)) {
        n.delete(k);
      } else {
        n.add(k);
      }
      return n;
    });
  }

  function handleSort(k: string) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  const colors = THEMES[cfg.colorTheme] ?? THEMES.green;
  const isArrayData = rows.length > 0;
  const visibleColsList = allKeys.filter(k => visibleCols.has(k));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">

      {/* ── Title bar ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-100 px-5 py-3 shadow-sm">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input autoFocus
              className="w-full rounded border border-green-400 bg-slate-50 px-2 py-1 text-lg font-bold text-slate-900 outline-none"
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
            />
          ) : (
            <button type="button" className="group flex items-center gap-2 text-left" onClick={() => setEditingTitle(true)} title="Click to edit title">
              <h1 className="text-lg font-bold text-slate-900">{reportTitle}</h1>
              <svg className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
              </svg>
            </button>
          )}
          <p className="text-xs text-slate-500 mt-0.5">{report.category} · {year} · {isArrayData ? `${rows.length} records` : "Summary"}</p>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-md border border-emerald-200 bg-white/75 p-0.5">
          {(["dashboard","table","print"] as PanelView[]).map(v => (
            <button key={v} onClick={() => setPanel(v)}
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition capitalize ${panel === v ? "bg-green-600 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-emerald-800"}`}>
              {v === "dashboard" ? "Dashboard" : v === "table" ? "Data Table" : "Print Preview"}
            </button>
          ))}
        </div>

        <button onClick={onClose}
          className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Workspace ribbon ──────────────────────────────────────────────── */}
      {(panel === "dashboard" || panel === "table") && isArrayData && (
        <div className="shrink-0 overflow-x-auto border-b border-emerald-200 bg-gradient-to-b from-white to-emerald-50/45 px-3 py-2">
          <div className="flex min-w-max items-stretch gap-0">

            {panel === "dashboard" && (
              <>
                <RibbonGroup label="Chart Type">
                  {(["bar","line","area","pie","donut","composed","scatter"] as ChartType[]).map(t => (
                    <RibbonBtn key={t} active={cfg.type === t} onClick={() => setCfg(c => ({ ...c, type: t }))}>
                      {t === "bar" && <><RBarIcon />Bar</>}
                      {t === "line" && <><RLineIcon />Line</>}
                      {t === "area" && <><RAreaIcon />Area</>}
                      {t === "pie" && <><RPieIcon />Pie</>}
                      {t === "donut" && <><RDonutIcon />Donut</>}
                      {t === "composed" && <><RComposedIcon />Bar+Line</>}
                      {t === "scatter" && <><RScatterIcon />Scatter</>}
                    </RibbonBtn>
                  ))}
                </RibbonGroup>
                <RibbonDivider />

                <RibbonGroup label="X Axis">
                  <select value={cfg.xKey} onChange={e => setCfg(c => ({ ...c, xKey: e.target.value }))}
                    className="h-9 rounded-sm border border-emerald-100 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-green-400">
                    {allKeys.map(k => <option key={k} value={k}>{labelForKey(k)}</option>)}
                  </select>
                </RibbonGroup>
                <RibbonDivider />

                <RibbonGroup label="Metrics (Y)">
                  {numericKeys.map((k) => (
                    <RibbonBtn key={k} active={cfg.yKeys.includes(k)} onClick={() => toggleYKey(k)}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cfg.yKeys.includes(k) ? colors[cfg.yKeys.indexOf(k) % colors.length] : "#cbd5e1" }} />
                      {labelForKey(k)}
                    </RibbonBtn>
                  ))}
                </RibbonGroup>
                <RibbonDivider />

                <RibbonGroup label="Style">
                  <RibbonBtn active={cfg.showGrid} onClick={() => setCfg(c => ({ ...c, showGrid: !c.showGrid }))}>
                    <RGridIcon />Grid
                  </RibbonBtn>
                  <RibbonBtn active={cfg.showLegend} onClick={() => setCfg(c => ({ ...c, showLegend: !c.showLegend }))}>
                    <RLegendIcon />Legend
                  </RibbonBtn>
                  <RibbonBtn active={cfg.showLabels} onClick={() => setCfg(c => ({ ...c, showLabels: !c.showLabels }))}>
                    <RLabelIcon />Labels
                  </RibbonBtn>
                  <RibbonBtn active={cfg.stacked} onClick={() => setCfg(c => ({ ...c, stacked: !c.stacked }))}>
                    <RStackIcon />Stack
                  </RibbonBtn>
                </RibbonGroup>
                <RibbonDivider />

                <RibbonGroup label="Theme">
                  {(["green","blue","purple","orange","rainbow"] as const).map(th => (
                    <button key={th} type="button" title={th}
                      onClick={() => setCfg(c => ({ ...c, colorTheme: th }))}
                      className={`relative h-8 w-8 overflow-hidden rounded-sm border-2 transition ${cfg.colorTheme === th ? "border-green-700 scale-105" : "border-emerald-100 hover:border-emerald-300"}`}>
                      <span className="absolute inset-0 flex">
                        {THEMES[th].slice(0, 4).map((col, i) => (
                          <span key={i} className="flex-1 h-full" style={{ background: col }} />
                        ))}
                      </span>
                    </button>
                  ))}
                </RibbonGroup>
                <RibbonDivider />

                <RibbonGroup label="Chart Size">
                  {(["sm","md","lg"] as const).map(s => (
                    <RibbonBtn key={s} active={cfg.height === s} onClick={() => setCfg(c => ({ ...c, height: s }))}>
                      {s === "sm" ? "Compact" : s === "md" ? "Normal" : "Tall"}
                    </RibbonBtn>
                  ))}
                </RibbonGroup>
              </>
            )}

            {panel === "table" && (
              <>
                <RibbonGroup label="Columns">
                  {allKeys.map(k => (
                    <RibbonBtn key={k} active={visibleCols.has(k)} onClick={() => toggleCol(k)}>
                      {labelForKey(k)}
                    </RibbonBtn>
                  ))}
                </RibbonGroup>
                <RibbonDivider />
                <RibbonGroup label="Row Limit">
                  {[25, 50, 100, 250, 999].map(n => (
                    <RibbonBtn key={n} active={rowLimit === n} onClick={() => setRowLimit(n)}>
                      {n === 999 ? "All" : String(n)}
                    </RibbonBtn>
                  ))}
                </RibbonGroup>
              </>
            )}

            <RibbonDivider />
            <RibbonGroup label="Export">
              <RibbonBtn onClick={() => downloadCsv(rows, `${report.id}-${year}.csv`)}>
                <RDownloadIcon />CSV
              </RibbonBtn>
              <RibbonBtn onClick={() => window.print()}>
                <RPrintIcon />Print / PDF
              </RibbonBtn>
            </RibbonGroup>
          </div>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto p-5">

        {/* Dashboard */}
        {panel === "dashboard" && (
          <div className="space-y-5 mx-auto max-w-7xl">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold text-slate-500">Report Notes</p>
              <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)}
                placeholder="Add executive summary, context, or observations…"
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-400 focus:bg-white placeholder:text-slate-400" />
            </div>

            {isArrayData && cfg.yKeys.length > 0 && (
              <KpiCards data={rows} numericKeys={cfg.yKeys} colors={colors} />
            )}

            {kpiData && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(kpiData)
                  .filter(([, v]) => typeof v !== "object" || v === null)
                  .map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{labelForKey(k)}</p>
                      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{fmtCell(k, v)}</p>
                    </div>
                  ))}
              </div>
            )}

            {isArrayData && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{reportTitle}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {cfg.type.charAt(0).toUpperCase() + cfg.type.slice(1)} chart
                      {cfg.yKeys.length > 0 ? ` · ${cfg.yKeys.map(labelForKey).join(", ")}` : ""}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {rows.length} records
                  </span>
                </div>
                <ReportChart chartData={rows.slice(0, 100)} cfg={cfg} />
              </div>
            )}

            {isArrayData && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">Data Preview</h2>
                  <span className="text-xs text-slate-400">First 10 rows — switch to Data Table for full view</span>
                </div>
                <div className="overflow-x-auto">
                  <MiniTable rows={rows.slice(0, 10)} keys={allKeys.slice(0, 8)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Table */}
        {panel === "table" && (
          <div className="mx-auto max-w-full space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input value={filterText} onChange={e => setFilterText(e.target.value)}
                placeholder="Filter rows…"
                className="h-9 w-72 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-green-400" />
              <span className="text-xs text-slate-500">
                {sortedRows.length} of {rows.length} rows{filterText ? " (filtered)" : ""}
              </span>
              <button onClick={() => downloadCsv(rows, `${report.id}-${year}.csv`)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-green-600 bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                <RDownloadIcon />Export CSV ({rows.length} rows)
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {visibleColsList.map(k => (
                        <th key={k} onClick={() => handleSort(k)}
                          className="cursor-pointer select-none whitespace-nowrap py-3 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800">
                          <span className="flex items-center gap-1">
                            {labelForKey(k)}
                            {sortKey === k && <span className="text-green-600">{sortDir === "asc" ? "↑" : "↓"}</span>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => (
                      <tr key={i} className={`border-b border-slate-100 hover:bg-green-50/30 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                        {visibleColsList.map(k => (
                          <td key={k} className="whitespace-nowrap py-2 px-4 text-slate-700">{fmtCell(k, row[k])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedRows.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">No rows match the filter.</p>
              )}
            </div>
          </div>
        )}

        {/* Print Preview */}
        {panel === "print" && (
          <div className="mx-auto max-w-4xl space-y-6 bg-white rounded-xl border border-slate-200 p-10 shadow-sm">
            <div className="border-b border-slate-200 pb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{reportTitle}</h1>
                  <p className="mt-1 text-sm text-slate-600">{report.description}</p>
                  <p className="mt-1 text-xs text-slate-400">Year: {year} · Generated {new Date().toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-500">{report.category}</p>
                  <p className="text-xs text-slate-400">{rows.length} records</p>
                </div>
              </div>
              {reportNotes && (
                <p className="mt-4 text-sm text-slate-700 italic border-l-4 border-green-400 pl-3">{reportNotes}</p>
              )}
            </div>

            {isArrayData && cfg.yKeys.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Key Metrics</h2>
                <KpiCards data={rows} numericKeys={cfg.yKeys} colors={colors} />
              </div>
            )}

            {isArrayData && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Chart</h2>
                <ReportChart chartData={rows.slice(0, 60)} cfg={{ ...cfg, height: "md" }} />
              </div>
            )}

            {isArrayData && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Data ({rows.length} records)</h2>
                <PrintTable rows={rows} keys={visibleColsList} />
              </div>
            )}

            <div className="border-t border-slate-200 pt-4 text-xs text-slate-400">
              OyamaCRM v1.3 · {reportTitle} · {year}
            </div>

            <div className="flex justify-end gap-3 print:hidden">
              <button onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                <RPrintIcon />Print / Save as PDF
              </button>
              <button onClick={() => downloadCsv(rows, `${report.id}-${year}.csv`)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <RDownloadIcon />Export CSV
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          header, nav, [role="navigation"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Ribbon icons ─────────────────────────────────────────────────────────────

function RBarIcon()      { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="8" width="3" height="7"/><rect x="6" y="5" width="3" height="10"/><rect x="11" y="2" width="3" height="13"/></svg>; }
function RLineIcon()     { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="1,13 5,7 9,10 14,3"/></svg>; }
function RAreaIcon()     { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" opacity={0.7}><path d="M1 13 L5 7 L9 10 L14 3 L14 15 L1 15 Z"/></svg>; }
function RPieIcon()      { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="8" cy="8" r="6"/><line x1="8" y1="8" x2="8" y2="2"/><line x1="8" y1="8" x2="13.2" y2="11"/></svg>; }
function RDonutIcon()    { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/></svg>; }
function RComposedIcon() { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16"><rect x="1" y="9" width="3" height="6" fill="currentColor" opacity={0.7}/><rect x="6" y="6" width="3" height="9" fill="currentColor" opacity={0.7}/><rect x="11" y="3" width="3" height="12" fill="currentColor" opacity={0.7}/><polyline points="2.5,8 7.5,5 12.5,2" fill="none" stroke="currentColor" strokeWidth={1.5}/></svg>; }
function RScatterIcon()  { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="11" r="1.5"/><circle cx="7" cy="6" r="1.5"/><circle cx="11" cy="9" r="1.5"/><circle cx="13" cy="4" r="1.5"/><circle cx="3" cy="4" r="1.5"/></svg>; }
function RGridIcon()     { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><line x1="4" y1="1" x2="4" y2="15"/><line x1="8" y1="1" x2="8" y2="15"/><line x1="12" y1="1" x2="12" y2="15"/><line x1="1" y1="4" x2="15" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="1" y1="12" x2="15" y2="12"/></svg>; }
function RLegendIcon()   { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="1" y="5" width="4" height="3" fill="currentColor" opacity={0.6}/><line x1="7" y1="6.5" x2="15" y2="6.5"/><rect x="1" y="10" width="4" height="3" fill="currentColor" opacity={0.3}/><line x1="7" y1="11.5" x2="15" y2="11.5"/></svg>; }
function RLabelIcon()    { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="4" width="12" height="8" rx="1.5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="7" y1="6" x2="7" y2="10"/></svg>; }
function RStackIcon()    { return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="10" width="4" height="5" opacity={0.9}/><rect x="2" y="5" width="4" height="5" opacity={0.5}/><rect x="7" y="8" width="4" height="7" opacity={0.9}/><rect x="7" y="3" width="4" height="5" opacity={0.5}/></svg>; }
function RDownloadIcon() { return <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>; }
function RPrintIcon()    { return <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm0 0V9"/></svg>; }
