import { describe, expect, it } from "vitest";
import { buildDesignationChart } from "@/app/features/donor-dashboard/calculations/dashboard-chart-data";

describe("donor designation chart", () => {
  it("keeps the complete denominator and remainder instead of presenting only the top funds as the whole", () => {
    const chart = buildDesignationChart([100, 80, 60, 40, 20, 10].map((amount, i) => ({ name: `Fund ${i}`, amount })));
    expect(chart.total).toBe(310);
    expect(chart.rows.at(-1)).toMatchObject({ name: "Other funds", amount: 30 });
    expect(chart.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(chart.total);
    expect(chart.rows.reduce((sum, row) => sum + row.percentage, 0)).toBeCloseTo(100);
  });
  it("combines matching funds, normalizes unassigned names, and handles empty data", () => {
    const chart = buildDesignationChart([{ name: "Care", amount: 50 }, { name: "Care", amount: 25 }, { name: " ", amount: 25 }]);
    expect(chart.rows).toEqual([{ name: "Care", amount: 75, percentage: 75 }, { name: "Unassigned", amount: 25, percentage: 25 }]);
    expect(buildDesignationChart([])).toEqual({ total: 0, rows: [] });
  });
  it("aggregates decimal gifts in cents", () => {
    const chart = buildDesignationChart([{ name: "Care", amount: .1 }, { name: "Care", amount: .2 }]);
    expect(chart.total).toBe(.3);
    expect(chart.rows[0]).toEqual({ name: "Care", amount: .3, percentage: 100 });
  });
});
