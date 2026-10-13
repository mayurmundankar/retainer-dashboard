"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banner, ChartBox, Metric, SectionTitle, SimpleTable } from "./bits";
import { hrs1, pct1, signedPct, statusLabel } from "./format";
import type { View } from "./view";

const axis = { fontSize: 11, fill: "#737373" };

export function ClientTab({ view }: { view: View }) {
  const [client, setClient] = useState(view.clients[0] ?? "");
  const selected = view.clients.includes(client) ? client : view.clients[0] ?? "";
  if (!view.clients.length) return <Banner tone="info">Select at least one client in the sidebar.</Banner>;

  const cdf = view.payload.fact
    .filter((r) => r.client === selected && r.month >= view.range[0] && r.month <= view.range[1])
    .sort((a, b) => a.month.localeCompare(b.month));
  const row = view.payload.fact.find((r) => r.client === selected && r.month === view.asOf);
  const contracts = view.payload.contracts.filter((c) => c.client === selected);
  const info = view.payload.clientInfo.find((c) => c.client === selected);
  const items = view.payload.planned.filter(
    (p) => p.client === selected && p.month === view.asOf && view.workTypes.includes(p.work_type),
  );
  const history = view.payload.actionsLog
    .filter((a) => a.client === selected)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const cats = view.payload.categories;
  const nbData = cdf.map((r) => ({ month: r.month, ...r.nb }));

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

  return (
    <div className="space-y-4">
      <Select value={selected} onValueChange={(v) => v && setClient(v)} items={view.clients.map((c) => ({ value: c, label: c }))}>
        <SelectTrigger className="w-full max-w-sm" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {view.clients.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div>
        <SectionTitle>Contract context</SectionTitle>
        <div className="mt-2 overflow-auto rounded-md border">
          <SimpleTable
            rows={contracts}
            columns={[
              { key: "contract_id", label: "Contract" },
              { key: "service", label: "Service", render: (r) => r.service || "—" },
              { key: "contract_start", label: "Start" },
              { key: "contract_end", label: "End" },
              { key: "effective_from", label: "Effective" },
              { key: "monthly_hours", label: "Hours / month", render: (r) => hrs1(r.monthly_hours) },
              { key: "billing_model", label: "Billing" },
              { key: "contract_source", label: "Source" },
              { key: "notes", label: "Notes" },
            ]}
          />
        </div>
      </div>

      {info && (
        <div className="grid gap-4 rounded-md border p-3 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <div><span className="text-muted-foreground">Owner </span>{info.owner || "—"}</div>
            <div><span className="text-muted-foreground">Support </span>{info.support || "—"}</div>
            <div><span className="text-muted-foreground">Escalation </span>{info.escalation || "—"}</div>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <Metric label="Contracted" value={`${hrs1(row.contracted_hours)} h`} hint={row.partial_month ? "partial month" : null} />
            <Metric label="Allocated" value={`${hrs1(row.allocated_hours)} h`} />
            <Metric label="Planned" value={`${hrs1(row.planned_hours)} h`} />
            <Metric label="Actual" value={row.actual_hours == null ? "missing" : `${hrs1(row.actual_hours)} h`} />
            <Metric label="Forecast" value={row.forecast_hours == null ? "—" : `${hrs1(row.forecast_hours)} h`} hint={signedPct(row.variance_pct)} />
            <Metric
              label="Contract-to-date"
              value={`${Math.round(row.ctd_actual)} / ${Math.round(row.ctd_contracted)} h`}
              hint={signedPct(row.ctd_variance_pct)}
            />
          </div>
          {row.ctd_missing_months > 0 && (
            <Banner tone="warn">
              {row.ctd_missing_months} month(s) in this contract have missing actuals — the contract-to-date figure understates delivery until resolved.
            </Banner>
          )}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartBox title="Monthly hours">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cdf} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tick={axis} />
              <YAxis tick={axis} width={36} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actual_hours" name="Actual" stackId="h" fill="#3182bd" />
              <Bar dataKey="remaining_estimate" name="Remaining est." stackId="h" fill="#bfdbfe" />
              <Line dataKey="allocated_hours" name="Allocated" stroke="#111" strokeDasharray="4 4" dot={false} />
              <Line dataKey="contracted_hours" name="Contracted" stroke="#a3a3a3" dot={false} />
              <Scatter dataKey="planned_hours" name="Planned" fill="#7c3aed" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox title="Contract-to-date (resets on renewal)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cdf} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tick={axis} />
              <YAxis tick={axis} width={40} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="ctd_contracted" name="CTD contracted" stroke="#111" dot={false} />
              <Line dataKey="ctd_actual" name="CTD actual" stroke="#dc2626" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <SectionTitle>Deliverables – {view.asOf}</SectionTitle>
          <div className="mt-2 max-h-80 overflow-auto rounded-md border">
            <SimpleTable
              rows={items}
              columns={[
                { key: "task_name", label: "Task" },
                { key: "discipline", label: "Discipline" },
                { key: "owner", label: "Owner" },
                { key: "status", label: "Status" },
                { key: "planned_hours", label: "Planned", render: (r) => hrs1(r.planned_hours) },
                { key: "remaining_estimate_hours", label: "Remaining", render: (r) => hrs1(r.remaining_estimate_hours) },
                { key: "work_type", label: "Work type" },
              ]}
            />
          </div>
        </div>
        <div>
          <SectionTitle>Non-billable client time</SectionTitle>
          {cats.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No non-billable time recorded.</p>
          ) : (
            <div className="mt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={nbData}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="month" tick={axis} />
                  <YAxis tick={axis} width={36} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {cats.map((c, i) => (
                    <Bar key={c} dataKey={c} stackId="nb" fill={["#44403c", "#a8a29e", "#d6d3d1", "#78716c"][i % 4]} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <SectionTitle>Action history</SectionTitle>
          <div className="mt-2 overflow-auto rounded-md border">
            <SimpleTable
              rows={history}
              columns={[
                { key: "month", label: "Month" },
                { key: "flag_type", label: "Flag" },
                { key: "reason", label: "Reason" },
                { key: "action", label: "Action" },
                { key: "owner", label: "Owner" },
                { key: "deadline", label: "Deadline" },
                { key: "status", label: "Status" },
                { key: "notes", label: "Notes" },
                { key: "updated_at", label: "Updated" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
