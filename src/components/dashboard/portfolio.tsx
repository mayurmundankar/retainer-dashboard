"use client";

import { Button } from "@/components/ui/button";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartBox, Metric, SectionTitle, SimpleTable, StatusBadge } from "./bits";
import { downloadFact, hrs0, hrs1, pct1, signedPct, statusColor, statusLabel, sumMin, sumNum } from "./format";
import type { View } from "./view";

const axis = { fontSize: 11, fill: "#737373" };

export function PortfolioTab({ view }: { view: View }) {
  const rows = [...view.monthRows].sort((a, b) => {
    if (a.review_required !== b.review_required) return a.review_required ? -1 : 1;
    if (a.variance_pct == null && b.variance_pct == null) return a.client.localeCompare(b.client);
    if (a.variance_pct == null) return 1;
    if (b.variance_pct == null) return -1;
    return b.variance_pct - a.variance_pct || a.client.localeCompare(b.client);
  });
  const contracted = sumMin(rows.map((r) => r.contracted_hours));
  const allocated = sumMin(rows.map((r) => r.allocated_hours));
  const planned = sumMin(rows.map((r) => r.planned_hours));
  const actual = sumMin(rows.map((r) => r.actual_hours));
  const remaining = sumMin(rows.map((r) => r.remaining_estimate));
  const forecast = sumMin(rows.map((r) => r.forecast_hours));
  const varPct = allocated && forecast != null ? ((forecast - allocated) / allocated) * 100 : null;
  const reviews = rows.filter((r) => r.review_required).length;

  const months = [...new Set(view.trendRows.map((r) => r.month))].sort();
  const trend = months.map((month) => {
    const slice = view.trendRows.filter((r) => r.month === month);
    return {
      month,
      allocated_hours: sumNum(slice.map((r) => r.allocated_hours)),
      forecast_hours: sumNum(slice.map((r) => r.forecast_hours)),
      actual_hours: sumNum(slice.map((r) => r.actual_hours)),
      nonbillable_hours: sumNum(slice.map((r) => r.nonbillable_hours)),
    };
  });
  const heatClients = [...new Set(view.trendRows.map((r) => r.client))].sort();
  const points = rows.filter((r) => r.variance_pct != null && r.ctd_variance_pct != null);
  const byStatus = new Map<string, typeof points>();
  for (const p of points) {
    const list = byStatus.get(p.status) ?? [];
    list.push(p);
    byStatus.set(p.status, list);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
        <Metric label="Contracted" value={hrs0(contracted)} />
        <Metric label="Allocated" value={hrs0(allocated)} hint="Seasonal allocation where agreed" />
        <Metric label="Planned (Monday)" value={hrs0(planned)} />
        <Metric label="Actual (Everhour)" value={hrs0(actual)} hint="No data means nothing matched" />
        <Metric label="Remaining estimate" value={hrs0(remaining)} />
        <Metric label="Forecast" value={hrs0(forecast)} hint={varPct == null ? null : `${signedPct(varPct)} vs allocation`} />
        <Metric label="Accounts to review" value={String(reviews)} hint={`of ${rows.length}`} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Accounts – {view.asOf}</SectionTitle>
        <Button variant="outline" size="sm" onClick={() => downloadFact(view.trendRows)}>
          Download CSV
        </Button>
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-md border">
        <SimpleTable
          rows={rows}
          columns={[
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "client", label: "Client" },
            { key: "account_owner", label: "Owner", render: (r) => r.account_owner || "—" },
            { key: "billing_model", label: "Billing" },
            { key: "contracted_hours", label: "Contracted", render: (r) => hrs1(r.contracted_hours) },
            { key: "allocated_hours", label: "Allocated", render: (r) => hrs1(r.allocated_hours) },
            { key: "planned_hours", label: "Planned", render: (r) => hrs1(r.planned_hours) },
            { key: "actual_hours", label: "Actual", render: (r) => hrs1(r.actual_hours) },
            { key: "remaining_estimate", label: "Remaining", render: (r) => hrs1(r.remaining_estimate) },
            { key: "forecast_hours", label: "Forecast", render: (r) => hrs1(r.forecast_hours) },
            { key: "variance_hours", label: "Var (h)", render: (r) => hrs1(r.variance_hours) },
            { key: "variance_pct", label: "Var %", render: (r) => pct1(r.variance_pct) },
            { key: "ctd_contracted", label: "CTD contracted", render: (r) => hrs1(r.ctd_contracted) },
            { key: "ctd_actual", label: "CTD actual", render: (r) => hrs1(r.ctd_actual) },
            { key: "ctd_variance_pct", label: "CTD var %", render: (r) => pct1(r.ctd_variance_pct) },
            { key: "nonbillable_hours", label: "Non-billable", render: (r) => hrs1(r.nonbillable_hours) },
            { key: "deliverables_done", label: "Done" },
            { key: "deliverables_outstanding", label: "Outstanding" },
            { key: "deliverables_blocked", label: "Blocked" },
            { key: "partial_month", label: "Partial month", render: (r) => (r.partial_month ? "Yes" : "") },
          ]}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartBox title="Allocated vs forecast hours">
          <div className="h-full overflow-x-auto">
            <div className="h-full" style={{ minWidth: Math.max(480, rows.length * 56) }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="client" tick={axis} interval={0} angle={-40} textAnchor="end" height={70} />
                  <YAxis tick={axis} width={36} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="allocated_hours" name="Allocated" fill="#cbd5e1" />
                  <Bar dataKey="forecast_hours" name="Forecast">
                    {rows.map((r) => (
                      <Cell key={r.client} fill={statusColor(r.status)} />
                    ))}
                  </Bar>
                  <Scatter dataKey="actual_hours" name="Actual so far" fill="#111" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartBox>
        <ChartBox title="This month vs contract-to-date">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis type="number" dataKey="variance_pct" name="Monthly %" tick={axis} />
              <YAxis type="number" dataKey="ctd_variance_pct" name="CTD %" tick={axis} width={36} />
              <ZAxis dataKey="allocated_hours" range={[50, 240]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
              <ReferenceLine x={view.threshold} stroke="#a3a3a3" strokeDasharray="3 3" />
              <ReferenceLine x={-view.threshold} stroke="#a3a3a3" strokeDasharray="3 3" />
              <ReferenceLine y={view.threshold} stroke="#a3a3a3" strokeDasharray="3 3" />
              <ReferenceLine y={-view.threshold} stroke="#a3a3a3" strokeDasharray="3 3" />
              {[...byStatus.entries()].map(([status, data]) => (
                <Scatter key={status} name={statusLabel(status)} data={data} fill={statusColor(status)} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      <ChartBox title="Portfolio trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="month" tick={axis} />
            <YAxis tick={axis} width={36} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line dataKey="allocated_hours" name="Allocated" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line dataKey="forecast_hours" name="Forecast" stroke="#111" strokeWidth={2} dot={false} />
            <Line dataKey="actual_hours" name="Actual" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line dataKey="nonbillable_hours" name="Non-billable" stroke="#a8a29e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartBox>

      {heatClients.length > 0 && (
        <div>
          <SectionTitle>Monthly variance % (grey = data missing)</SectionTitle>
          <div className="mt-2 overflow-x-auto">
            <table className="border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium">Client</th>
                  {months.map((m) => (
                    <th key={m} className="px-1 py-1 font-medium">{m.slice(2)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatClients.map((client) => (
                  <tr key={client}>
                    <td className="sticky left-0 bg-background px-2 py-1 whitespace-nowrap">{client}</td>
                    {months.map((m) => {
                      const cell = view.trendRows.find((r) => r.client === client && r.month === m);
                      const v = cell?.variance_pct ?? null;
                      const missing = !cell || v == null;
                      const t = missing ? 0 : Math.max(-40, Math.min(40, v));
                      const hue = 60 * (1 - t / 40);
                      return (
                        <td
                          key={m}
                          className="px-1 py-1 text-center tabular-nums"
                          style={{
                            background: missing ? "#e5e5e5" : `hsl(${hue} 62% 46%)`,
                            color: missing ? "#737373" : Math.abs(t) > 18 ? "#fff" : "#111",
                          }}
                          title={missing ? "Missing" : `${v.toFixed(1)}%`}
                        >
                          {missing ? "" : Math.round(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
