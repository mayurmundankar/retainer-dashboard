"use client";

import { Disclosure, Metric, SimpleTable } from "./bits";
import { hrs1, pct1 } from "./format";
import type { View } from "./view";

export function ReconTab({ view }: { view: View }) {
  const clients = new Set(view.clients);
  const rec = view.payload.recon.filter((r) => clients.has(r.client));
  const investigate = rec.filter((r) => !r.status.startsWith("✅")).length;
  const owners = new Set(view.owners);
  const missingRows = view.payload.fact.filter((r) => clients.has(r.client) && owners.has(r.account_owner) && r.data_missing);
  const split = view.payload.workSplit.filter((r) => clients.has(r.client));
  const workCols = [...new Set(split.flatMap((r) => Object.keys(r.hours)))];
  const plannedVsActual = view.trendRows.map((r) => ({
    client: r.client,
    month: r.month,
    planned_hours: r.planned_hours,
    actual_hours: r.actual_hours,
    remaining_estimate: r.remaining_estimate,
    actual_minus_planned: r.actual_hours == null ? null : r.actual_hours - r.planned_hours,
  }));
  const notSet = view.payload.planned.filter((p) => p.billable_raw === "Not set");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Metric label="Everhour vs tracker – needs investigation" value={String(investigate)} />
        <Metric label="Duplicate entries removed" value={String(view.payload.duplicates.length)} />
        <Metric label="Unmapped client names" value={String(view.payload.unmapped.length)} />
        <Metric label="Unclassified entries" value={String(view.payload.unclassified.length)} />
        <Metric label="Client-months missing actuals" value={String(missingRows.length)} />
      </div>

      <Disclosure title="Everhour vs stand-up tracker (billable retainer hours)" open>
        <SimpleTable
          rows={rec}
          columns={[
            { key: "status", label: "Status" },
            { key: "client", label: "Client" },
            { key: "month", label: "Month" },
            { key: "everhour_hours", label: "Everhour", render: (r) => hrs1(r.everhour_hours) },
            { key: "tracker_hours", label: "Tracker", render: (r) => hrs1(r.tracker_hours) },
            { key: "difference", label: "Diff (h)", render: (r) => hrs1(r.difference) },
            { key: "difference_pct", label: "Diff %", render: (r) => pct1(r.difference_pct) },
          ]}
        />
      </Disclosure>

      <Disclosure title="Contracts read from Monday board descriptions">
        <p className="px-3 pt-2 text-[11px] text-muted-foreground">
          Each “service hours: N p/m” line becomes a contract line. A client filled in completely in contracts.csv overrides what is read here.
        </p>
        <SimpleTable
          rows={view.payload.clientInfo}
          columns={[
            { key: "client", label: "Client" },
            { key: "board_name", label: "Board" },
            { key: "owner", label: "Owner" },
            { key: "start_date", label: "Start" },
            { key: "hours_lines", label: "Hours" },
            { key: "total_monthly_hours", label: "Total / month" },
            { key: "parse_issues", label: "Parse issues" },
          ]}
        />
      </Disclosure>

      <Disclosure title="Missing actuals (shown as missing, never as zero)">
        <SimpleTable
          rows={missingRows}
          columns={[
            { key: "client", label: "Client" },
            { key: "month", label: "Month" },
            { key: "contracted_hours", label: "Contracted", render: (r) => hrs1(r.contracted_hours) },
            { key: "planned_hours", label: "Planned", render: (r) => hrs1(r.planned_hours) },
          ]}
        />
      </Disclosure>

      <Disclosure title={`Monday.com items with no month (${view.payload.plannedNoMonth.length})`}>
        <SimpleTable
          rows={view.payload.plannedNoMonth}
          columns={[
            { key: "item_id", label: "Item" },
            { key: "client", label: "Client" },
            { key: "task_name", label: "Task" },
            { key: "group", label: "Group" },
            { key: "status", label: "Status" },
            { key: "planned_hours", label: "Planned" },
          ]}
        />
      </Disclosure>

      <Disclosure title="Monday.com – how each item's month was found">
        <SimpleTable
          rows={view.payload.monthSource}
          columns={[
            { key: "client", label: "Client" },
            { key: "month_source", label: "Month source" },
            { key: "items", label: "Items" },
            { key: "hours", label: "Hours", render: (r) => hrs1(r.hours) },
          ]}
        />
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          {notSet.length} items have no “Billable vs Non” value (treated as billable).
        </p>
        <SimpleTable
          rows={notSet}
          columns={[
            { key: "client", label: "Client" },
            { key: "month", label: "Month" },
            { key: "task_name", label: "Task" },
            { key: "status", label: "Status" },
            { key: "planned_hours", label: "Planned", render: (r) => hrs1(r.planned_hours) },
            { key: "billable_raw", label: "Billable" },
          ]}
        />
      </Disclosure>

      <Disclosure title="Duplicate Everhour entries">
        <SimpleTable rows={view.payload.duplicates} columns={Object.keys(view.payload.duplicates[0] ?? { entry_id: "" }).map((k) => ({ key: k, label: k }))} />
      </Disclosure>

      <Disclosure title="Client names not matched to a contract">
        <SimpleTable
          rows={view.payload.unmapped}
          columns={[
            { key: "source", label: "Source" },
            { key: "client_name", label: "Client name" },
            { key: "records", label: "Records" },
          ]}
        />
        <p className="px-3 py-2 text-[11px] text-muted-foreground">Add unmatched names to client_mapping.csv in the storage bucket. Current mapping:</p>
        <SimpleTable
          rows={view.payload.mapping}
          columns={[
            { key: "source", label: "Source" },
            { key: "source_name", label: "Source name" },
            { key: "canonical_client", label: "Canonical client" },
          ]}
        />
      </Disclosure>

      <Disclosure title="Unclassified work type">
        <SimpleTable rows={view.payload.unclassified} columns={Object.keys(view.payload.unclassified[0] ?? { entry_id: "" }).map((k) => ({ key: k, label: k }))} />
      </Disclosure>

      <Disclosure title="Retainer vs project vs unclassified hours by client">
        <SimpleTable
          rows={split}
          columns={[
            { key: "client", label: "Client" },
            { key: "month", label: "Month" },
            ...workCols.map((c) => ({
              key: c,
              label: c,
              render: (r: (typeof split)[number]) => hrs1(r.hours[c] ?? 0),
            })),
          ]}
        />
      </Disclosure>

      <Disclosure title="Planned (Monday) vs actual (Everhour) by client-month">
        <SimpleTable
          rows={plannedVsActual}
          columns={[
            { key: "client", label: "Client" },
            { key: "month", label: "Month" },
            { key: "planned_hours", label: "Planned", render: (r) => hrs1(r.planned_hours) },
            { key: "actual_hours", label: "Actual", render: (r) => hrs1(r.actual_hours) },
            { key: "remaining_estimate", label: "Remaining", render: (r) => hrs1(r.remaining_estimate) },
            { key: "actual_minus_planned", label: "Actual − planned", render: (r) => hrs1(r.actual_minus_planned) },
          ]}
        />
      </Disclosure>
    </div>
  );
}
