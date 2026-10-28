"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ChartBox, Metric, SimpleTable } from "./bits";
import { ChartTooltip, series, seriesColor, tick } from "./charts";
import { hrs0, hrs1, pct1, sumNum } from "./format";
import { formatMonth } from "./month-picker";
import type { View } from "./view";

export function CapacityTab({ view }: { view: View }) {
  const monthRows = view.payload.capacity.filter((r) => r.month === view.asOf);
  const trend = view.payload.capacity.filter((r) => r.month >= view.range[0] && r.month <= view.range[1]);
  const chartMonthRows = monthRows.map((r) => ({
    ...r,
    capacity_hours: r.capacity_hours != null ? Math.round(r.capacity_hours) : 0,
    client_hours_planned: r.client_hours_planned != null ? Math.round(r.client_hours_planned) : 0,
    client_hours_actual: r.client_hours_actual != null ? Math.round(r.client_hours_actual) : 0,
  }));
  const disciplines = [...new Set(view.payload.capacity.map((r) => r.discipline))];
  const months = [...new Set(trend.map((r) => r.month))].sort();
  const lineData = months.map((month) => {
    const row: Record<string, string | number | null> = { month };
    for (const d of disciplines) {
      const val = trend.find((r) => r.month === month && r.discipline === d)?.planned_load_pct;
      row[d] = val != null ? Math.round(val) : null;
    }
    return row;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/80 bg-card/60 p-3 text-xs leading-relaxed text-muted-foreground shadow-xs">
        <strong className="text-foreground">Capacity calculation rules:</strong> Practical capacity = (weekly contracted hours × working days / 5) × (1 − internal non-client share) − booked leave.
        When a new team member joins, adding their weekly hours &amp; discipline in <code className="text-[#b5018b] bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">team_capacity.csv</code> updates this dashboard automatically.
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="Practical capacity"
          value={hrs0(sumNum(monthRows.map((r) => r.capacity_hours)))}
          tooltip="Net client delivery hours available across all team disciplines after subtracting non-client internal share and booked leave. (Source: team_capacity.csv & team_leave.csv)."
        />
        <Metric
          label="Client hours planned"
          value={hrs0(sumNum(monthRows.map((r) => r.client_hours_planned)))}
          tooltip="Total client delivery hours scheduled across open tasks for this month. (Source: Monday.com)."
        />
        <Metric
          label="Client hours actual"
          value={hrs0(sumNum(monthRows.map((r) => r.client_hours_actual)))}
          tooltip="Total billable delivery hours logged to date for this month by discipline. (Source: Everhour)."
        />
        <Metric
          label="Headroom (capacity − planned)"
          value={hrs0(sumNum(monthRows.map((r) => r.headroom_hours)))}
          tooltip="Remaining spare delivery capacity: Practical capacity − Client hours planned. Positive = bandwidth available; Negative = over-committed."
        />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <ChartBox title={`Demand vs capacity by discipline – ${view.asOf}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartMonthRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="discipline" tick={tick} interval={0} angle={-25} textAnchor="end" height={64} />
              <YAxis tick={tick} width={45} tickFormatter={(v) => `${Math.round(v)}`} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="capacity_hours" name="Capacity" fill={series.capacity} radius={[3, 3, 0, 0]} />
              <Bar dataKey="client_hours_planned" name="Planned" fill={series.planned} radius={[3, 3, 0, 0]} />
              <Bar dataKey="client_hours_actual" name="Actual" fill={series.actual} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox title={`Planned load % · ${formatMonth(view.range[0])} – ${formatMonth(view.range[1])}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart key={view.range.join(":")} data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={tick} />
              <YAxis tick={tick} width={45} unit="%" tickFormatter={(v) => `${Math.round(v)}%`} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={100} stroke="var(--destructive)" strokeDasharray="3 3" />
              {disciplines.map((d, i) => (
                <Line key={d} dataKey={d} stroke={seriesColor(i)} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>
      <div className="overflow-auto rounded-xl border border-border/80 shadow-xs bg-card">
        <SimpleTable
          rows={monthRows}
          columns={[
            {
              key: "discipline",
              label: "Discipline",
              tooltip: "Capability team discipline (e.g. SEO, Paid, Content). Team members are mapped in team_capacity.csv.",
            },
            {
              key: "gross_hours",
              label: "Gross",
              tooltip: "Total contracted work hours before leave: (weekly hours × working days in month) / 5.",
              render: (r) => hrs1(r.gross_hours),
            },
            {
              key: "leave_hours",
              label: "Leave",
              tooltip: "Booked holidays, absence, and bank holidays for the month. (Source: team_leave.csv).",
              render: (r) => hrs1(r.leave_hours),
            },
            {
              key: "capacity_hours",
              label: "Capacity",
              tooltip: "Practical client capacity: Gross hours × (1 − internal non-client share) − Leave hours.",
              render: (r) => hrs1(r.capacity_hours),
            },
            {
              key: "client_hours_planned",
              label: "Planned",
              tooltip: "Scheduled client task hours from Monday.com boards for this discipline. (Source: Monday.com).",
              render: (r) => hrs1(r.client_hours_planned),
            },
            {
              key: "client_hours_actual",
              label: "Actual",
              tooltip: "Actual time logged in Everhour by team members in this discipline. (Source: Everhour).",
              render: (r) => hrs1(r.client_hours_actual),
            },
            {
              key: "utilisation_pct",
              label: "Utilisation",
              tooltip: "Delivery utilisation: (Actual hours / Practical capacity) × 100%.",
              render: (r) => pct1(r.utilisation_pct),
            },
            {
              key: "planned_load_pct",
              label: "Planned load",
              tooltip: "Planned load vs capacity: (Planned hours / Practical capacity) × 100%. Over 100% indicates over-allocation.",
              render: (r) => pct1(r.planned_load_pct),
            },
            {
              key: "headroom_hours",
              label: "Headroom",
              tooltip: "Available client delivery bandwidth: Practical capacity − Planned hours. Positive = bandwidth available.",
              render: (r) => hrs1(r.headroom_hours),
            },
          ]}
        />
      </div>
    </div>
  );
}
