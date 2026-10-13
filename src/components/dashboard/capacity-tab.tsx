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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartBox, Metric, SimpleTable } from "./bits";
import { hrs0, hrs1, pct1, sumNum } from "./format";
import type { View } from "./view";

const axis = { fontSize: 11, fill: "#737373" };
const palette = ["#44403c", "#2563eb", "#16a34a", "#ca8a04", "#9333ea", "#ea580c", "#0891b2", "#be123c"];

export function CapacityTab({ view }: { view: View }) {
  const monthRows = view.payload.capacity.filter((r) => r.month === view.asOf);
  const trend = view.payload.capacity.filter((r) => r.month >= view.range[0] && r.month <= view.range[1]);
  const disciplines = [...new Set(view.payload.capacity.map((r) => r.discipline))];
  const months = [...new Set(trend.map((r) => r.month))].sort();
  const lineData = months.map((month) => {
    const row: Record<string, string | number | null> = { month };
    for (const d of disciplines) {
      row[d] = trend.find((r) => r.month === month && r.discipline === d)?.planned_load_pct ?? null;
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
            <BarChart data={monthRows} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="discipline" tick={axis} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={axis} width={40} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="capacity_hours" name="Capacity" fill="#bbf7d0" />
              <Bar dataKey="client_hours_planned" name="Planned" fill="#6d28d9" />
              <Bar dataKey="client_hours_actual" name="Actual" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox title="Planned load % of capacity">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tick={axis} />
              <YAxis tick={axis} width={36} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={100} stroke="#dc2626" strokeDasharray="3 3" />
              {disciplines.map((d, i) => (
                <Line key={d} dataKey={d} stroke={palette[i % palette.length]} dot={false} strokeWidth={2} />
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
