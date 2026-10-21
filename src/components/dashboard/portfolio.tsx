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
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartBox, CtdVarBadge, Metric, SectionTitle, SimpleTable, StatusBadge } from "./bits";
import { ChartTooltip, series, tick } from "./charts";
import { downloadFact, hrs0, hrs1, pct1, signedPct, statusColor, statusLabel, sumMin, sumNum } from "./format";
import { formatMonth } from "./month-picker";
import { isInternalClient } from "@/lib/constants";
import type { View } from "./view";

export function PortfolioTab({ view }: { view: View }) {
  // Only list active clients data for that specific month, skipping Verkeer and inactive accounts
  const rows = [...view.monthRows]
    .filter(
      (r) =>
        !isInternalClient(r.client) &&
        !r.data_missing &&
        ((r.actual_hours != null && r.actual_hours > 0) || r.planned_hours > 0),
    )
    .sort((a, b) => {
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
    const slice = view.trendRows.filter((r) => r.month === month && !isInternalClient(r.client));
    return {
      month,
      allocated_hours: sumNum(slice.map((r) => r.allocated_hours)),
      forecast_hours: sumNum(slice.map((r) => r.forecast_hours)),
      actual_hours: sumNum(slice.map((r) => r.actual_hours)),
      nonbillable_hours: sumNum(slice.map((r) => r.nonbillable_hours)),
    };
  });
  const heatClients = [...new Set(view.trendRows.filter((r) => !isInternalClient(r.client)).map((r) => r.client))].sort();
  const points = rows.filter((r) => r.variance_pct != null && r.ctd_variance_pct != null);
  const byStatus = new Map<string, typeof points>();
  for (const p of points) {
    const list = byStatus.get(p.status) ?? [];
    list.push(p);
    byStatus.set(p.status, list);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Metric label="Contracted" value={hrs0(contracted)} />
        <Metric label="Allocated" value={hrs0(allocated)} hint="Seasonal allocation where agreed" />
        <Metric label="Planned (Monday)" value={hrs0(planned)} />
        <Metric label="Actual (Everhour)" value={hrs0(actual)} hint="Billable delivery hours" />
        <Metric label="Remaining estimate" value={hrs0(remaining)} />
        <Metric label="Forecast" value={hrs0(forecast)} hint={varPct == null ? null : `${signedPct(varPct)} vs allocation`} />
        <Metric label="Accounts to review" value={String(reviews)} hint={`of ${rows.length} active`} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <SectionTitle badge="PROJECT OVERVIEW">
          Accounts – {formatMonth(view.asOf)}
        </SectionTitle>
        <Button variant="outline" size="sm" className="shadow-xs hover:bg-muted/60" onClick={() => downloadFact(view.trendRows.filter((r) => !isInternalClient(r.client)))}>
          Download CSV
        </Button>
      </div>

      {/* Static header on vertical scroll, static 'Status' & 'Clients List' columns on horizontal scroll */}
      <div className="max-h-[30rem] overflow-auto rounded-lg border border-border/70 shadow-xs bg-card relative">
        <SimpleTable
          stickyHeader
          rows={rows}
          columns={[
            {
              key: "status",
              label: "Status",
              tooltip: "Account servicing status based on variance thresholds: Over-servicing (🔴), Under-servicing (🟠), CTD alert (🟡), or On track (🟢).",
              headerClassName: "sticky left-0 top-0 z-30 bg-card min-w-[145px] w-[145px] border-r border-border/30",
              className: "sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors min-w-[145px] w-[145px] border-r border-border/30",
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: "client",
              label: "Clients List",
              tooltip: "Client account name active during this billing month.",
              headerClassName: "sticky left-[145px] top-0 z-30 bg-card min-w-[190px] border-r-2 border-border shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)]",
              className: "sticky left-[145px] z-10 bg-card group-hover:bg-muted/50 transition-colors min-w-[190px] border-r-2 border-border shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)] font-medium text-foreground",
            },
            {
              key: "account_owner",
              label: "POD",
              tooltip: "Internal POD / account team owner leading the account.",
              render: (r) => r.account_owner || "—",
            },
            {
              key: "contracted_hours",
              label: "Contracted Hours",
              tooltip: "Agreed monthly retainer hours under current contract terms.",
              render: (r) => hrs1(r.contracted_hours),
            },
            {
              key: "planned_hours",
              label: "Planned",
              tooltip: "Total hours scheduled on Monday.com boards for this month.",
              render: (r) => hrs1(r.planned_hours),
            },
            {
              key: "actual_hours",
              label: "Actual",
              tooltip: "Billable client hours logged in Everhour so far this month (non-billable time excluded).",
              render: (r) => hrs1(r.actual_hours),
            },
            {
              key: "remaining_estimate",
              label: "Remaining",
              tooltip: "Estimated hours remaining on open / in-progress tasks scheduled for this month.",
              render: (r) => hrs1(r.remaining_estimate),
            },
            {
              key: "forecast_hours",
              label: "Forecast",
              tooltip: "Projected monthly total hours delivered: Actual logged hours + Remaining estimate.",
              render: (r) => hrs1(r.forecast_hours),
            },
            {
              key: "variance_hours",
              label: "Var (h)",
              tooltip: "Variance in hours between Forecast hours and Contracted / Allocated hours.",
              render: (r) => hrs1(r.variance_hours),
            },
            {
              key: "variance_pct",
              label: "Var %",
              tooltip: "Monthly delivery variance percentage: (Forecast - Allocated) / Allocated × 100%.",
              render: (r) => pct1(r.variance_pct),
            },
            {
              key: "ctd_contracted",
              label: "CTD contracted",
              tooltip: "Cumulative contracted hours from contract start to current date.",
              render: (r) => hrs1(r.ctd_contracted),
            },
            {
              key: "ctd_actual",
              label: "CTD actual",
              tooltip: "Cumulative billable hours delivered across the entire contract to date.",
              render: (r) => hrs1(r.ctd_actual),
            },
            {
              key: "ctd_variance_pct",
              label: "CTD var %",
              tooltip: "Contract-to-date variance percentage: (CTD Actual - CTD Contracted) / CTD Contracted × 100%. Color-coded by performance.",
              render: (r) => <CtdVarBadge v={r.ctd_variance_pct} threshold={view.threshold} />,
            },
            {
              key: "deliverables_done",
              label: "Done",
              tooltip: "Number of deliverables / tasks marked complete this month.",
            },
            {
              key: "deliverables_outstanding",
              label: "Outstanding",
              tooltip: "Deliverables / tasks scheduled but still open or in-progress.",
            },
            {
              key: "deliverables_blocked",
              label: "Blocked",
              tooltip: "Deliverables flagged as stuck or blocked requiring resolution.",
            },
          ]}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartBox title="Allocated vs forecast hours">
          <div className="h-full overflow-x-auto">
            <div className="h-full" style={{ minWidth: Math.max(640, rows.length * 88) }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="client" tick={tick} interval={0} angle={-40} textAnchor="end" height={88} />
                  <YAxis tick={tick} width={40} />
                  <ChartTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="allocated_hours" name="Allocated" fill={series.allocated} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="forecast_hours" name="Forecast" radius={[3, 3, 0, 0]}>
                    {rows.map((r) => (
                      <Cell key={r.client} fill={statusColor(r.status)} />
                    ))}
                  </Bar>
                  <Scatter dataKey="actual_hours" name="Actual so far" fill={series.actual} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartBox>
        <ChartBox title="This month vs contract-to-date">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis type="number" dataKey="variance_pct" name="Monthly %" tick={tick} unit="%" />
              <YAxis type="number" dataKey="ctd_variance_pct" name="CTD %" tick={tick} width={40} unit="%" />
              <ZAxis dataKey="allocated_hours" range={[50, 240]} />
              <ChartTooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
              <ReferenceLine x={view.threshold} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <ReferenceLine x={-view.threshold} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <ReferenceLine y={view.threshold} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <ReferenceLine y={-view.threshold} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              {[...byStatus.entries()].map(([status, data]) => (
                <Scatter key={status} name={statusLabel(status)} data={data} fill={statusColor(status)} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      <ChartBox title={`Portfolio trend · ${formatMonth(view.range[0])} – ${formatMonth(view.range[1])}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart key={view.range.join(":")} data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={tick} />
            <YAxis tick={tick} width={40} />
            <ChartTooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line dataKey="allocated_hours" name="Allocated" stroke={series.allocated} strokeWidth={2} dot={false} />
            <Line dataKey="forecast_hours" name="Forecast" stroke={series.forecast} strokeWidth={2} dot={false} />
            <Line dataKey="actual_hours" name="Actual" stroke={series.actual} strokeWidth={2} dot={false} />
            <Line dataKey="nonbillable_hours" name="Non-billable" stroke={series.muted} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartBox>

      {heatClients.length > 0 && (
        <div>
          <SectionTitle>Monthly variance % · {formatMonth(view.range[0])} – {formatMonth(view.range[1])}</SectionTitle>
          <div className="mt-2 overflow-x-auto">
            <table className="border-collapse text-xs">
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
                            background: missing ? "var(--muted)" : `hsl(${hue} 55% 48%)`,
                            color: missing ? "var(--muted-foreground)" : Math.abs(t) > 18 ? "#fff" : "#111",
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
