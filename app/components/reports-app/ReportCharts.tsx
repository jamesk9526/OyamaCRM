// Recharts visualizations used by the report results workspace.

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint, ReportChartType } from "@/app/components/reports-app/report-types";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#06b6d4", "#64748b"];

function formatValue(value: unknown): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return String(value ?? "");
  return amount >= 1000 ? `$${Math.round(amount / 1000)}K` : `$${amount.toLocaleString()}`;
}

export function ReportTrendChart({ data, type }: { data: ChartPoint[]; type: ReportChartType }) {
  if (data.length === 0 || type === "none") {
    return (
      <div className="flex h-[17rem] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400" data-testid="reports-chart-empty">
        No live chart data returned for this report.
      </div>
    );
  }

  if (type === "donut") {
    return (
      <div className="h-[17rem]" data-testid="reports-recharts">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="54%" outerRadius="78%" paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatValue(value)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "bar" || type === "stacked-bar") {
    return (
      <div className="h-[17rem]" data-testid="reports-recharts">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatValue(value)} />
            <Tooltip formatter={(value) => formatValue(value)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="value" name="Current" fill="#2563eb" radius={[5, 5, 0, 0]} stackId={type === "stacked-bar" ? "year" : undefined} />
            {data.some((point) => point.secondaryValue !== undefined) ? (
              <Bar dataKey="secondaryValue" name="Comparison" fill="#16a34a" radius={[5, 5, 0, 0]} stackId={type === "stacked-bar" ? "year" : undefined} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-[17rem]" data-testid="reports-recharts">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatValue(value)} />
          <Tooltip formatter={(value) => formatValue(value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="value" name="Giving" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
          {data.some((point) => point.secondaryValue !== undefined) ? (
            <Line type="monotone" dataKey="secondaryValue" name="Comparison" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportDonutSummary({ data }: { data: ChartPoint[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="h-[13rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="54%" outerRadius="78%" paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatValue(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.slice(0, 5).map((point, index) => (
          <div key={point.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
              <span className="truncate">{point.label}</span>
            </span>
            <span className="font-semibold text-slate-800">{formatValue(point.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
