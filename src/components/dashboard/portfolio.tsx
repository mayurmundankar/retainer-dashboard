"use client";

import { useMemo } from "react";
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
  const rows = useMemo(() => {
    return [...view.monthRows]
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
  }, [view.monthRows]);

  const contracted = sumMin(rows.map((r) => r.contracted_hours));
  const allocated = sumMin(rows.map((r) => r.allocated_hours));
  const planned = sumMin(rows.map((r) => r.planned_hours));
  const actual = sumMin(rows.map((r) => r.actual_hours));
  const remaining = sumMin(rows.map((r) => r.remaining_estimate));
  const forecast = sumMin(rows.map((r) => r.forecast_hours));
  const varPct = allocated && forecast != null ? ((forecast - allocated) / allocated) * 100 : null;
  const reviews = rows.filter((r) => r.review_required).length;

  const months = useMemo(() => [...new Set(view.trendRows.map((r) => r.month))].sort(), [view.trendRows]);

  // Rounded whole-number data for the trend chart to eliminate decimal display issues
  const trend = useMemo(() => {
    return months.map((month) => {
      const slice = view.trendRows.filter((r) => r.month === month && !isInternalClient(r.client));
      return {
        month,
        allocated_hours: Math.round(sumNum(slice.map((r) => r.allocated_hours))),
        forecast_hours: Math.round(sumNum(slice.map((r) => r.forecast_hours))),
        actual_hours: Math.round(sumNum(slice.map((r) => r.actual_hours))),
        nonbillable_hours: Math.round(sumNum(slice.map((r) => r.nonbillable_hours))),
      };
    });
  }, [months, view.trendRows]);

  // Rounded chart rows for visual overview charts
  const chartRows = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      allocated_hours: r.allocated_hours != null ? Math.round(r.allocated_hours) : 0,
      forecast_hours: r.forecast_hours != null ? Math.round(r.forecast_hours) : 0,
      actual_hours: r.actual_hours != null ? Math.round(r.actual_hours) : 0,
      variance_pct: r.variance_pct != null ? Math.round(r.variance_pct) : null,
      ctd_variance_pct: r.ctd_variance_pct != null ? Math.round(r.ctd_variance_pct) : null,
    }));
  }, [rows]);

  const heatClients = useMemo(
    () => [...new Set(view.trendRows.filter((r) => !isInternalClient(r.client)).map((r) => r.client))].sort(),
    [view.trendRows],
  );

  const points = useMemo(() => chartRows.filter((r) => r.variance_pct != null && r.ctd_variance_pct != null), [chartRows]);
  const byStatus = useMemo(() => {
    const map = new Map<string, typeof points>();
    for (const p of points) {
      const list = map.get(p.status) ?? [];
      list.push(p);
      map.set(p.status, list);
    }
    return map;
  }, [points]);

  return (
    <div className="space-y-6">
      {/* 1. Headline Overview Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Metric label="Contracted" value={hrs0(contracted)} />
        <Metric label="Allocated" value={hrs0(allocated)} hint="Seasonal allocation where agreed" />
        <Metric label="Planned (Monday)" value={hrs0(planned)} />
        <Metric label="Actual (Everhour)" value={hrs0(actual)} hint="Billable delivery hours" />
        <Metric label="Remaining estimate" value={hrs0(remaining)} />
        <Metric label="Forecast" value={hrs0(forecast)} hint={varPct == null ? null : `${signedPct(varPct)} vs allocation`} />
        <Metric label="Accounts to review" value={String(reviews)} hint={`of ${rows.length} active`} />
      </div>

      {/* 2. Visual Overview Charts (Leading before the detailed table per feedback) */}
      <div className="space-y-4">
        {/* Full-width Allocated vs Forecast Chart with color key explanation */}
        <ChartBox
          title={`Allocated vs forecast hours – ${formatMonth(view.asOf)}`}
          subtitle="Forecast bars are color-coded by servicing status: 🟢 On track (±10%), 🔴 Over-servicing (>10%), 🟠 Under-servicing (<-10%), 🟡 Contract-to-date alert. Dot indicates actual hours delivered so far."
        >
          <div className="h-full overflow-x-auto">
            <div className="h-full" style={{ minWidth: Math.max(720, chartRows.length * 75) }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="client" tick={tick} interval={0} angle={-35} textAnchor="end" height={85} />
                  <YAxis tick={tick} width={45} tickFormatter={(v) => `${Math.round(v)}`} />
                  <ChartTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="allocated_hours" name="Allocated" fill={series.allocated} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="forecast_hours" name="Forecast" radius={[3, 3, 0, 0]}>
                    {chartRows.map((r) => (
                      <Cell key={r.client} fill={statusColor(r.status)} />
                    ))}
                  </Bar>
                  <Scatter dataKey="actual_hours" name="Actual so far" fill={series.actual} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartBox>

        {/* 2-Column Visual Charts: Trend + Month vs CTD */}
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Portfolio Trend Chart */}
          <ChartBox
            title={`Portfolio trend · ${formatMonth(view.range[0])} – ${formatMonth(view.range[1])}`}
            subtitle="Historical progress of delivery hours across all active retainer clients (whole hours, zero decimals)"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart key={view.range.join(":")} data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={tick} />
                <YAxis tick={tick} width={45} tickFormatter={(v) => `${Math.round(v)}`} />
                <ChartTooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="allocated_hours" name="Allocated" stroke={series.allocated} strokeWidth={2} dot={false} />
                <Line dataKey="forecast_hours" name="Forecast" stroke={series.forecast} strokeWidth={2} dot={false} />
                <Line dataKey="actual_hours" name="Actual" stroke={series.actual} strokeWidth={2} dot={false} />
                <Line dataKey="nonbillable_hours" name="Non-billable" stroke={series.muted} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>

          {/* This month vs Contract-to-date Scatter Chart */}
          <ChartBox
            title="This month vs contract-to-date variance"
            subtitle="Monthly variance % vs cumulative contract-to-date variance %. Dotted crosshairs indicate ±10% threshold boundaries."
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis type="number" dataKey="variance_pct" name="Monthly Var" tick={tick} unit="%" tickFormatter={(v) => `${Math.round(v)}%`} />
                <YAxis type="number" dataKey="ctd_variance_pct" name="CTD Var" tick={tick} width={45} unit="%" tickFormatter={(v) => `${Math.round(v)}%`} />
                <ZAxis dataKey="allocated_hours" range={[50, 240]} name="Allocated" />
                <ChartTooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v) => (typeof v === "number" ? `${Math.round(v)}%` : v)} />
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
      </div>

      {/* 3. Detailed Accounts Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle badge="PROJECT OVERVIEW" subtitle="Full breakdown of all accounts active during this billing month. CTD = Contract-to-date.">
            Accounts Detail – {formatMonth(view.asOf)}
          </SectionTitle>
          <Button
            size="sm"
            className="rounded-full font-bold uppercase text-[11px] tracking-wider border border-border/80 bg-white text-foreground hover:bg-[#121212] hover:text-white transition-all shadow-[2px_2px_0px_#b5018b] cursor-pointer"
            onClick={() => downloadFact(rows.length ? rows : view.trendRows.filter((r) => !isInternalClient(r.client)))}
          >
            Download CSV
          </Button>
        </div>

        {/* Static header on vertical scroll, static 'Status' & 'Clients List' columns on horizontal scroll */}
        <div className="max-h-[30rem] overflow-auto rounded-xl border border-border/80 shadow-xs bg-card relative">
          <SimpleTable
            stickyHeader
            rows={rows}
            columns={[
              {
                key: "status",
                label: "Status",
                tooltip: "Account servicing status: Over-servicing (🔴), Under-servicing (🟠), Contract-to-date alert (🟡), or On track (🟢).",
                headerClassName: "sticky left-0 top-0 z-40 bg-[#b5018b] text-white min-w-[145px] w-[145px] max-w-[145px] border-r border-white/20",
                className: "sticky left-0 z-10 bg-card group-hover:bg-[#f4e8f1]/50 transition-colors min-w-[145px] w-[145px] max-w-[145px] border-r border-border/40",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "client",
                label: "Clients List",
                tooltip: "Client account name active during this billing month.",
                headerClassName: "sticky left-[145px] top-0 z-40 bg-[#b5018b] text-white min-w-[190px] w-[190px] max-w-[190px] border-r-2 border-white/30 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.25)]",
                className: "sticky left-[145px] z-10 bg-card group-hover:bg-[#f4e8f1]/50 transition-colors min-w-[190px] w-[190px] max-w-[190px] border-r-2 border-border shadow-[4px_0_8px_-3px_rgba(0,0,0,0.12)] font-semibold text-foreground",
              },
              {
                key: "account_owner",
                label: "POD",
                tooltip: "Account owner / Delivery Pod lead responsible for account performance.",
              },
              {
                key: "contracted_hours",
                label: "Contracted",
                tooltip: "Standard monthly contracted hours under client agreement.",
                render: (r) => (
                  <span className="tabular-nums">
                    {hrs1(r.contracted_hours)}
                    {r.partial_month ? <span className="ml-1 text-[10px] text-muted-foreground font-semibold">PARTIAL</span> : null}
                  </span>
                ),
              },
              {
                key: "allocated_hours",
                label: "Allocated",
                tooltip: "Agreed monthly allocation for this specific month (accommodates seasonal shifts).",
                render: (r) => hrs1(r.allocated_hours),
              },
              {
                key: "planned_hours",
                label: "Planned",
                tooltip: "Total planned hours scheduled on Monday.com boards for this month.",
                render: (r) => hrs1(r.planned_hours),
              },
              {
                key: "actual_hours",
                label: "Actual",
                tooltip: "Actual billable delivery hours logged in Everhour to date.",
                render: (r) => (r.data_missing ? <span className="text-destructive font-semibold">Missing</span> : hrs1(r.actual_hours)),
              },
              {
                key: "remaining_estimate",
                label: "Remaining",
                tooltip: "Estimated remaining hours to complete open tasks on Monday.com.",
                render: (r) => hrs1(r.remaining_estimate),
              },
              {
                key: "forecast_hours",
                label: "Forecast",
                tooltip: "Total projected month-end delivery hours: Actual so far + Remaining estimate.",
                render: (r) => hrs1(r.forecast_hours),
              },
              {
                key: "variance_pct",
                label: "Var %",
                tooltip: "Monthly delivery variance: (Forecast - Allocated) / Allocated × 100%.",
                render: (r) => pct1(r.variance_pct),
              },
              {
                key: "ctd_contracted",
                label: "Contract-to-date contracted",
                tooltip: "Cumulative contracted hours from contract commencement to current month.",
                render: (r) => hrs1(r.ctd_contracted),
              },
              {
                key: "ctd_actual",
                label: "Contract-to-date actual",
                tooltip: "Cumulative actual delivery hours logged across entire contract term to date.",
                render: (r) => hrs1(r.ctd_actual),
              },
              {
                key: "ctd_variance_pct",
                label: "Contract-to-date var %",
                tooltip: "Contract-to-date variance: (CTD Actual - CTD Contracted) / CTD Contracted × 100%. Color-coded indicator.",
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
      </div>

      {/* 4. Monthly Variance % Heatmap with Color Key Legend */}
      {heatClients.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle subtitle="Variance % across recent months. Hover any cell to inspect exact allocated, actual, and forecast hours.">
              Monthly variance % · {formatMonth(view.range[0])} – {formatMonth(view.range[1])}
            </SectionTitle>

            {/* Heatmap Color Key Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground font-medium">
              <span className="font-bold text-foreground">Color key:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#99d132]" /> On track (±10%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-red-500" /> Over delivery (&gt;+10%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-amber-500" /> Under delivery (&lt;-10%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-muted border border-border" /> No active data
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs bg-card">
            <table className="border-collapse text-xs w-full">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  <th className="sticky left-0 bg-card px-3 py-2 text-left font-bold text-foreground min-w-[180px] border-r border-border/80">
                    Client
                  </th>
                  {months.map((m) => (
                    <th key={m} className="px-2 py-2 font-bold text-foreground text-center min-w-[55px]">
                      {m.slice(2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {heatClients.map((client) => (
                  <tr key={client} className="hover:bg-muted/30 transition-colors">
                    <td className="sticky left-0 bg-card px-3 py-2 whitespace-nowrap font-semibold text-foreground border-r border-border/80">
                      {client}
                    </td>
                    {months.map((m) => {
                      const cell = view.trendRows.find((r) => r.client === client && r.month === m);
                      const v = cell?.variance_pct ?? null;
                      const missing = !cell || v == null;
                      const t = missing ? 0 : Math.max(-40, Math.min(40, v));
                      const hue = 60 * (1 - t / 40);
                      const roundedVal = v != null ? Math.round(v) : null;
                      const allocHrs = cell?.allocated_hours != null ? Math.round(cell.allocated_hours) : 0;
                      const actHrs = cell?.actual_hours != null ? Math.round(cell.actual_hours) : 0;
                      const fcHrs = cell?.forecast_hours != null ? Math.round(cell.forecast_hours) : 0;

                      const hoverTooltip = missing
                        ? `${client} (${m}): No active contract / data`
                        : `${client} (${m}): ${roundedVal! > 0 ? "+" : ""}${roundedVal}% variance | Allocated: ${allocHrs}h | Actual: ${actHrs}h | Forecast: ${fcHrs}h`;

                      return (
                        <td
                          key={m}
                          className="px-1.5 py-1.5 text-center tabular-nums font-semibold cursor-default text-[11px]"
                          style={{
                            background: missing ? "var(--muted)" : `hsl(${hue} 55% 48%)`,
                            color: missing ? "var(--muted-foreground)" : Math.abs(t) > 18 ? "#fff" : "#111",
                          }}
                          title={hoverTooltip}
                        >
                          {missing ? "—" : `${roundedVal}%`}
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
