"use client";

import { useMemo, useState } from "react";
import { Download, Filter, Search, X } from "lucide-react";
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
  // Modal state for filtered CSV downloads
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [selectedClientsForExport, setSelectedClientsForExport] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [chartBarMode, setChartBarMode] = useState<"both" | "forecast">("both");

  // Table UI Filters for [status, client list, POD] only
  const [tableStatusFilter, setTableStatusFilter] = useState<string>("ALL");
  const [tableClientFilter, setTableClientFilter] = useState<string>("ALL");
  const [tablePodFilter, setTablePodFilter] = useState<string>("ALL");

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

  // Distinct filter options for Accounts Detail table
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.status) set.add(r.status);
    }
    return [...set].sort();
  }, [rows]);

  const availableClients = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.client) set.add(r.client);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const availablePods = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.account_owner) set.add(r.account_owner);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Filtered rows for Accounts Detail table based on [status, client list, POD]
  const filteredTableRows = useMemo(() => {
    return rows.filter((r) => {
      if (tableStatusFilter !== "ALL" && r.status !== tableStatusFilter) {
        return false;
      }
      if (tableClientFilter !== "ALL" && r.client !== tableClientFilter) {
        return false;
      }
      if (tablePodFilter !== "ALL") {
        const podVal = r.account_owner || "Unassigned";
        if (podVal !== tablePodFilter) return false;
      }
      return true;
    });
  }, [rows, tableStatusFilter, tableClientFilter, tablePodFilter]);

  const hasActiveFilters = tableStatusFilter !== "ALL" || tableClientFilter !== "ALL" || tablePodFilter !== "ALL";

  const allClientNames = useMemo(() => {
    const list = rows.length ? rows.map((r) => r.client) : view.trendRows.filter((r) => !isInternalClient(r.client)).map((r) => r.client);
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }, [rows, view.trendRows]);

  const handleOpenDownloadModal = () => {
    setSelectedClientsForExport(filteredTableRows.map((r) => r.client));
    setClientSearch("");
    setDownloadModalOpen(true);
  };

  const contracted = sumMin(rows.map((r) => r.contracted_hours));
  const allocated = sumMin(rows.map((r) => r.allocated_hours));
  const planned = sumMin(rows.map((r) => r.planned_hours));
  const actual = sumMin(rows.map((r) => r.actual_hours));
  const remaining = sumMin(rows.map((r) => r.remaining_estimate));
  const forecast = sumMin(rows.map((r) => r.forecast_hours));
  const baselineHours = contracted ?? allocated;
  const varPct = baselineHours && forecast != null ? ((forecast - baselineHours) / baselineHours) * 100 : null;
  const reviews = rows.filter((r) => r.review_required).length;

  const months = useMemo(() => [...new Set(view.trendRows.map((r) => r.month))].sort(), [view.trendRows]);

  // Rounded whole-number data for the trend chart to eliminate decimal display issues
  const trend = useMemo(() => {
    return months.map((month) => {
      const slice = view.trendRows.filter((r) => r.month === month && !isInternalClient(r.client));
      return {
        month,
        contracted_hours: Math.round(sumNum(slice.map((r) => r.contracted_hours ?? r.allocated_hours))),
        allocated_hours: Math.round(sumNum(slice.map((r) => r.allocated_hours))),
        forecast_hours: Math.round(sumNum(slice.map((r) => r.forecast_hours))),
        actual_hours: Math.round(sumNum(slice.map((r) => r.actual_hours))),
        nonbillable_hours: Math.round(sumNum(slice.map((r) => r.nonbillable_hours))),
      };
    });
  }, [months, view.trendRows]);

  // Rounded chart rows for visual overview charts
  const chartRows = useMemo(() => {
    return rows.map((r) => {
      const contractedVal = r.contracted_hours != null ? Math.round(r.contracted_hours) : (r.allocated_hours != null ? Math.round(r.allocated_hours) : 0);
      return {
        ...r,
        contracted_hours: contractedVal,
        allocated_hours: r.allocated_hours != null ? Math.round(r.allocated_hours) : 0,
        forecast_hours: r.forecast_hours != null ? Math.round(r.forecast_hours) : 0,
        actual_hours: r.actual_hours != null ? Math.round(r.actual_hours) : 0,
        variance_pct: r.variance_pct != null ? Math.round(r.variance_pct) : null,
        ctd_variance_pct: r.ctd_variance_pct != null ? Math.round(r.ctd_variance_pct) : null,
      };
    });
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Contracted"
          value={hrs0(contracted)}
          tooltip="Signed monthly commitment under client agreement, prorated by days for partial months."
        />
        {/* 'Allocated' metric card commented out per user request:
        <Metric
          label="Allocated"
          value={hrs0(allocated)}
          hint="Seasonal allocation where agreed"
          tooltip="Agreed delivery allocation for the month. Equals contracted unless a seasonal allocation exists."
        /> */}
        <Metric
          label="Planned (Monday)"
          value={hrs0(planned)}
          tooltip="Hours planned on Monday.com boards for this month. Shown separately and never added to forecast."
        />
        <Metric
          label="Actual (Everhour)"
          value={hrs0(actual)}
          hint="Billable delivery hours"
          tooltip="Actual billable delivery hours logged in Everhour to date under current filters."
        />
        <Metric
          label="Remaining estimate"
          value={hrs0(remaining)}
          tooltip="Hours still left on open Monday.com tasks this month after logged hours."
        />
        <Metric
          label="Forecast"
          value={hrs0(forecast)}
          hint={varPct == null ? null : `${signedPct(varPct)} vs contracted`}
          tooltip="Projected month-end delivery hours: Actual so far + Remaining estimate. (Formula: Actual + Remaining estimate)."
        />
        <Metric
          label="Accounts to review"
          value={String(reviews)}
          hint={`of ${rows.length} active`}
          tooltip={`Active client accounts exceeding ±${view.threshold}% monthly or contract-to-date variance.`}
        />
      </div>

      {/* 2. Visual Overview Charts (Leading before the detailed table per feedback) */}
      <div className="space-y-4">
        {/* Full-width Contracted vs Forecast Chart with Verkeer theme color key explanation */}
        <ChartBox
          title={`Contracted vs forecast hours – ${formatMonth(view.asOf)}`}
          subtitle={
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">
                <span className="font-semibold text-foreground">Forecast status:</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="size-2 rounded-full bg-[#99d132]" /> On track (±10%)
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="size-2 rounded-full bg-[#b5018b]" /> Over-servicing (&gt;10%)
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="size-2 rounded-full bg-[#01abc8]" /> Under-servicing (&lt;-10%)
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="size-2 rounded-full bg-[#4b439d]" /> Contract-to-date alert
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="size-2 rounded-full bg-[#01abc8] inline-block border border-white" /> Dot: Actual so far
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setChartBarMode("both")}
                  className={`px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                    chartBarMode === "both"
                      ? "bg-[#121212] text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  2 Bars (Contracted &amp; Forecast)
                </button>
                <button
                  type="button"
                  onClick={() => setChartBarMode("forecast")}
                  className={`px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                    chartBarMode === "forecast"
                      ? "bg-[#121212] text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  1 Bar (Forecast Only)
                </button>
              </div>
            </div>
          }
        >
          <div className="h-full overflow-x-auto">
            <div className="h-full" style={{ minWidth: Math.max(720, chartRows.length * 75) }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="client" tick={tick} interval={0} angle={-35} textAnchor="end" height={85} />
                  <YAxis tick={tick} width={45} tickFormatter={(v) => `${Math.round(v)}`} />
                  <ChartTooltip />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                    formatter={(value) => <span className="text-foreground font-semibold px-2">{value}</span>}
                  />
                  {chartBarMode === "both" && (
                    <Bar dataKey="contracted_hours" name="Contracted" fill="#4b439d" radius={[3, 3, 0, 0]} />
                  )}
                  <Bar dataKey="forecast_hours" name="Forecast" fill="#b5018b" radius={[3, 3, 0, 0]}>
                    {chartRows.map((r) => (
                      <Cell key={r.client} fill={statusColor(r.status)} />
                    ))}
                  </Bar>
                  <Scatter dataKey="actual_hours" name="Actual so far" fill="#01abc8" />
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
            subtitle="Historical progress of delivery hours across all active retainer clients"
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle badge="PROJECT OVERVIEW" subtitle="Full breakdown of all accounts active during this billing month. CTD = Contract-to-date.">
            Accounts Detail – {formatMonth(view.asOf)}
          </SectionTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={filteredTableRows.length === 0}
              className="rounded-full font-bold uppercase text-[11px] tracking-wider border border-border/80 bg-white text-foreground hover:bg-[#121212] hover:text-white transition-all shadow-[2px_2px_0px_#b5018b] cursor-pointer inline-flex items-center gap-1.5"
              onClick={() => downloadFact(filteredTableRows)}
              title={`Download CSV with active table filters (${filteredTableRows.length} accounts)`}
            >
              <Download className="size-3.5" />
              Download CSV ({filteredTableRows.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDownloadModal}
              className="rounded-full text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              title="Open download options & selective client checkboxes"
            >
              Custom…
            </Button>
          </div>
        </div>

        {/* UI Filters for [status, client list, POD] only */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-card shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Filter className="size-3.5 text-[#b5018b]" />
              Filter by:
            </span>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-status" className="text-xs font-medium text-muted-foreground">
                Status:
              </label>
              <select
                id="filter-status"
                value={tableStatusFilter}
                onChange={(e) => setTableStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[#b5018b] cursor-pointer"
              >
                <option value="ALL">All Statuses ({rows.length})</option>
                {availableStatuses.map((st) => {
                  const count = rows.filter((r) => r.status === st).length;
                  return (
                    <option key={st} value={st}>
                      {statusLabel(st)} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Client List Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-client" className="text-xs font-medium text-muted-foreground">
                Client:
              </label>
              <select
                id="filter-client"
                value={tableClientFilter}
                onChange={(e) => setTableClientFilter(e.target.value)}
                className="h-8 max-w-[210px] truncate rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[#b5018b] cursor-pointer"
              >
                <option value="ALL">All Clients ({availableClients.length})</option>
                {availableClients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* POD Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-pod" className="text-xs font-medium text-muted-foreground">
                POD:
              </label>
              <select
                id="filter-pod"
                value={tablePodFilter}
                onChange={(e) => setTablePodFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[#b5018b] cursor-pointer"
              >
                <option value="ALL">All PODs ({availablePods.length})</option>
                {availablePods.map((p) => {
                  const count = rows.filter((r) => (r.account_owner || "Unassigned") === p).length;
                  return (
                    <option key={p} value={p}>
                      {p} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setTableStatusFilter("ALL");
                  setTableClientFilter("ALL");
                  setTablePodFilter("ALL");
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b5018b] hover:underline cursor-pointer px-1 py-0.5"
              >
                <X className="size-3" />
                Reset filters
              </button>
            )}
          </div>

          <div className="text-[11px] font-medium text-muted-foreground">
            Showing <span className="font-bold text-foreground">{filteredTableRows.length}</span> of {rows.length} accounts
          </div>
        </div>

        {/* Static header on vertical scroll, static 'Status' & 'Clients List' columns on horizontal scroll */}
        <div className="max-h-[30rem] overflow-auto rounded-xl border border-border/80 shadow-xs bg-card relative">
          <SimpleTable
            stickyHeader
            rows={filteredTableRows}
            columns={[
              {
                key: "status",
                label: "Status",
                tooltip: "Account servicing status: Over-servicing (Plum), Under-servicing (Cyan), Contract-to-date alert (Indigo), or On track (Lime).",
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
                  <span className="tabular-nums font-semibold">
                    {hrs1(r.contracted_hours)}
                    {r.partial_month ? <span className="ml-1 text-[10px] text-muted-foreground font-semibold">PARTIAL</span> : null}
                  </span>
                ),
              },
              {
                key: "allocated_hours",
                label: "Allocated",
                tooltip: "Agreed monthly allocation / contracted baseline for this specific month.",
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
                tooltip: "Monthly delivery variance: (Forecast - Contracted) / Contracted × 100%.",
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
            <SectionTitle subtitle="Variance % across recent months. Hover any cell to inspect exact contracted, actual, and forecast hours.">
              Monthly variance % · {formatMonth(view.range[0])} – {formatMonth(view.range[1])}
            </SectionTitle>

            {/* Heatmap Color Key Legend (Theme Colors Aligned) */}
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground font-medium">
              <span className="font-bold text-foreground">Color key:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#99d132]" /> On track (±10%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#b5018b]" /> Over delivery (&gt;+10%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#01abc8]" /> Under delivery (&lt;-10%)
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
                    <th key={m} className="px-2.5 py-2 font-bold text-foreground text-center min-w-[76px] whitespace-nowrap">
                      {formatMonth(m)}
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
                      const roundedVal = v != null ? Math.round(v) : null;
                      const contractHrs = cell?.contracted_hours != null ? Math.round(cell.contracted_hours) : (cell?.allocated_hours != null ? Math.round(cell.allocated_hours) : 0);
                      const actHrs = cell?.actual_hours != null ? Math.round(cell.actual_hours) : 0;
                      const fcHrs = cell?.forecast_hours != null ? Math.round(cell.forecast_hours) : 0;

                      const hoverTooltip = missing
                        ? `${client} (${formatMonth(m)}): No active contract / data`
                        : `${client} (${formatMonth(m)}): ${roundedVal! > 0 ? "+" : ""}${roundedVal}% variance | Contracted: ${contractHrs}h | Actual: ${actHrs}h | Forecast: ${fcHrs}h`;

                      let cellBg = "var(--muted)";
                      let cellColor = "var(--muted-foreground)";
                      if (!missing && v != null) {
                        if (Math.abs(v) <= 10) {
                          cellBg = "rgba(153, 209, 50, 0.22)"; // Verkeer Lime Green
                          cellColor = "#2e5904";
                        } else if (v > 10) {
                          cellBg = "rgba(181, 1, 139, 0.20)"; // Verkeer Plum
                          cellColor = "#b5018b";
                        } else {
                          cellBg = "rgba(1, 171, 200, 0.20)"; // Verkeer Cyan
                          cellColor = "#007f96";
                        }
                      }

                      return (
                        <td
                          key={m}
                          className="px-1.5 py-1.5 text-center tabular-nums font-semibold cursor-default text-[11px]"
                          style={{
                            background: cellBg,
                            color: cellColor,
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

      {/* Download CSV Filter Modal */}
      {downloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative flex max-w-lg w-full flex-col max-h-[85vh] rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div>
                <h3 className="text-base font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                  <Download className="size-4 text-[#b5018b]" />
                  Download Accounts CSV
                </h3>
                <p className="text-xs text-muted-foreground font-light mt-0.5">
                  Select specific client accounts to export, or choose all ({selectedClientsForExport.length} of {allClientNames.length} selected).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDownloadModalOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Actions, Synced Filters (Status, POD) & Client Search */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="modal-filter-status" className="text-[11px] font-semibold text-muted-foreground">
                    Status:
                  </label>
                  <select
                    id="modal-filter-status"
                    value={tableStatusFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTableStatusFilter(val);
                      const matching = rows.filter((r) => {
                        if (val !== "ALL" && r.status !== val) return false;
                        if (tablePodFilter !== "ALL" && (r.account_owner || "Unassigned") !== tablePodFilter) return false;
                        return true;
                      });
                      setSelectedClientsForExport(matching.map((r) => r.client));
                    }}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[#b5018b] cursor-pointer"
                  >
                    <option value="ALL">All Statuses ({rows.length})</option>
                    {availableStatuses.map((st) => (
                      <option key={st} value={st}>
                        {statusLabel(st)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-filter-pod" className="text-[11px] font-semibold text-muted-foreground">
                    POD:
                  </label>
                  <select
                    id="modal-filter-pod"
                    value={tablePodFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTablePodFilter(val);
                      const matching = rows.filter((r) => {
                        if (tableStatusFilter !== "ALL" && r.status !== tableStatusFilter) return false;
                        if (val !== "ALL" && (r.account_owner || "Unassigned") !== val) return false;
                        return true;
                      });
                      setSelectedClientsForExport(matching.map((r) => r.client));
                    }}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[#b5018b] cursor-pointer"
                  >
                    <option value="ALL">All PODs ({availablePods.length})</option>
                    {availablePods.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter client list..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#b5018b]"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                {(() => {
                  const eligible = rows
                    .filter((r) => {
                      if (tableStatusFilter !== "ALL" && r.status !== tableStatusFilter) return false;
                      if (tablePodFilter !== "ALL" && (r.account_owner || "Unassigned") !== tablePodFilter) return false;
                      return true;
                    })
                    .map((r) => r.client);
                  return (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedClientsForExport(eligible)}
                          className="text-[11px] font-semibold text-[#b5018b] hover:underline cursor-pointer"
                        >
                          Select All Matching ({eligible.length})
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          onClick={() => setSelectedClientsForExport([])}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {selectedClientsForExport.length} of {eligible.length} selected
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Scrollable list of clients with checkboxes */}
            <div className="min-h-[160px] max-h-60 overflow-y-auto rounded-xl border border-border/80 bg-background/50 divide-y divide-border/40 p-1">
              {(() => {
                const eligible = rows
                  .filter((r) => {
                    if (tableStatusFilter !== "ALL" && r.status !== tableStatusFilter) return false;
                    if (tablePodFilter !== "ALL" && (r.account_owner || "Unassigned") !== tablePodFilter) return false;
                    return true;
                  })
                  .map((r) => r.client);
                const displayed = eligible.filter(
                  (c) => !clientSearch.trim() || c.toLowerCase().includes(clientSearch.toLowerCase().trim()),
                );

                if (displayed.length === 0) {
                  return <div className="py-6 text-center text-xs text-muted-foreground">No matching clients found.</div>;
                }

                return displayed.map((client) => {
                  const isChecked = selectedClientsForExport.includes(client);
                  const clientRow = rows.find((r) => r.client === client);
                  return (
                    <label
                      key={client}
                      className="flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-muted/60 cursor-pointer transition-colors select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setSelectedClientsForExport((prev) =>
                              prev.includes(client) ? prev.filter((x) => x !== client) : [...prev, client],
                            )
                          }
                          className="size-3.5 rounded border-border text-[#b5018b] focus:ring-[#b5018b] cursor-pointer"
                        />
                        <span className={`truncate font-medium ${isChecked ? "text-foreground" : "text-muted-foreground"}`}>
                          {client}
                        </span>
                      </div>
                      {clientRow && (
                        <span className="text-[11px] tabular-nums text-muted-foreground shrink-0 font-light">
                          {clientRow.contracted_hours ? `${Math.round(clientRow.contracted_hours)}h` : "—"}
                        </span>
                      )}
                    </label>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/70">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDownloadModalOpen(false)}
                className="rounded-full text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedClientsForExport.length === 0}
                onClick={() => {
                  const pool = rows.length ? rows : view.trendRows.filter((r) => !isInternalClient(r.client));
                  const toExport = pool.filter((r) => selectedClientsForExport.includes(r.client));
                  downloadFact(toExport);
                  setDownloadModalOpen(false);
                }}
                className="rounded-full font-bold uppercase text-[11px] tracking-wider bg-[#121212] hover:bg-[#b5018b] text-white shadow-[2px_2px_0px_#99d132] px-4 cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <Download className="size-3.5" />
                Download CSV ({selectedClientsForExport.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
