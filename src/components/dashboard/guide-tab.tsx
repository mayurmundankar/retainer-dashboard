import { SimpleTable } from "./bits";

const DEFINITIONS = [
  ["Contracted hours", "Signed monthly commitment under client agreement, applied from each change's effective date. Partial months are prorated by days.", "Contracts"],
  ["Allocated hours", "Agreed delivery allocation for the month (now aligned with Contracted baseline unless a seasonal allocation exists).", "Contracts / seasonal plan"],
  ["Planned hours", "Hours planned on Monday.com boards for the month. Shown separately and never added to the forecast.", "Monday.com"],
  ["Actual hours", "Hours recorded so far under the current filters (billable client delivery time).", "Everhour"],
  ["Remaining estimate", "Hours still left on open items this month, after Everhour time already logged on those items.", "Monday.com / Everhour"],
  ["Forecast", "Projected month-end delivery hours: Actual + Remaining estimate.", "Calculated"],
  ["Monthly variance", "Forecast − Contracted/Allocated, in hours and percent.", "Calculated"],
  ["Contract-to-date", "Cumulative actual vs cumulative contracted for the current contract. Resets on renewal.", "Calculated"],
  ["Practical capacity", "Total net delivery hours available across all discipline team members after internal overhead buffer and booked leave.", "team_capacity.csv & team_leave.csv"],
  ["Client hours planned (Capacity)", "Total scheduled client delivery hours from Monday.com boards for the selected month.", "Monday.com"],
  ["Client hours actual (Capacity)", "Total billable delivery hours logged to date by discipline team members.", "Everhour"],
  ["Headroom", "Spare client delivery bandwidth: Practical capacity − Client hours planned.", "Calculated"],
  ["Delivery status", "Done, outstanding, and blocked items.", "Monday.com"],
  ["Data freshness", "Last successful refresh and the period covered, per source.", "Refresh log"],
];

const CAPACITY_COLUMNS = [
  ["Discipline", "Team capability / functional group (e.g. Account Management, Content, Development/Analytics, Digital PR, Paid, SEO).", "team_capacity.csv & Monday tags", "Mapped per user and per Monday task"],
  ["Gross", "Total contracted work hours for all active team members in that discipline before leave or non-client allocations.", "team_capacity.csv", "(Weekly hours × Working weekdays in month) / 5"],
  ["Leave", "Total booked holiday, public bank holidays, and approved absence hours for the month.", "team_leave.csv", "Summed per person from leave calendar"],
  ["Capacity (Practical)", "Net practical client delivery capacity available after accounting for non-client share (e.g. 20% internal overhead) and leave.", "team_capacity.csv & team_leave.csv", "Gross × (1 − non_client_share) − Leave hours"],
  ["Planned", "Total client hours scheduled across open tasks on Monday.com boards for this discipline.", "Monday.com", "Sum of planned_hours on Monday items"],
  ["Actual", "Total actual billable delivery hours logged by team members assigned to this discipline.", "Everhour", "Sum of hours from Everhour entries by mapped user"],
  ["Utilisation", "Actual delivery utilisation rate against practical capacity.", "Calculated", "(Actual / Practical Capacity) × 100%"],
  ["Planned Load", "Ratio of planned workload scheduled vs available capacity. Over 100% indicates an over-allocated discipline team.", "Calculated", "(Planned / Practical Capacity) × 100%"],
  ["Headroom", "Available spare client bandwidth remaining. Positive numbers indicate capacity to take on more work; negative indicates a deficit.", "Calculated", "Practical Capacity − Planned hours"],
];

export function GuideTab({ threshold }: { threshold: number }) {
  return (
    <div className="max-w-4xl space-y-6 text-sm">
      {/* Metric Definitions */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b-2 border-[#4b439d]/25 pb-1 mb-2">
          Metric definitions
        </h2>
        <div className="mt-2 overflow-auto rounded-xl border border-border/80 shadow-xs">
          <SimpleTable
            rows={DEFINITIONS.map(([metric, definition, source]) => ({ metric, definition, source }))}
            columns={[
              { key: "metric", label: "Metric", className: "font-bold text-foreground min-w-[170px]" },
              { key: "definition", label: "Definition", className: "whitespace-normal text-foreground/90 font-normal leading-relaxed" },
              {
                key: "source",
                label: "Source",
                className: "whitespace-nowrap text-xs",
                render: (r) => (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#4b439d]/15 text-[#4b439d] dark:text-[#a5b4fc] border border-[#4b439d]/30 shadow-2xs">
                    {r.source}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Capacity Table Columns & Platform Guidance */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b-2 border-[#4b439d]/25 pb-1 mb-1">
          Capacity Breakdown &amp; Platform Data Sources
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The Capacity tab reconciles team member working commitments, scheduled Monday tasks, and logged Everhour time across operational disciplines.
        </p>

        <div className="overflow-auto rounded-xl border border-border/80 shadow-xs">
          <SimpleTable
            rows={CAPACITY_COLUMNS.map(([column, definition, source, formula]) => ({ column, definition, source, formula }))}
            columns={[
              { key: "column", label: "Column", className: "font-bold text-foreground min-w-[130px]" },
              { key: "definition", label: "Description", className: "whitespace-normal text-foreground/90 font-normal leading-relaxed" },
              {
                key: "source",
                label: "Platform / File",
                className: "whitespace-nowrap text-xs",
                render: (r) => (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-[#b5018b]/15 text-[#b5018b] border border-[#b5018b]/30">
                    {r.source}
                  </span>
                ),
              },
              { key: "formula", label: "Formula / Method", className: "text-xs font-mono text-muted-foreground min-w-[180px]" },
            ]}
          />
        </div>

        {/* How to add new team members box */}
        <div className="rounded-xl border border-[#4b439d]/30 bg-[#4b439d]/5 p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#99d132]" />
            Where do I add new team members or update capacity?
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Capacity is driven by the team roster. When a new person joins or working arrangements change:
          </p>
          <ul className="list-disc pl-5 text-xs text-foreground/90 space-y-1">
            <li>
              <strong>Add the person to <code className="text-[#b5018b] font-mono font-semibold">team_capacity.csv</code></strong> (in the data folder or Supabase storage). Specify their exact full name (<code className="font-mono text-[11px]">user</code>), assigned functional <code className="font-mono text-[11px]">discipline</code> (e.g. SEO, Paid, Content, Digital PR), contracted <code className="font-mono text-[11px]">weekly_hours</code> (e.g. 37.5), and their <code className="font-mono text-[11px]">non_client_share</code> (e.g. 0.20 for 20% internal administrative time).
            </li>
            <li>
              <strong>Match Everhour &amp; Monday.com user names:</strong> Ensure the user name entered in <code className="font-mono text-[11px]">team_capacity.csv</code> exactly matches the display name they use when logging hours in <strong>Everhour</strong> and taking task ownership in <strong>Monday.com</strong>.
            </li>
            <li>
              <strong>Booked leave in <code className="text-[#b5018b] font-mono font-semibold">team_leave.csv</code>:</strong> When holidays, absence, or study leave are taken, rows in <code className="font-mono text-[11px]">team_leave.csv</code> with <code className="font-mono text-[11px]">user, month, leave_hours</code> subtract directly from their practical capacity for that month.
            </li>
          </ul>
        </div>
      </div>

      {/* Business Rules */}
      <div className="space-y-3 text-xs leading-relaxed text-foreground/85 font-normal">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b-2 border-[#4b439d]/25 pb-1 pt-2">
          Business rules
        </h2>
        <p><strong className="font-bold text-foreground">Review threshold:</strong> ±{threshold}% monthly and contract-to-date. Change it in the sidebar. The default lives in the app config.</p>
        <p><strong className="font-bold text-foreground">Review trigger:</strong> A flag is a review trigger. It is not an instruction to reduce delivery.</p>
        <p><strong className="font-bold text-foreground">Work types:</strong> Retainer work stays separate from separately commissioned projects. Use the work type filter.</p>
        <p><strong className="font-bold text-foreground">Client time:</strong> Non-billable client time (senior support, rework) is always shown on its own.</p>
        <p><strong className="font-bold text-foreground">Effective dates:</strong> Contract changes apply from their effective date, never retrospectively.</p>
        <p><strong className="font-bold text-foreground">Data integrity:</strong> Missing or stale source data is flagged. It is never displayed as zero.</p>
        <p><strong className="font-bold text-foreground">Deduplication:</strong> Duplicate Everhour entries are removed by entry ID. Unmapped client names are listed so they can be fixed in client_mapping.csv.</p>
      </div>
    </div>
  );
}
