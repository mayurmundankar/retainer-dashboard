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
      <p className="text-xs text-muted-foreground">
        Phase 2 preview. Practical capacity = weekly hours × working days − internal share − leave. Assumptions live in team_capacity.csv and team_leave.csv.
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Practical capacity" value={hrs0(sumNum(monthRows.map((r) => r.capacity_hours)))} />
        <Metric label="Client hours planned" value={hrs0(sumNum(monthRows.map((r) => r.client_hours_planned)))} />
        <Metric label="Client hours actual" value={hrs0(sumNum(monthRows.map((r) => r.client_hours_actual)))} />
        <Metric label="Headroom (capacity − planned)" value={hrs0(sumNum(monthRows.map((r) => r.headroom_hours)))} />
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
      <div className="overflow-auto rounded-md border">
        <SimpleTable
          rows={monthRows}
          columns={[
            { key: "discipline", label: "Discipline" },
            { key: "gross_hours", label: "Gross", render: (r) => hrs1(r.gross_hours) },
            { key: "leave_hours", label: "Leave", render: (r) => hrs1(r.leave_hours) },
            { key: "capacity_hours", label: "Capacity", render: (r) => hrs1(r.capacity_hours) },
            { key: "client_hours_planned", label: "Planned", render: (r) => hrs1(r.client_hours_planned) },
            { key: "client_hours_actual", label: "Actual", render: (r) => hrs1(r.client_hours_actual) },
            { key: "utilisation_pct", label: "Utilisation", render: (r) => pct1(r.utilisation_pct) },
            { key: "planned_load_pct", label: "Planned load", render: (r) => pct1(r.planned_load_pct) },
            { key: "headroom_hours", label: "Headroom", render: (r) => hrs1(r.headroom_hours) },
          ]}
        />
      </div>
    </div>
  );
}
