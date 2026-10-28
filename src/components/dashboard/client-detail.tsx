"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Banner, ChartBox, Metric, SectionTitle, SimpleTable } from "./bits";
import { ChartTooltip, series, tick } from "./charts";
import { hrs1, signedPct, statusLabel } from "./format";
import { formatMonth } from "./month-picker";
import type { ContractRow } from "@/lib/types";
import type { View } from "./view";

function isProjectContract(c: ContractRow): boolean {
  const cid = (c.contract_id || "").toLowerCase();
  const cname = (c.client || "").toLowerCase();
  return cid.startsWith("project-") || cname.includes("project");
}

export function ClientTab({ view }: { view: View }) {
  const activeClientSet = new Set(
    view.monthRows
      .filter((r) => !r.data_missing && ((r.actual_hours != null && r.actual_hours > 0) || r.planned_hours > 0))
      .map((r) => r.client),
  );
  const clientList = [...view.clients].sort((a, b) => {
    const aActive = activeClientSet.has(a);
    const bActive = activeClientSet.has(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return a.localeCompare(b);
  });
  const defaultClient = clientList[0] ?? "";
  const [client, setClient] = useState(defaultClient);
  const selected = clientList.includes(client) ? client : defaultClient;
  if (!clientList.length) return <Banner tone="info">Select at least one client in the sidebar.</Banner>;

  // Rounded whole-number data for all charts to prevent long decimal display
  const cdf = useMemo(() => {
    return view.payload.fact
      .filter((r) => r.client === selected && r.month >= view.range[0] && r.month <= view.range[1])
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({
        ...r,
        actual_hours: r.actual_hours != null ? Math.round(r.actual_hours) : null,
        remaining_estimate: r.remaining_estimate != null ? Math.round(r.remaining_estimate) : null,
        contracted_hours: r.contracted_hours != null ? Math.round(r.contracted_hours) : null,
        allocated_hours: r.allocated_hours != null ? Math.round(r.allocated_hours) : null,
        planned_hours: r.planned_hours != null ? Math.round(r.planned_hours) : null,
        forecast_hours: r.forecast_hours != null ? Math.round(r.forecast_hours) : null,
        ctd_actual: r.ctd_actual != null ? Math.round(r.ctd_actual) : null,
        ctd_contracted: r.ctd_contracted != null ? Math.round(r.ctd_contracted) : null,
      }));
  }, [view.payload.fact, selected, view.range]);

  const row = view.payload.fact.find((r) => r.client === selected && r.month === view.asOf);
  const contracts = view.payload.contracts.filter((c) => c.client === selected);
  const info = view.payload.clientInfo.find((c) => c.client === selected);
  const items = view.payload.planned.filter(
    (p) => p.client === selected && p.month === view.asOf && view.workTypes.includes(p.work_type),
  );
  const history = view.payload.actionsLog
    .filter((a) => a.client === selected)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const linkList: { label: string; href?: string; text?: string }[] = [];
  if (info) {
    const named: [keyof typeof info, string][] = [
      ["contract_link", "Contract"],
      ["digital_plan", "Digital plan"],
      ["brand_guidelines", "Brand guidelines"],
      ["client_guide", "Client guide"],
      ["website", "Website"],
    ];
    for (const [key, label] of named) {
      const href = info[key];
      if (href) linkList.push({ label, href });
    }
    if (info.email) linkList.push({ label: info.email, text: info.email });
    for (const extra of info.other_links.split(" | ").filter(Boolean)) {
      const [name, ...rest] = extra.split(": ");
      const url = rest.join(": ");
      if (url) linkList.push({ label: name.charAt(0).toUpperCase() + name.slice(1), href: url });
    }
  }

  const allProjects = contracts.length > 0 && contracts.every((c) => isProjectContract(c));
  const allClients = contracts.length > 0 && contracts.every((c) => !isProjectContract(c));
  const hoursColLabel = allProjects ? "Total hours" : allClients ? "Hours / month" : "Hours";

  return (
    <div className="space-y-5">
      {/* Client Selector Header per feedback.md */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-card shadow-xs">
        <div className="space-y-0.5">
          <label htmlFor="client-selector" className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#b5018b]" />
            Select Client Account:
          </label>
          <p className="text-[11px] text-muted-foreground font-light">
            Drill into specific client contracts, delivery history, and deliverables. To filter the overall portfolio, use the sidebar.
          </p>
        </div>
        <div className="min-w-[280px]">
          <Select value={selected} onValueChange={(v) => v && setClient(v)} items={clientList.map((c) => ({ value: c, label: c }))}>
            <SelectTrigger id="client-selector" className="w-full shadow-xs border-border/80 font-bold text-[#b5018b]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clientList.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <SectionTitle badge="CONTRACT SUMMARY">Contract context</SectionTitle>
        <div className="mt-2 overflow-auto rounded-lg border border-border/70 shadow-xs bg-card">
          <SimpleTable
            rows={contracts}
            columns={[
              {
                key: "contract_id",
                label: "Type",
                tooltip: "Contract classification: project (fixed scope) or client (monthly retainer).",
                render: (r) => {
                  const isProj = isProjectContract(r);
                  return (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border shadow-xs ${
                        isProj
                          ? "bg-[#4b439d]/15 text-[#4b439d] dark:text-[#a5b4fc] border-[#4b439d]/30"
                          : "bg-[#b5018b]/15 text-[#b5018b] dark:text-[#f472b6] border-[#b5018b]/30"
                      }`}
                    >
                      {isProj ? "project" : "client"}
                    </span>
                  );
                },
              },
              { key: "contract_start", label: "Start", tooltip: "Contract start date." },
              { key: "contract_end", label: "End", tooltip: "Contract end / renewal date." },
              {
                key: "monthly_hours",
                label: hoursColLabel,
                tooltip: "Hours / month for clients, or total hours for projects.",
                render: (r) => {
                  const isProj = isProjectContract(r);
                  return (
                    <span className="tabular-nums font-medium text-foreground">
                      {hrs1(r.monthly_hours)} {isProj ? "total hours" : "hours/month"}
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      </div>

      {info && (
        <div className="grid gap-4 rounded-md border p-3 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <div><span className="text-muted-foreground">Owner </span>{info.owner || "—"}</div>
            <div><span className="text-muted-foreground">Support </span>{info.support || "—"}</div>
            <div><span className="text-muted-foreground">Start date </span>{info.start_date || "—"}</div>
            <div><span className="text-muted-foreground">Hours </span>{info.hours_lines || "—"}</div>
          </div>
          <div className="space-y-1">
            {linkList.length === 0 && <div className="text-muted-foreground">No links in the board description.</div>}
            {linkList.map((l) =>
              l.href ? (
                <div key={l.label + l.href}>
                  <a className="underline underline-offset-2" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                </div>
              ) : (
                <div key={l.label}>{l.text}</div>
              ),
            )}
          </div>
          {info.parse_issues && <div className="sm:col-span-2"><Banner tone="warn">Board description: {info.parse_issues}</Banner></div>}
        </div>
      )}

      {!row ? (
        <Banner tone="info">No active contract for {selected} in {view.asOf}.</Banner>
      ) : (
        <div className="space-y-3">
          <SectionTitle>
            {view.asOf} — {statusLabel(row.status)}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <Metric
              label="Contracted"
              value={`${hrs1(row.contracted_hours)} h`}
              hint={row.partial_month ? "partial month" : null}
              tooltip="Signed monthly commitment under client agreement, prorated for partial months."
            />
            <Metric
              label="Billable"
              value={`${hrs1(row.planned_hours)} h`}
              tooltip="Total billable hours scheduled on Monday.com boards for this month."
            />
            <Metric
              label="Actual"
              value={row.actual_hours == null ? "missing" : `${hrs1(row.actual_hours)} h`}
              tooltip="Actual billable delivery hours logged in Everhour so far this month."
            />
            <Metric
              label="Forecast"
              value={row.forecast_hours == null ? "—" : `${hrs1(row.forecast_hours)} h`}
              hint={signedPct(row.variance_pct)}
              tooltip="Projected month-end delivery hours: Actual + Remaining estimate."
            />
            <Metric
              label="Contract-to-date"
              value={`${Math.round(row.ctd_actual)} / ${Math.round(row.ctd_contracted)} h`}
              hint={signedPct(row.ctd_variance_pct)}
              tooltip="Cumulative actual delivery hours vs cumulative contracted hours across entire contract term."
            />
          </div>
          {row.ctd_missing_months > 0 && (
            <Banner tone="warn">
              {row.ctd_missing_months} month(s) in this contract have missing actuals — the contract-to-date figure understates delivery until resolved.
            </Banner>
          )}
        </div>
      )}

      {/* Main Charts: Monthly hours (without distracting scatter circle markers) + Contract-to-date trend */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartBox
          title={`Monthly hours · ${formatMonth(view.range[0])} – ${formatMonth(view.range[1])}`}
          subtitle="Monthly delivered actuals + remaining estimate vs contracted baseline (whole hours, zero decimals)"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart key={view.range.join(":")} data={cdf} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={tick} />
              <YAxis tick={tick} width={45} tickFormatter={(v) => `${Math.round(v)}`} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actual_hours" name="Actual" stackId="h" fill={series.actual} />
              <Bar dataKey="remaining_estimate" name="Remaining est." stackId="h" fill={series.allocated} radius={[3, 3, 0, 0]} />
              <Line dataKey="contracted_hours" name="Contracted" stroke={series.contracted} dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox
          title="Contract-to-date cumulative hours (resets on renewal)"
          subtitle="Cumulative contracted hours vs cumulative actual hours delivered across active term"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart key={view.range.join(":")} data={cdf} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={tick} />
              <YAxis tick={tick} width={45} tickFormatter={(v) => `${Math.round(v)}`} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="ctd_contracted" name="Contract-to-date contracted" stroke={series.contracted} strokeWidth={2} dot={false} />
              <Line dataKey="ctd_actual" name="Contract-to-date actual" stroke={series.forecast} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* Deliverables Table (Full Width for clarity) */}
      <div className="space-y-2">
        <SectionTitle badge="DELIVERABLES" subtitle={`Scheduled tasks and deliverables for ${selected} in ${view.asOf}`}>
          Deliverables – {view.asOf}
        </SectionTitle>
        <div className="max-h-80 overflow-auto rounded-xl border border-border/80 shadow-xs bg-card">
          <SimpleTable
            stickyHeader
            rows={items}
            columns={[
              { key: "task_name", label: "Task", className: "font-semibold text-foreground min-w-[200px]" },
              { key: "discipline", label: "Discipline" },
              { key: "owner", label: "Owner" },
              { key: "status", label: "Status" },
              { key: "planned_hours", label: "Planned", render: (r) => `${hrs1(r.planned_hours)} h` },
              { key: "remaining_estimate_hours", label: "Remaining", render: (r) => `${hrs1(r.remaining_estimate_hours)} h` },
              { key: "work_type", label: "Work type" },
            ]}
          />
        </div>
      </div>

      {/* Action History Table (Full Width for clarity) */}
      <div className="space-y-2">
        <SectionTitle badge="ACTIONS" subtitle={`Audit trail of all review actions, root causes, and owner commitments recorded for ${selected}`}>
          Action history
        </SectionTitle>
        <div className="max-h-80 overflow-auto rounded-xl border border-border/80 shadow-xs bg-card">
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground font-light">
              No past review actions recorded for {selected} yet. Log actions in the Review tab to track them here.
            </div>
          ) : (
            <SimpleTable
              stickyHeader
              rows={history}
              columns={[
                { key: "month", label: "Month", className: "font-bold text-foreground tabular-nums" },
                {
                  key: "flag_type",
                  label: "Flag",
                  render: (r) => (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4b439d]/15 text-[#4b439d] dark:text-[#a5b4fc] border border-[#4b439d]/25">
                      {r.flag_type}
                    </span>
                  ),
                },
                { key: "reason", label: "Reason", className: "font-medium" },
                { key: "action", label: "Agreed Action", className: "font-medium text-foreground" },
                { key: "owner", label: "Owner", className: "font-semibold text-[#b5018b]" },
                { key: "deadline", label: "Deadline", className: "tabular-nums" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => {
                    const st = (r.status || "Open").toLowerCase();
                    const cls = st.includes("resolved") || st.includes("complete")
                      ? "bg-[#99d132]/15 text-[#2e5904] dark:text-[#99d132] border-[#99d132]/35"
                      : st.includes("progress")
                      ? "bg-[#01abc8]/15 text-[#01abc8] border-[#01abc8]/35"
                      : "bg-[#b5018b]/15 text-[#b5018b] border-[#b5018b]/35";
                    return (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-2xs ${cls}`}>
                        {r.status || "Open"}
                      </span>
                    );
                  },
                },
                { key: "notes", label: "Notes", className: "max-w-xs truncate" },
                {
                  key: "updated_at",
                  label: "Logged At",
                  render: (r) => (
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                      {r.updated_at ? r.updated_at.replace("T", " ").slice(0, 16) : "—"}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
